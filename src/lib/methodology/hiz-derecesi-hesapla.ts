import { parseTjkDate } from "@/lib/tjk-date";
import { surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";

/**
 * hızDerecesi'nin TEK paylaşılan hesaplama çekirdeği — eğitim (arac-model-veri-olustur.mts)
 * ve canlı sunum (hiz-derecesi.actions.ts) 2026-08-31'e kadar İKİ AYRI mantık kullanıyordu:
 * eğitim, atın son 3 (365 gün içi) koşusunun HER BİRİNİ KENDİ kovasına (irk|pist|mesafe) ve
 * KENDİ tarihine göre popülasyon ortalamasıyla kıyaslıyordu; canlı ise yalnız BUGÜNKÜ kovayla
 * eşleşen geçmiş koşuları sayıp hepsini BUGÜNKÜ popülasyon ortalamasına vuruyordu. Sonuç:
 * canlı atların %43.8'i sıfır dönerken eğitimde bu oran yalnız %8.2'ydi, ortalama mutlak fark
 * ~2.86 puan (~0.8 SD) — Opus'un ölçümü (2026-08-30). Artık İKİ TARAF DA bu fonksiyonu
 * çağırıyor. Ayrıca eğitim tarafındaki popülasyon indeksi eskiden HER "start" (Runner satırı)
 * için atın TÜM geçmişini tekrar tekrar ekliyordu — çok start yapan atların geçmiş koşuları
 * popülasyonu orantısız ağırlıklandırıyordu; burada her at yalnız BİR KEZ işleniyor.
 */

export type HizGecmisSatir = { date: string; time: string; distance: number; surface: string };
type PaceNokta = { tarih: Date; pace: number };
export type PaceIndex = Map<string, PaceNokta[]>;

export const HIZ_GUNCEL_FORM_PENCERESI_GUN = 365;

export function hizSureyiSaniyeyeCevir(t: string | undefined | null): number | null {
  if (!t) return null;
  const parcalar = t.split(".");
  if (parcalar.length === 3) {
    const dk = parseInt(parcalar[0], 10), sn = parseInt(parcalar[1], 10), yuzde = parseInt(parcalar[2], 10);
    if (isNaN(dk) || isNaN(sn) || isNaN(yuzde)) return null;
    return dk * 60 + sn + yuzde / 100;
  }
  if (parcalar.length === 2) {
    const sn = parseInt(parcalar[0], 10), yuzde = parseInt(parcalar[1], 10);
    if (isNaN(sn) || isNaN(yuzde)) return null;
    return sn + yuzde / 100;
  }
  return null;
}

export function hizSurfaceFromRaw(raw: string | undefined | null): "CIM" | "KUM" | "SENTETIK" | null {
  if (!raw) return null;
  if (raw.startsWith("Ç")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  return "SENTETIK";
}

/** Tüm popülasyonun (irk|pist|mesafe) pace indeksini kurar — her at TAM OLARAK BİR KEZ. */
export function hizPaceIndexKur(
  gecmisByTjkAtId: Map<number, HizGecmisSatir[]>,
  irkByTjkAtId: Map<number, string>
): PaceIndex {
  const index: PaceIndex = new Map();
  for (const [tjkAtId, gecmis] of gecmisByTjkAtId) {
    const irk = irkByTjkAtId.get(tjkAtId);
    if (!irk) continue;
    for (const g of gecmis) {
      const tarih = parseTjkDate(g.date);
      if (!tarih) continue;
      const saniye = hizSureyiSaniyeyeCevir(g.time);
      if (saniye == null || saniye <= 0 || !g.distance) continue;
      const pist = hizSurfaceFromRaw(g.surface);
      if (!pist) continue;
      const key = `${irk}|${surfaceToPist(pist)}|${mesafeBucket(g.distance)}`;
      const arr = index.get(key);
      if (arr) arr.push({ tarih, pace: g.distance / saniye });
      else index.set(key, [{ tarih, pace: g.distance / saniye }]);
    }
  }
  return index;
}

export function hizPopulasyonOrtPace(index: PaceIndex, key: string, cutoff: Date): number | null {
  const arr = index.get(key);
  if (!arr) return null;
  let toplam = 0, sayi = 0;
  for (const p of arr) {
    if (p.tarih.getTime() >= cutoff.getTime()) continue;
    toplam += p.pace;
    sayi++;
  }
  return sayi >= 20 ? toplam / sayi : null;
}

/** Bir atın hızDerecesini hesaplar — son 3 (365 gün içi) koşusunun her birini KENDİ
 *  kovasına ve KENDİ tarihine göre (sızıntısız) popülasyon ortalamasıyla kıyaslar. */
export function hizDerecesiHesaplaOrtak(
  gecmis: HizGecmisSatir[],
  irk: string,
  cutoff: Date,
  paceIndex: PaceIndex
): number {
  const pencereBaslangic = new Date(cutoff.getTime() - HIZ_GUNCEL_FORM_PENCERESI_GUN * 24 * 60 * 60 * 1000);
  const uygun = gecmis
    .map((g) => ({ ...g, tarih: parseTjkDate(g.date), saniye: hizSureyiSaniyeyeCevir(g.time) }))
    .filter(
      (g): g is HizGecmisSatir & { tarih: Date; saniye: number } =>
        g.tarih != null &&
        g.tarih.getTime() < cutoff.getTime() &&
        g.tarih.getTime() >= pencereBaslangic.getTime() &&
        g.saniye != null &&
        g.saniye > 0 &&
        !!g.distance
    )
    .sort((a, b) => b.tarih.getTime() - a.tarih.getTime())
    .slice(0, 3);

  let toplamFark = 0, sayi = 0;
  for (const g of uygun) {
    const pist = hizSurfaceFromRaw(g.surface);
    if (!pist) continue;
    const key = `${irk}|${surfaceToPist(pist)}|${mesafeBucket(g.distance)}`;
    const popOrt = hizPopulasyonOrtPace(paceIndex, key, g.tarih);
    if (popOrt == null) continue;
    const kendiPace = g.distance / g.saniye;
    toplamFark += (100 * (kendiPace - popOrt)) / popOrt;
    sayi++;
  }
  return sayi > 0 ? toplamFark / sayi : 0;
}
