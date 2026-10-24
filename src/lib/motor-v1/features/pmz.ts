// ROTAGANYAN ANALİZ MOTORU v1.0 — PİST-MESAFE-ZEMİN (PMZ) ailesi
// (registry: PMZ_01 zeminUyumu, PMZ_02 mesafeUyumu, PMZ_03 hipodromUyumu,
// PMZ_04 zeminMesafeDeneyim) + HIZ_01 temelli iki ek etkileşim (FORM×ZEMİN, SINIF×MESAFE).
//
// TASARIM KARARI (kullanıcı talimatı, 2026-10-17): PMZ_01/02/03 "atın HIZ_01'inin zemin/
// mesafe/hipodroma göre DEĞİŞİMİ"ni ölçer — ham bitiriş-oranı (R) DEĞİL, çünkü HIZ_01
// zaten rakip kalitesinden bağımsız bir yetenek tahmini. R-tabanlı "FORM × ZEMİN" ayrı bir
// fonksiyon olarak (computeFormZeminEtkilesimi) saklanır — ikisi FARKLI bilgi taşır
// (biri yetenek, diğeri son-dönem bitiriş-performansı).
//
// GÜVENLİK KURALLARI (üç kullanıcı uyarısı, bu dosyada TEK TEK uygulanır):
//   1) HIZ_01 hedef yarışın SONUCUNDAN değil, o geçmiş yarışın KENDİ TARİHİNDEN önceki
//      bilgiden hesaplanır — bu garanti hiz.ts/getHizDerecesiForRace'ten MİRAS alınır,
//      burada YENİDEN üretilmez (bkz. hiz-derecesi-hesapla.ts satır 97: g.tarih < cutoff).
//   2) Aynı C_{r,-i} değeri iki farklı at için AYNI çıkabilir (aynı yarışta rakip
//      oldukları için matematiksel olarak beklenir) — ama HER at için kendi tjkAtId'si
//      AYRI AYRI dışlanarak hesaplanır (computeRaceClassStrength'e HER ÇAĞRIDA farklı
//      excludeTjkAtId verilir, PAYLAŞILAN bir "önceden hesaplanmış" değer YOKTUR).
//   3) HALF_LIFE_DAYS ve SHRINKAGE_K/BANDWIDTH sabitleri GEÇİCİ/placeholder — eğitimden
//      ÖĞRENİLMEDEN nihai katsayı gibi kullanılmaz (bkz. common.ts PLACEHOLDER_HALF_LIFE_DAYS
//      ile AYNI dürüstlük ilkesi, aşağıdaki PMZ_* sabitlerinde tekrarlanır).

import { db } from "@/lib/db";
import {
  median,
  timeDecayWeight,
  weightedAverage,
  shrinkageFactor,
  effectiveSampleSize,
  gaussianKernel,
  classifyCoverage,
  type CoverageState,
} from "./common";
import { computeSpeedRatingForRace, type HizResult } from "./hiz";
import { computeRaceClassStrength, type RaceClassStrength } from "./sinif";
import { parseSurface, type SurfaceFamily } from "./surface-classifier";
import {
  parseHistoryRows,
  parseTjkDate,
  rowsBeforeCutoff,
  rowToOutcome,
  createFieldSizeResolver,
  type HistoryRow,
  type FieldSizeResolverFn,
} from "./history-source";
import { finishRatio } from "./common";

// GEÇİCİ — doğrulama setinden ÖĞRENİLMEDİ (bkz. common.ts PLACEHOLDER_HALF_LIFE_DAYS).
export const PMZ_SHRINKAGE_K = 4;
// GEÇİCİ — kullanıcı talimatı: "Bant genişliği eğitim verisiyle belirlenecek."
export const PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER = 0.15;

