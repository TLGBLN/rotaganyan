"use server";

/**
 * "Zemin+Mesafe Deneyimi" — bir atın BUGÜNKÜ koşusunun tam (pist, zemin koşulu, mesafe)
 * kombinasyonunda ne kadar kanıtlanmış deneyimi olduğunu ölçer. Kullanıcı talebi
 * (2026-08-30, H2H'nin zemin-duyarlı yapılmasının hemen ardından): "o pist, zemin koşul
 * ve mesafede yarış geçmişi olan daha tecrübeli görülmeli olmayanlara göre. o pist, zemin
 * koşul var ama mesafede ilk defa koşacaksa mevcut mesafelere göre analiz yapılacak."
 *
 * zeminToleransi'den (zemin-toleransi.actions.ts) FARKI: o, atın TÜM Normal-dışı
 * geçmişini (hangi pist/mesafe olursa olsun) tek bir ortalamada toplar. Bu fonksiyon
 * BUGÜNÜN TAM pist+zemin kombinasyonuna göre filtreler, üç kademeli bir sonuç döner
 * (tam mesafe eşleşmesi / yalnız pist+zemin eşleşmesi / hiç eşleşme yok) — zeminToleransi'ye
 * DOKUNMADAN (o zaten canlı, B katmanı, kullanıcı onaylı istisna) ayrı bir C katmanı adayı
 * olarak inşa edildi.
 *
 * TjkDereceKaydi'de tjkAtId YOK, yalnız atAdi (isim) var — zeminToleransi/sireOrani/
 * yuzeyDegisikligi ile AYNI isim-eşleştirme risk profili (kabul edilebilir).
 *
 * HENÜZ CANLI SKORA EKLENMEDİ — yalnız V6 Aşama 3 (challenger) altyapısıyla gölge-test
 * edilecek (bkz. v6-challenger-registry.ts, "v6-zemin-mesafe-deneyimi"). Bu oturumun temel
 * disiplini: n≥250-300 sonuçlanmış gölge-koşu birikip B=500 ile gerçek katkısı kanıtlanmadan
 * A/B katmanına ASLA eklenmeyecek.
 */
import { db } from "@/lib/db";
import { zeminKatsayisi } from "@/lib/methodology/mekanik-puanlama";

function dereceyeSaniye(t: string | null): number | null {
  if (!t) return null;
  const parts = t.trim().split(".");
  if (parts.length === 3) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseInt(parts[2], 10) / 100;
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 100;
  return null;
}

function mesafeyeMetre(m: string): number {
  return parseInt(m.replace(/\./g, ""), 10);
}

function parseKilo(kilo: string | null): number | null {
  if (!kilo) return null;
  const n = parseFloat(kilo.replace(",", "."));
  return isNaN(n) ? null : n;
}

/** "Handikap"/"Kısa Vade Handikap" -> "handikap", geri kalan her şey -> "diger" — zemin-toleransi.actions.ts ile AYNI kategori mantığı. */
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" {
  return /handikap/i.test(cinsAdi) ? "handikap" : "diger";
}

type ArsivSatiri = {
  atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string;
  derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null;
};

// zemin-toleransi.actions.ts ile AYNI önbellek deseni (ayrı kopya — kod tekrarı kabul
// edilebilir, o dosya da sireOrani/yuzeyDegisikligi'nden bağımsız kendi kopyasını tutuyor).
const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: ArsivSatiri[]; zaman: number } | null = null;

async function tumArsiviGetir(): Promise<ArsivSatiri[]> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;
  const veri = await db.tjkDereceKaydi.findMany({
    where: { derece: { not: null } },
    select: { atAdi: true, irk: true, pist: true, mesafe: true, pistDurumu: true, derece: true, kilo: true, cinsAdi: true, tarih: true },
  });
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

const MESAFE_TOLERANS_M = 100;
const MIN_BUCKET_ORNEKLEM = 5;
const MIN_EGIM_ORNEKLEM = 30;

export type ZeminMesafeDeneyimi = { deger: number; seviye: "tam" | "kismi" | "yok"; ornekSayisi: number };

/**
 * Verilen atların, bugünkü (bugunPist, bugunZeminKatsayi, bugunMesafe) kombinasyonuna göre
 * kademeli deneyim skorunu döner. bugunZeminKatsayi null ise (bugünün zemini TJK'dan henüz
 * bilinmiyorsa) TÜM atlar için nötr ("yok") döner — hata fırlatmaz.
 */
