"use server";

/**
 * Zemin Kanıt Tablosu (2026-10-02, kullanıcı tasarımı — Bursa Ağır Çim denetimi sonrası).
 *
 * BAĞLAM: arac-v546-zemin-hiyerarsik-feature-test.mts ile doğrulandı — zeminToleransi'nin
 * ağırlığı (β=0.008-0.04) o kadar küçük ki, x'i ne kadar isabetli hesaplarsanız hesaplayın
 * (ALL_ABNORMAL/SAME_SURFACE/EXACT_FAMILY/HIERARCHICAL_BLEND) toplam skora etkisi
 * istatistiksel olarak ayırt edilemiyor (ΔLL~10^-5). Kullanıcı kararı: V5.46 SKORUNA
 * DOKUNMA — yalnız analiz/açıklama katmanını, atın "ağır çim" gibi bugünkü TAM zemine
 * ne kadar gerçek kanıtı olduğunu gösterecek şekilde zenginleştir.
 *
 * Bu modül SAF GÖRÜNTÜLEME verisi üretir — hiçbir hesaplama Faz1'in skor toplamına
 * (toFeatureVector) girmez, yalnız muhakeme/admin-panel metni için taşınır.
 *
 * Üç kanıt seviyesi (kullanıcının hiyerarşisi):
 *   EXACT         — bugünle AYNI pist (Çim/Kum) + AYNI rejim ailesi (Ağırlaşma/Yumuşama/Islanma)
 *   SAME_SURFACE  — bugünle AYNI pist, herhangi bir normal-dışı rejim
 *   ALL_ABNORMAL  — herhangi bir pist, herhangi bir normal-dışı rejim (legacy zeminToleransi ile AYNI tanım)
 *
 * Güven etiketi SAF UI metni — modele katsayı olarak GİRMEZ (kullanıcının net talimatı):
 *   n=0 → YOK, n=1-2 → DUSUK, n=3-5 → ORTA, n>5 → GUCLU  (n = EXACT seviyesindeki koşu sayısı)
 */
import { db } from "@/lib/db";
import { zeminRejimiCikar, type ZeminRejimi } from "@/lib/methodology/pist-dayanikliligi";

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
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" {
  return /handikap/i.test(cinsAdi) ? "handikap" : "diger";
}
function rejimAilesi(rejim: ZeminRejimi): "AGIRLASMA" | "YUMUSAMA" | "ISLANMA" | null {
  if (rejim === "BIRAZ_AGIR" || rejim === "AGIR" || rejim === "COK_AGIR") return "AGIRLASMA";
  if (rejim === "BIRAZ_YUMUSAK" || rejim === "YUMUSAK" || rejim === "COK_YUMUSAK") return "YUMUSAMA";
  if (rejim === "NEMLI" || rejim === "SULU" || rejim === "ISLAK") return "ISLANMA";
  return null;
}

type ArsivSatiri = {
  atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string;
  derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null;
};

// zemin-toleransi.actions.ts ile AYNI desen: tüm arşivi (~9000 satır) her istekte yeniden
// çekmek yavaş, modül-seviyesi 6 saatlik TTL'li bellek-içi önbellek kullanılır.
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

export type ZeminKanitSeviyesi = {
  n: number;
  performansYuzde: number | null; // null = n=0, veri yok
};
export type ZeminKanitTablosu = {
  bugunZeminEtiketi: string; // ör. "Çim / Ağır 4,5"
  exact: ZeminKanitSeviyesi;
  sameSurface: ZeminKanitSeviyesi;
  allAbnormal: ZeminKanitSeviyesi;
  guven: "YOK" | "DUSUK" | "ORTA" | "GUCLU"; // yalnız UI etiketi — modele GİRMEZ
};

function guvenSeviyesi(nExact: number): ZeminKanitTablosu["guven"] {
  if (nExact === 0) return "YOK";
  if (nExact <= 2) return "DUSUK";
  if (nExact <= 5) return "ORTA";
  return "GUCLU";
}

/**
 * Verilen atların, bugünün TAM (pist, rejim) kombinasyonuna göre 3 kademeli kanıt
 * tablosunu döner. Bugün Normal zeminse (anormal değilse) null döner — bu tablo yalnız
 * anormal-zemin günlerinde anlamlı (bkz. dosya başındaki not).
 */