function orderedPastRows(rows: HistoryRow[], cutoff: Date): HistoryRow[] {
  return rowsBeforeCutoff(rows, cutoff)
    .map((r) => ({ row: r, date: parseTjkDate(r.date)! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((x) => x.row);
}

/**
 * Bir (geçmiş) yarışın koşucu listesi + HIZ_01 haritası — raceId başına BİR KEZ sorgulanır
 * (N+1 önleme, history-source.ts'teki createFieldSizeResolver ile AYNI desen).
 */
type RaceContext = { hizMap: Map<number, HizResult>; runners: { no: number; tjkAtId: number | null }[] };
export type RaceContextCache = Map<string, Promise<RaceContext>>;

export function createRaceContextCache(): RaceContextCache {
  return new Map();
}

async function loadRaceContext(raceId: string, cache: RaceContextCache): Promise<RaceContext> {
  let pending = cache.get(raceId);
  if (!pending) {
    pending = Promise.all([
      computeSpeedRatingForRace(raceId),
      db.runner.findMany({ where: { raceId, scratched: false }, select: { no: true, tjkAtId: true } }),
    ]).then(([hizMap, runners]) => ({ hizMap, runners }));
    cache.set(raceId, pending);
  }
  return pending;
}

/** Bir atın BELİRLİ bir geçmiş yarıştaki KENDİ HIZ_01'i (leave-one-out DEĞİL — SINIF'ın
 *  aksine burada atın kendi değeri aranıyor, rakiplerinki değil). */
async function getOwnHiz(raceId: string, tjkAtId: number, cache: RaceContextCache): Promise<number | null> {
  const ctx = await loadRaceContext(raceId, cache);
  const runner = ctx.runners.find((r) => r.tjkAtId === tjkAtId);
  if (!runner) return null;
  return ctx.hizMap.get(runner.no)?.value ?? null;
}

export type PmzResult = {
  rawValue: number | null;
  value: number | null; // shrinkage uygulanmış
  observationCount: number; // hedef grupta (aynı zemin / aynı hipodrom) kullanılan gözlem
  comparisonCount: number; // karşılaştırma grubunda kullanılan gözlem
  skippedUnknownSurface: number;
  skippedUnresolvedRace: number;
  totalHistoryRows: number;
  coverageState: CoverageState;
  // Teşhis amaçlı — NİHAİ DEĞERE KARIŞTIRILMAZ: "iyi gitme" rakip zayıflığından mı geliyor?
  targetGroupCompetitorQuality: number | null;
  comparisonGroupCompetitorQuality: number | null;
};

type SurfaceRow = { row: HistoryRow; family: SurfaceFamily; raceId: string; date: Date };

async function resolveSurfaceRows(
  allRows: HistoryRow[],
  resolver: FieldSizeResolverFn
): Promise<{ rows: SurfaceRow[]; skippedUnknownSurface: number; skippedUnresolvedRace: number }> {
  const rows: SurfaceRow[] = [];
  let skippedUnknownSurface = 0;
  let skippedUnresolvedRace = 0;
  for (const row of allRows) {
    const parsed = parseSurface(row.surface);
    if (parsed.surfaceFamily == null) {
      skippedUnknownSurface++;
      continue;
    }
    const resolved = await resolver(row);
    if (resolved == null) {
      skippedUnresolvedRace++;
      continue;
    }
    const date = parseTjkDate(row.date)!;
    rows.push({ row, family: parsed.surfaceFamily, raceId: resolved.raceId, date });
  }
  return { rows, skippedUnknownSurface, skippedUnresolvedRace };
}

/**
 * PMZ_01 — zeminUyumu. Atın HIZ_01'inin BUGÜNKÜ zemin ailesindeki (çim/kum/sentetik)
 * geçmiş yarışlarda ürettiği değer ile DİĞER zemin ailelerindeki değer arasındaki,
 * az-gözlemde 0'a (HIZ_01'in nötr noktası) küçültülen fark.
 */
export async function computePmzZeminUyumu(
  tjkAtId: number | null,
  targetSurface: SurfaceFamily,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver(),
  raceContextCache: RaceContextCache = createRaceContextCache(),
  classStrengthCache: Map<string, Promise<RaceClassStrength>> = new Map()
): Promise<PmzResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const empty = (coverageState: CoverageState): PmzResult => ({
    rawValue: null,
    value: null,
    observationCount: 0,
    comparisonCount: 0,
    skippedUnknownSurface: 0,
    skippedUnresolvedRace: 0,
    totalHistoryRows: allRows.length,
    coverageState,
    targetGroupCompetitorQuality: null,
    comparisonGroupCompetitorQuality: null,
  });
  if (tjkAtId == null) return empty("IDENTITY_UNRESOLVED");
  if (allRows.length === 0) return empty("TRUE_DEBUTANT");

  const { rows, skippedUnknownSurface, skippedUnresolvedRace } = await resolveSurfaceRows(allRows, resolver);

  const samePoints: { value: number | null; weight: number | null }[] = [];
  const otherPoints: { value: number | null; weight: number | null }[] = [];
  const sameClassVals: number[] = [];
  const otherClassVals: number[] = [];

  for (const sr of rows) {
    const [ownHiz, strength] = await Promise.all([
      getOwnHiz(sr.raceId, tjkAtId, raceContextCache),
      (async () => {
        const key = `${sr.raceId}:${tjkAtId}`;
        let pending = classStrengthCache.get(key);
        if (!pending) {
          pending = computeRaceClassStrength(sr.raceId, tjkAtId);
          classStrengthCache.set(key, pending);
        }
        return pending;
      })(),
    ]);
    if (ownHiz == null) continue;
    const deltaDays = (cutoff.getTime() - sr.date.getTime()) / 86_400_000;
    const w = timeDecayWeight(deltaDays, halfLifeDays);
    if (w == null) continue;
    if (sr.family === targetSurface) {
      samePoints.push({ value: ownHiz, weight: w });
      if (strength.value != null) sameClassVals.push(strength.value);
    } else {
      otherPoints.push({ value: ownHiz, weight: w });
      if (strength.value != null) otherClassVals.push(strength.value);
    }
  }

  const sameAvg = weightedAverage(samePoints);
  const otherAvg = weightedAverage(otherPoints);
  const rawValue = sameAvg != null && otherAvg != null ? sameAvg - otherAvg : null;
  const coverageState = classifyCoverage(true, allRows.length, samePoints.length);
  const shrink = shrinkageFactor(samePoints.length, PMZ_SHRINKAGE_K);
  const value = rawValue == null ? null : shrink * rawValue;

  return {
    rawValue,
    value,
    observationCount: samePoints.length,
    comparisonCount: otherPoints.length,
    skippedUnknownSurface,
    skippedUnresolvedRace,
    totalHistoryRows: allRows.length,
    coverageState,
    targetGroupCompetitorQuality: sameClassVals.length > 0 ? median(sameClassVals) : null,
    comparisonGroupCompetitorQuality: otherClassVals.length > 0 ? median(otherClassVals) : null,
  };
}

export type PmzDistanceResult = {
  rawValue: number | null;
  value: number | null;
  effectiveObservationCount: number; // n_eff = (Σw)²/Σw² — tamsayı DEĞİL (bkz. common.ts)
  totalHistoryRows: number;
  coverageState: CoverageState;
  bandwidthUsed: number;
};

/**
 * PMZ_02 — mesafeUyumu. HIZ_01'in bugünkü mesafeye Gauss-çekirdek yakınlığıyla ağırlıklı
 * ortalaması İLE tüm geçmişin zaman-ağırlıklı (mesafeden bağımsız) ortalaması arasındaki
 * fark — "bugünkü mesafeye YAKIN koşularda at ne kadar farklı bir hız üretiyor" sorusuna
 * karşılık gelir. n_eff küçükse (kullanıcı kuralı) fark 0'a küçültülür.
 */
export async function computePmzMesafeUyumu(
  tjkAtId: number | null,
  targetDistance: number,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver(),
  raceContextCache: RaceContextCache = createRaceContextCache(),
  bandwidth: number = PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER
): Promise<PmzDistanceResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const empty = (coverageState: CoverageState): PmzDistanceResult => ({
    rawValue: null,
    value: null,
    effectiveObservationCount: 0,
    totalHistoryRows: allRows.length,
    coverageState,
    bandwidthUsed: bandwidth,
  });
  if (tjkAtId == null) return empty("IDENTITY_UNRESOLVED");
  if (allRows.length === 0) return empty("TRUE_DEBUTANT");

  const nearPoints: { value: number | null; weight: number | null }[] = [];
  const allPoints: { value: number | null; weight: number | null }[] = [];
  const nearWeightsOnly: number[] = [];

  for (const row of allRows) {
    const resolved = await resolver(row);
    if (resolved == null) continue;
    const ownHiz = await getOwnHiz(resolved.raceId, tjkAtId, raceContextCache);
    if (ownHiz == null) continue;
    const rowDate = parseTjkDate(row.date)!;
    const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
    const timeW = timeDecayWeight(deltaDays, halfLifeDays);
    if (timeW == null || !Number.isFinite(row.distance) || row.distance <= 0) continue;
    allPoints.push({ value: ownHiz, weight: timeW });
    const proximity = gaussianKernel(row.distance, targetDistance, bandwidth);
    if (proximity == null) continue;
    const combinedW = timeW * proximity;
    nearPoints.push({ value: ownHiz, weight: combinedW });
    nearWeightsOnly.push(proximity);
  }

  const nearAvg = weightedAverage(nearPoints);
  const overallAvg = weightedAverage(allPoints);
  const rawValue = nearAvg != null && overallAvg != null ? nearAvg - overallAvg : null;
  const effN = effectiveSampleSize(nearWeightsOnly);
  const coverageState = classifyCoverage(true, allRows.length, Math.round(effN));
  const shrink = shrinkageFactor(effN, PMZ_SHRINKAGE_K);
  const value = rawValue == null ? null : shrink * rawValue;

  return { rawValue, value, effectiveObservationCount: effN, totalHistoryRows: allRows.length, coverageState, bandwidthUsed: bandwidth };
}

/**
 * PMZ_03 — hipodromUyumu. Kullanıcı uyarısı: "Hipodrom etkisini, genel pist ve mesafe
 * etkisinin tekrarından ibaret hale getirmeyin" — bu yüzden karşılaştırma AYNI zemin
 * ailesine SABİTLENİR (yalnız hipodrom değişir): aynı-hipodrom+aynı-zemin VS
 * farklı-hipodrom+aynı-zemin. Mesafe bu sürümde SABİTLENMEDİ — HİPODROM×ZEMİN×MESAFE üçlü
 * etkileşimi, veri yeterince yoğunlaşana kadar AÇIK İŞ olarak bırakıldı (bkz. registry).
 */
export async function computePmzHipodromUyumu(
  tjkAtId: number | null,
  targetCity: string,
  targetSurface: SurfaceFamily,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver(),
  raceContextCache: RaceContextCache = createRaceContextCache()
): Promise<PmzResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const empty = (coverageState: CoverageState): PmzResult => ({
    rawValue: null,
    value: null,
    observationCount: 0,
    comparisonCount: 0,
    skippedUnknownSurface: 0,
    skippedUnresolvedRace: 0,
    totalHistoryRows: allRows.length,
    coverageState,
    targetGroupCompetitorQuality: null,
    comparisonGroupCompetitorQuality: null,
  });
  if (tjkAtId == null) return empty("IDENTITY_UNRESOLVED");
  if (allRows.length === 0) return empty("TRUE_DEBUTANT");

  const { rows, skippedUnknownSurface, skippedUnresolvedRace } = await resolveSurfaceRows(allRows, resolver);
  const sameSurfaceRows = rows.filter((r) => r.family === targetSurface);

  const samePoints: { value: number | null; weight: number | null }[] = [];
  const otherPoints: { value: number | null; weight: number | null }[] = [];

  for (const sr of sameSurfaceRows) {
    const ownHiz = await getOwnHiz(sr.raceId, tjkAtId, raceContextCache);
    if (ownHiz == null) continue;
    const deltaDays = (cutoff.getTime() - sr.date.getTime()) / 86_400_000;
    const w = timeDecayWeight(deltaDays, halfLifeDays);
    if (w == null) continue;
    if (sr.row.city === targetCity) samePoints.push({ value: ownHiz, weight: w });
    else otherPoints.push({ value: ownHiz, weight: w });
  }

  const sameAvg = weightedAverage(samePoints);
  const otherAvg = weightedAverage(otherPoints);
  const rawValue = sameAvg != null && otherAvg != null ? sameAvg - otherAvg : null;
  const coverageState = classifyCoverage(true, allRows.length, samePoints.length);
  const shrink = shrinkageFactor(samePoints.length, PMZ_SHRINKAGE_K);
  const value = rawValue == null ? null : shrink * rawValue;

  return {
    rawValue,
    value,
    observationCount: samePoints.length,
    comparisonCount: otherPoints.length,
    skippedUnknownSurface,
    skippedUnresolvedRace,
    totalHistoryRows: allRows.length,
    coverageState,
    targetGroupCompetitorQuality: null,
    comparisonGroupCompetitorQuality: null,
  };
}