export async function hesaplaZeminMesafeDeneyimiMap(
  atIsimleri: string[],
  cutoffTarihi: Date,
  bugunPist: string,
  bugunZeminKatsayi: number | null,
  bugunMesafe: number
): Promise<Map<string, ZeminMesafeDeneyimi>> {
  const notrSonuc = new Map<string, ZeminMesafeDeneyimi>(atIsimleri.map((ad) => [ad, { deger: 0, seviye: "yok" as const, ornekSayisi: 0 }]));
  if (bugunZeminKatsayi == null) return notrSonuc;

  const arsiv = await tumArsiviGetir();
  const atSeti = new Set(atIsimleri);

  // Her satırın zemin-katsayısını önceden hesapla (tekrar tekrar zeminKatsayisi çağırmamak için).
  type Zenginlestirilmis = ArsivSatiri & { zeminKatsayi: number; metre: number | null; saniye: number | null; kiloSayi: number | null };
  const zengin: Zenginlestirilmis[] = arsiv.map((s) => ({
    ...s,
    zeminKatsayi: zeminKatsayisi(s.pistDurumu).katsayi,
    metre: (() => { try { return mesafeyeMetre(s.mesafe); } catch { return null; } })(),
    saniye: dereceyeSaniye(s.derece),
    kiloSayi: parseKilo(s.kilo),
  }));

  // 1) Kategori-bazlı kilo-pace eğimi — zemin-toleransi.actions.ts ile AYNI mantık, yalnız
  // burada TÜM zemin katsayılarını (Normal dahil) kapsar çünkü bugünün koşulu Normal de olabilir.
  type EgimToplama = { sxy: number; sxx: number; sayi: number };
  const egimToplam = new Map<"handikap" | "diger", EgimToplama>();
  {
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: "handikap" | "diger" }[]>();
    for (const s of zengin) {
      if (s.tarih && s.tarih >= cutoffTarihi) continue; // leak-free
      if (!s.saniye || !s.metre || s.kiloSayi == null || s.saniye <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${s.metre}`;
      const arr = bucketHam.get(bucket) ?? [];
      arr.push({ pace: s.metre / s.saniye, kilo: s.kiloSayi, kategori: kiloKategorisi(s.cinsAdi) });
      bucketHam.set(bucket, arr);
    }
    for (const [, arr] of bucketHam.entries()) {
      if (arr.length < 10) continue;
      const ortKilo = arr.reduce((sum, a) => sum + a.kilo, 0) / arr.length;
      const ortPace = arr.reduce((sum, a) => sum + a.pace, 0) / arr.length;
      for (const a of arr) {
        const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 };
        const dx = a.kilo - ortKilo, dy = a.pace - ortPace;
        e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++;
        egimToplam.set(a.kategori, e);
      }
    }
  }
  const kiloEgimi = new Map<"handikap" | "diger", number>();
  for (const [kategori, e] of egimToplam.entries()) {
    if (e.sayi >= MIN_EGIM_ORNEKLEM && e.sxx > 0) kiloEgimi.set(kategori, e.sxy / e.sxx);
  }

  // 2) Popülasyon ortalama pace+kilo — bucket = irk|pist|mesafe|kategori, TÜM zemin
  // katsayıları dahil (her satır kendi zemin-durumundaki popülasyona kıyaslanır).
  const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
  for (const s of zengin) {
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    if (!s.saniye || !s.metre || s.saniye <= 0) continue;
    const bucket = `${s.irk}|${s.pist}|${s.metre}|${kiloKategorisi(s.cinsAdi)}`;
    const e = bucketToplam.get(bucket) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
    e.paceToplam += s.metre / s.saniye;
    e.kiloToplam += s.kiloSayi ?? 0;
    e.sayi++;
    bucketToplam.set(bucket, e);
  }
  const bucketOrt = new Map<string, { pace: number; kilo: number }>();
  for (const [k, v] of bucketToplam.entries()) if (v.sayi >= MIN_BUCKET_ORNEKLEM) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });

  function goreliPace(s: Zenginlestirilmis): number | null {
    if (!s.saniye || !s.metre || s.saniye <= 0) return null;
    const kategori = kiloKategorisi(s.cinsAdi);
    const bucket = `${s.irk}|${s.pist}|${s.metre}|${kategori}`;
    const taban = bucketOrt.get(bucket);
    if (!taban) return null;
    const egim = kiloEgimi.get(kategori);
    const beklenenPace = egim != null && s.kiloSayi != null ? taban.pace + egim * (s.kiloSayi - taban.kilo) : taban.pace;
    return ((s.metre / s.saniye - beklenenPace) / beklenenPace) * 100;
  }

  // 3) Her at için pist+zemin eşleşen kayıtları topla, sonra mesafe tam eşleşenleri ayır.
  const sonuc = new Map<string, ZeminMesafeDeneyimi>(notrSonuc);
  const atPistZeminKayitlari = new Map<string, Zenginlestirilmis[]>();
  for (const s of zengin) {
    if (!atSeti.has(s.atAdi)) continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    if (s.pist !== bugunPist) continue;
    if (s.zeminKatsayi !== bugunZeminKatsayi) continue;
    const arr = atPistZeminKayitlari.get(s.atAdi) ?? [];
    arr.push(s);
    atPistZeminKayitlari.set(s.atAdi, arr);
  }

  for (const ad of atIsimleri) {
    const kayitlar = atPistZeminKayitlari.get(ad);
    if (!kayitlar || kayitlar.length === 0) continue; // Kademe C: "yok" (zaten notrSonuc'ta)

    const tamEslesenler = kayitlar.filter((s) => s.metre != null && Math.abs(s.metre - bugunMesafe) <= MESAFE_TOLERANS_M);
    const kullanilacaklar = tamEslesenler.length > 0 ? tamEslesenler : kayitlar;
    const seviye: "tam" | "kismi" = tamEslesenler.length > 0 ? "tam" : "kismi";

    const goreliler = kullanilacaklar.map(goreliPace).filter((g): g is number => g != null);
    if (goreliler.length === 0) continue; // taban bucket'ı yetersizdi, "yok" olarak kalır

    const ortalama = goreliler.reduce((sum, g) => sum + g, 0) / goreliler.length;
    sonuc.set(ad, { deger: ortalama, seviye, ornekSayisi: goreliler.length });
  }

  return sonuc;
}
