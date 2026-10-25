// ROTAGANYAN V1.0 — GÜNLÜK PİST VARYANTI (deneysel, izole — hiz-derecesi-hesapla.ts'in
// ORTAK çekirdeğine HİÇ DOKUNULMADI, yalnız onun salt-okunur dışa açık fonksiyonları
// `hizPopulasyonOrtPace`/`PaceIndex` ve `tumOnbellegiGetir`'in AYNI önbelleği import
// edilip YENİDEN kullanıldı).
//
// FİZİBİLİTE (kullanıcı talebi, 2026-10-23, kod ÇALIŞTIRILARAK doğrulandı — bkz.
// diag-v1-gunluk-varyant-feasibility.mts): (hipodrom, gün, zemin) kovası başına medyan 37,
// ortalama 47.2 start var (60 günlük örneklem) — güvenilir bir günlük varyant tahmini için
// YETERLİ.
//
// MANTIK: HIZ_01, bir atın geçmiş pace'ini (irk|pist|mesafe) kovasının UZUN-DÖNEM (tüm
// tarihçe) popülasyon ortalamasıyla kıyaslıyor — o GÜNE özel pist hızlı/yavaşlığını
// AYIKLAMIYOR (zaten doğrulanmış backlog). Düzeltme: aynı (şehir+gün+kova) içinde START
// ALAN TÜM atların (yalnız hedef atımızın değil) pace'ini kendi UZUN-DÖNEM kova
// ortalamasından ne kadar saptığını ölçüp ORTALAMASINI alarak "o günün varyantı"nı
// çıkarıyoruz — bu, tek bir atın kendi performansından BAĞIMSIZ, çok-atlı bir ortalama
// olduğu için DAİRESEL DEĞİL (bir atın kendi varyantını kendi geçmişiyle açıklaması riski
// YOK, çünkü varyant HER ZAMAN o günün TÜM diğer atlarından hesaplanıyor).
//
// Not: HorseRaceHistoryCache.rowsJson'daki satırlar `city` alanı taşıyor (history-source.ts
// HistoryRow ile AYNI ham JSON) — hiz-derecesi-hesapla.ts'in kendi `HizGecmisSatir` tipi bu
// alanı dar tutuyor (yalnız kendi ihtiyacı için), burada ayrı bir GENİŞ tip ile okunuyor.

import { hizSureyiSaniyeyeCevir, hizSurfaceFromRaw, hizPopulasyonOrtPace, type PaceIndex } from "@/lib/methodology/hiz-derecesi-hesapla";
import { surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";
import { parseTjkDate } from "./history-source";

type GenisSatir = { date: string; time: string; distance: number; surface: string; city: string };

export type GunlukVaryantIndex = Map<string, number>; // key: `${city}|${dateISO}|${bucketKey}` -> gun varyanti

const MIN_GUN_ORNEKLEM = 5; // bu esikten az atli bir gun-kova kombinasyonu GÜRÜLTÜLÜ sayılır, atlanır

/**
 * TÜM önbellekten (gecmisByTjkAtId + irkByTjkAtId, zaten ortak HIZ önbelleğinden) BİR KEZ
 * günlük-varyant indeksi kurar. paceIndex, HER ROW'un kendi UZUN-DÖNEM kova ortalamasına
 * göre sapmasını (residual) hesaplamak için kullanılır — bu residual'lar aynı (şehir, gün,
 * kova) içinde ortalanarak "o günün varyantı" elde edilir.
 */
export function gunlukVaryantIndexKur(
  gecmisByTjkAtId: Map<number, GenisSatir[]>,
  irkByTjkAtId: Map<number, string>,
  paceIndex: PaceIndex
): GunlukVaryantIndex {
  const residualsByGunKova = new Map<string, number[]>();

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
      const kovaKey = `${irk}|${surfaceToPist(pist)}|${mesafeBucket(g.distance)}`;
      // uzun-donem popOrt, BU SATIRIN KENDI TARIHINDEN ONCEKI veriyle (point-in-time) —
      // hizPopulasyonOrtPace zaten bu garantiyi tasiyor.
      const popOrt = hizPopulasyonOrtPace(paceIndex, kovaKey, tarih);
      if (popOrt == null) continue;
      const kendiPace = g.distance / saniye;
      const residual = (100 * (kendiPace - popOrt)) / popOrt;

      const gunKovaKey = `${g.city}|${tarih.toISOString().slice(0, 10)}|${kovaKey}`;
      const arr = residualsByGunKova.get(gunKovaKey);
      if (arr) arr.push(residual); else residualsByGunKova.set(gunKovaKey, [residual]);
    }
  }

  const index: GunlukVaryantIndex = new Map();
  for (const [key, residuals] of residualsByGunKova) {
    if (residuals.length < MIN_GUN_ORNEKLEM) continue; // yetersiz orneklem - GURULTULU, dahil edilmez
    const ort = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    index.set(key, ort);
  }
  return index;
}

export function gunlukVaryantAra(
  index: GunlukVaryantIndex,
  city: string,
  tarih: Date,
  irk: string,
  pist: string,
  mesafe: string
): number | null {
  const key = `${city}|${tarih.toISOString().slice(0, 10)}|${irk}|${pist}|${mesafe}`;
  return index.get(key) ?? null;
}