export type PmzExperienceResult = {
  rawEffectiveCount: number; // n_effective — BAŞARI içermez, yalnız maruziyet
  value: number; // log(1+n_effective)
  totalHistoryRows: number;
  coverageState: CoverageState;
};

/**
 * PMZ_04 — zeminMesafeDeneyim. Kullanıcı uyarısı: "Bir atın aynı zeminde 15 kez koşması, o
 * zeminde BAŞARILI olduğu anlamına gelmez" — bu fonksiyon KASITLI OLARAK hiçbir bitiriş/hız
 * verisine BAKMAZ, yalnız (zemin ailesi eşleşmesi × mesafe yakınlığı) maruziyetini sayar.
 * Başarı ölçümü PMZ_01/PMZ_02'nin işi, burada DEĞİL.
 */
export function computePmzZeminMesafeDeneyim(
  tjkAtId: number | null,
  targetSurface: SurfaceFamily,
  targetDistance: number,
  rowsJson: unknown,
  cutoff: Date,
  bandwidth: number = PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER
): PmzExperienceResult {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  if (tjkAtId == null) {
    return { rawEffectiveCount: 0, value: 0, totalHistoryRows: allRows.length, coverageState: "IDENTITY_UNRESOLVED" };
  }
  if (allRows.length === 0) {
    return { rawEffectiveCount: 0, value: 0, totalHistoryRows: 0, coverageState: "TRUE_DEBUTANT" };
  }

  let rawEffectiveCount = 0;
  for (const row of allRows) {
    const parsed = parseSurface(row.surface);
    if (parsed.surfaceFamily !== targetSurface) continue;
    if (!Number.isFinite(row.distance) || row.distance <= 0) continue;
    const proximity = gaussianKernel(row.distance, targetDistance, bandwidth);
    if (proximity == null) continue;
    rawEffectiveCount += proximity;
  }

  return {
    rawEffectiveCount,
    value: Math.log(1 + rawEffectiveCount),
    totalHistoryRows: allRows.length,
    // deneyim sinyali "yeterlilik eşiği" gerektirmez — tek bir maruziyet bile bilgi taşır.
    coverageState: classifyCoverage(true, allRows.length, allRows.length > 0 ? 1 : 0, 1),
  };
}

