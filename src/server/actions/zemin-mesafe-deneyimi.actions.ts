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
 * 2026-09-12 (V5.46) GÜNCELLEME — yukarıdaki "henüz canlı skora eklenmedi" paragrafı ARTIK
 * YANLIŞ, burada bırakılmıştı (2026-09-13'te bu oturumda fark edildi): sinyal kullanıcı
 * kararıyla (sireOrani/zeminToleransi ile AYNI türden, "önce backtest" kuralının bilinçli
 * istisnası) DERHAL canlıya alınmış, SONRA V5.46'da arac-model-veri-olustur.mts'teki bir
 * eğitim-verisi eksikliği düzeltilip GERÇEK B=500 bootstrap testiyle doğrulanmıştı (bkz.
 * engine-versions.data.ts, V5.46 açıklaması: "diğer"de top3 +0.53pp, düşük-şart'ta +0.59pp,
 * top1'de kayıp yok). Yani sinyal HEM canlı HEM kanıtlanmış — yalnız bu dosyanın kendi
 * yorumu güncellenmemişti.
 */
import { db } from "@/lib/db";
import { zeminKatsayisi, zeminDetayiSatirdanCikar } from "@/lib/methodology/mekanik-puanlama";
import { hizSurfaceFromRaw } from "@/lib/methodology/hiz-derecesi-hesapla";
import { surfaceToPist } from "@/lib/sire-stat-match";
import { parseTjkDate } from "@/lib/tjk-date";

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

// 2026-09-13 kullanıcı bulgusu (İstanbul K9, SENSEİ BAHA) — bu at için sinyal "yok" dönüyordu,
// kova (İstanbul/Sentetik/1.500) popülasyonu yeterliydi (108 örnek), sorun ATIN KENDİ
// 20.05.2026 koşusunun TjkDereceKaydi'de HİÇ olmamasıydı — oysa HorseRaceHistoryCache'te
// (ayrı bir TJK kaynağından, at profili sayfasından çekilen) doğru şekilde vardı. Kanıtlandı:
// TjkDereceKaydi'nin kaynağı ("Detaylı Derece İstatistikleri") ülke çapında yalnız ~8700
// kayıt/yıl döndürüyor — adaptörün kendi yorumunun iddia ettiği gibi "TÜM koşu performansları"
// DEĞİL, TJK'nın kısıtlı/seçilmiş bir alt kümesi. Popülasyon tabanı (bucketOrt/kiloEgimi,
// geniş çaplı kıyas gerektirir) HÂLÂ yalnız TjkDereceKaydi'den — o zaten yeterince geniş.
// Yalnız BİREYSEL at eşleşmesi (bir atın KENDİ geçmişi) için, TjkDereceKaydi'de hiç kaydı
// olmayan atlarda HorseRaceHistoryCache'e EK bir kaynak olarak bakılıyor — var olan bir
// eşleşmeyi asla EZMEZ, yalnız "yok" kalacak atlara ek şans tanır.
async function horseRaceHistoryCacheTenEkKayitlarGetir(
  eksikAdlar: string[],
  irk: string
): Promise<ArsivSatiri[]> {
  if (eksikAdlar.length === 0) return [];
  const runnerlar = await db.runner.findMany({
    where: { name: { in: eksikAdlar }, tjkAtId: { not: null } },
    select: { name: true, tjkAtId: true },
  });
  const tjkAtIdByAd = new Map<string, number>();
  for (const r of runnerlar) if (r.tjkAtId != null && !tjkAtIdByAd.has(r.name)) tjkAtIdByAd.set(r.name, r.tjkAtId);
  const tjkAtIdler = [...new Set(tjkAtIdByAd.values())];
  if (tjkAtIdler.length === 0) return [];

  const cacheKayitlari = await db.horseRaceHistoryCache.findMany({
    where: { tjkAtId: { in: tjkAtIdler } },
    select: { tjkAtId: true, rowsJson: true },
  });
  const adByTjkAtId = new Map<number, string>();
  for (const [ad, id] of tjkAtIdByAd) adByTjkAtId.set(id, ad);

  const sonuc: ArsivSatiri[] = [];
  for (const cache of cacheKayitlari) {
    const ad = adByTjkAtId.get(cache.tjkAtId);
    if (!ad) continue;
    const rows = cache.rowsJson as unknown as {
      date?: string; time?: string; surface?: string; distance?: number; weight?: string; classType?: string;
    }[];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.distance == null || !row.surface) continue;
      sonuc.push({
        atAdi: ad,
        irk,
        pist: surfaceToPist(hizSurfaceFromRaw(row.surface) ?? "SENTETIK"),
        mesafe: String(row.distance),
        pistDurumu: zeminDetayiSatirdanCikar(row.surface) ?? "Sert/Normal",
        derece: row.time ?? null,
        kilo: row.weight ?? null,
        cinsAdi: row.classType ?? "",
        tarih: row.date ? parseTjkDate(row.date) : null,
      });
    }
  }
  return sonuc;
}

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
  bugunMesafe: number,
  // 2026-09-13 kullanıcı bulgusu — TjkDereceKaydi'de kaydı olmayan atlarda HorseRaceHistoryCache'e
  // ek kaynak olarak bakabilmek için atın ırkı (TjkDereceKaydi.irk ile AYNI format: "İngiliz"/"Arap")
  // gerekiyor — HorseRaceHistoryCache satırları kendi ırkını taşımıyor. Verilmezse (eski
  // çağıranlar) ek kaynak atlanır, davranış AYNEN eskisi gibi kalır.
  bugunIrk?: string
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

  // Popülasyon tabanı (bucketOrt/kiloEgimi) BİLEREK yalnız TjkDereceKaydi'den kuruldu (yukarıda,
  // bu satırdan ÖNCE) — geniş çaplı kıyas için yeterli örneklem zaten var. Ek kaynak yalnız
  // TjkDereceKaydi'de HİÇ kaydı olmayan atlar için, BİREYSEL eşleşmeyi tamamlamak amacıyla
  // devreye giriyor — mevcut bir eşleşmeyi asla ezmiyor.
  if (bugunIrk) {
    const eksikAdlar = atIsimleri.filter((ad) => !atPistZeminKayitlari.has(ad));
    if (eksikAdlar.length > 0) {
      const ekKayitlar = await horseRaceHistoryCacheTenEkKayitlarGetir(eksikAdlar, bugunIrk);
      for (const s0 of ekKayitlar) {
        if (s0.tarih && s0.tarih >= cutoffTarihi) continue;
        if (s0.pist !== bugunPist) continue;
        const zeminK = zeminKatsayisi(s0.pistDurumu).katsayi;
        if (zeminK !== bugunZeminKatsayi) continue;
        const s: Zenginlestirilmis = {
          ...s0,
          zeminKatsayi: zeminK,
          metre: (() => { try { return mesafeyeMetre(s0.mesafe); } catch { return null; } })(),
          saniye: dereceyeSaniye(s0.derece),
          kiloSayi: parseKilo(s0.kilo),
        };
        const arr = atPistZeminKayitlari.get(s.atAdi) ?? [];
        arr.push(s);
        atPistZeminKayitlari.set(s.atAdi, arr);
      }
    }
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