export async function hesaplaZeminKanitTablosuMap(
  atIsimleri: string[],
  cutoffTarihi: Date,
  bugunPist: string, // "Çim" | "Kum" (Türkçe etiket, TjkDereceKaydi.pist ile AYNI sözlük)
  bugunRejimDetay: string | null // RaceDay.surfaceConditions[].detail, ör. "Ağır 4,5"
): Promise<Map<string, ZeminKanitTablosu | null>> {
  const sonuc = new Map<string, ZeminKanitTablosu | null>();
  const bugunRejim = zeminRejimiCikar(bugunRejimDetay);
  if (bugunRejim === "NORMAL") {
    for (const ad of atIsimleri) sonuc.set(ad, null);
    return sonuc;
  }
  const bugunAile = rejimAilesi(bugunRejim);
  const bugunZeminEtiketi = `${bugunPist} / ${bugunRejimDetay ?? bugunRejim}`;

  const arsiv = await tumArsiviGetir();
  const atSeti = new Set(atIsimleri);

  // 1) Popülasyon tabanı (yalnız Normal, tarihten önce) — zemin-toleransi.actions.ts'teki
  //    hesaplaZeminToleransiMap ile AYNI mantık, bağımsız (production fonksiyonuna dokunulmadı).
  const egimToplam = new Map<"handikap" | "diger", { sxy: number; sxx: number; sayi: number }>();
  {
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: "handikap" | "diger" }[]>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      if (s.tarih && s.tarih >= cutoffTarihi) continue;
      const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
      if (!sn || !metre || kilo == null || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}`;
      const arr = bucketHam.get(bucket) ?? [];
      arr.push({ pace: metre / sn, kilo, kategori: kiloKategorisi(s.cinsAdi) });
      bucketHam.set(bucket, arr);
    }
    for (const [, arr] of bucketHam.entries()) {
      if (arr.length < 10) continue;
      const ortKilo = arr.reduce((s, a) => s + a.kilo, 0) / arr.length;
      const ortPace = arr.reduce((s, a) => s + a.pace, 0) / arr.length;
      for (const a of arr) {
        const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 };
        const dx = a.kilo - ortKilo, dy = a.pace - ortPace;
        e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++;
        egimToplam.set(a.kategori, e);
      }
    }
  }
  const kiloEgimi = new Map<"handikap" | "diger", number>();
  for (const [kategori, e] of egimToplam.entries()) if (e.sayi >= 30 && e.sxx > 0) kiloEgimi.set(kategori, e.sxy / e.sxx);

  const bucketOrt = new Map<string, { pace: number; kilo: number }>();
  {
    const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      if (s.tarih && s.tarih >= cutoffTarihi) continue;
      const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
      if (!sn || !metre || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
      const e = bucketToplam.get(bucket) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
      e.paceToplam += metre / sn; e.kiloToplam += kilo ?? 0; e.sayi++;
      bucketToplam.set(bucket, e);
    }
    for (const [k, v] of bucketToplam.entries()) if (v.sayi >= 5) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });
  }

  function goreliPace(s: ArsivSatiri): number | null {
    const sn = dereceyeSaniye(s.derece), metre = mesafeyeMetre(s.mesafe), kilo = parseKilo(s.kilo);
    if (!sn || !metre || sn <= 0) return null;
    const kategori = kiloKategorisi(s.cinsAdi);
    const bucket = `${s.irk}|${s.pist}|${metre}|${kategori}`;
    const taban = bucketOrt.get(bucket);
    if (!taban) return null;
    const egim = kiloEgimi.get(kategori);
    const beklenenPace = egim != null && kilo != null ? taban.pace + egim * (kilo - taban.kilo) : taban.pace;
    return ((metre / sn - beklenenPace) / beklenenPace) * 100;
  }

  // 2) Her atın normal-dışı, tarihten önceki koşularını topla (pist+rejim bilgisiyle)
  const atKayitlari = new Map<string, { pist: string; rejim: ZeminRejimi; pace: number }[]>();
  for (const s of arsiv) {
    if (!atSeti.has(s.atAdi)) continue;
    if (s.pistDurumu === "Normal") continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const pace = goreliPace(s);
    if (pace == null) continue;
    const arr = atKayitlari.get(s.atAdi) ?? [];
    arr.push({ pist: s.pist, rejim: zeminRejimiCikar(s.pistDurumu), pace });
    atKayitlari.set(s.atAdi, arr);
  }

  // 3) Her at için 3 kademeli tablo
  for (const ad of atIsimleri) {
    const kayitlar = atKayitlari.get(ad) ?? [];
    const sameSurface = kayitlar.filter((r) => r.pist === bugunPist);
    const exact = bugunAile ? sameSurface.filter((r) => rejimAilesi(r.rejim) === bugunAile) : [];
    const seviye = (arr: typeof kayitlar): ZeminKanitSeviyesi => ({
      n: arr.length,
      performansYuzde: arr.length ? arr.reduce((s, r) => s + r.pace, 0) / arr.length : null,
    });
    sonuc.set(ad, {
      bugunZeminEtiketi,
      exact: seviye(exact),
      sameSurface: seviye(sameSurface),
      allAbnormal: seviye(kayitlar),
      guven: guvenSeviyesi(exact.length),
    });
  }
  return sonuc;
}