export type FormZeminResult = {
  value: number | null;
  observationCount: number;
  totalHistoryRows: number;
  coverageState: CoverageState;
};

/**
 * FORM × ZEMİN etkileşimi — FORM_01 ile AYNI formül (zaman-ağırlıklı bitiriş-oranı R),
 * yalnız BUGÜNKÜ zemin ailesiyle eşleşen satırlara (son 5'i) KISITLANMIŞ. PMZ_01'den farkı:
 * burada HIZ_01 (yetenek) değil, HAM bitiriş-performansı (R) ölçülüyor.
 */
export async function computeFormZeminEtkilesimi(
  tjkAtId: number | null,
  targetSurface: SurfaceFamily,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver()
): Promise<FormZeminResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  if (tjkAtId == null) return { value: null, observationCount: 0, totalHistoryRows: allRows.length, coverageState: "IDENTITY_UNRESOLVED" };
  if (allRows.length === 0) return { value: null, observationCount: 0, totalHistoryRows: 0, coverageState: "TRUE_DEBUTANT" };

  const sameSurfaceRows = allRows.filter((r) => parseSurface(r.surface).surfaceFamily === targetSurface);
  const points: { value: number | null; weight: number | null }[] = [];
  for (const row of sameSurfaceRows) {
    if (points.length >= 5) break;
    const outcome = await rowToOutcome(row, resolver);
    const r = finishRatio(outcome);
    if (r == null) continue;
    const rowDate = parseTjkDate(row.date)!;
    const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
    const w = timeDecayWeight(deltaDays, halfLifeDays);
    if (w == null) continue;
    points.push({ value: r, weight: w });
  }

  return {
    value: weightedAverage(points),
    observationCount: points.length,
    totalHistoryRows: allRows.length,
    coverageState: classifyCoverage(true, allRows.length, points.length),
  };
}

export type SinifMesafeResult = {
  rawValue: number | null;
  value: number | null;
  effectiveObservationCount: number;
  totalHistoryRows: number;
  coverageState: CoverageState;
};

/**
 * SINIF × MESAFE etkileşimi — SINIF_01'in leave-one-out C_{r,-i}'si, zaman ağırlığına EK
 * olarak bugünkü mesafeye Gauss-çekirdek yakınlığıyla da ağırlıklandırılır: "atın BUGÜNKÜ
 * mesafeye yakın yarışlarda karşılaştığı rakip kalitesi" sorusuna cevap verir — SINIF_01'in
 * TÜM geçmişi tek havuzda eritmesinden farklı olarak mesafeye duyarlıdır.
 */
export async function computeSinifMesafeEtkilesimi(
  tjkAtId: number | null,
  targetDistance: number,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver(),
  classStrengthCache: Map<string, Promise<RaceClassStrength>> = new Map(),
  bandwidth: number = PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER
): Promise<SinifMesafeResult> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  if (tjkAtId == null) {
    return { rawValue: null, value: null, effectiveObservationCount: 0, totalHistoryRows: allRows.length, coverageState: "IDENTITY_UNRESOLVED" };
  }
  if (allRows.length === 0) {
    return { rawValue: null, value: null, effectiveObservationCount: 0, totalHistoryRows: 0, coverageState: "TRUE_DEBUTANT" };
  }

  const points: { value: number | null; weight: number | null }[] = [];
  const proximityWeights: number[] = [];

  for (const row of allRows) {
    if (!Number.isFinite(row.distance) || row.distance <= 0) continue;
    const resolved = await resolver(row);
    if (resolved == null) continue;
    const key = `${resolved.raceId}:${tjkAtId}`;
    let pending = classStrengthCache.get(key);
    if (!pending) {
      pending = computeRaceClassStrength(resolved.raceId, tjkAtId);
      classStrengthCache.set(key, pending);
    }
    const strength = await pending;
    if (strength.value == null) continue;
    const rowDate = parseTjkDate(row.date)!;
    const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
    const timeW = timeDecayWeight(deltaDays, halfLifeDays);
    const proximity = gaussianKernel(row.distance, targetDistance, bandwidth);
    if (timeW == null || proximity == null) continue;
    points.push({ value: strength.value, weight: timeW * proximity });
    proximityWeights.push(proximity);
  }

  const rawValue = weightedAverage(points);
  const effN = effectiveSampleSize(proximityWeights);
  return {
    rawValue,
    value: rawValue == null ? null : shrinkageFactor(effN, PMZ_SHRINKAGE_K) * rawValue,
    effectiveObservationCount: effN,
    totalHistoryRows: allRows.length,
    coverageState: classifyCoverage(true, allRows.length, Math.round(effN)),
  };
}
