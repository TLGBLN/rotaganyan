// ROTAGANYAN ANALİZ MOTORU v1.0 — FORM ailesi (registry: FORM_01, FORM_02, FORM_03).
// Kaynak: HorseRaceHistoryCache (bkz. history-source.ts). Yalnız hedef yarış tarihinden
// ÖNCEKİ satırlar kullanılır (point-in-time) — bkz. rowsBeforeCutoff.

import { finishRatio, timeDecayWeight, weightedAverage, classifyCoverage, type RaceOutcome, type CoverageState } from "./common";
import {
  parseHistoryRows,
  parseTjkDate,
  rowsBeforeCutoff,
  rowToOutcome,
  createFieldSizeResolver,
  type HistoryRow,
  type FieldSizeResolverFn,
} from "./history-source";

export type { CoverageState };

export type FormResult<T> = {
  value: T | null;
  observationCount: number;
  highConfidenceCount: number; // N çapraz-doğrulamasıyla uyuşan gözlem sayısı
  skippedUnknownFieldSize: number; // N hiç çözülemediği için tamamen dışlanan satır sayısı
  totalHistoryRows: number; // bu atın hedef tarihten önceki TOPLAM geçmiş satır sayısı (N'den bağımsız)
  coverageState: CoverageState;
};

/** Hedef tarihten önceki geçmiş satırları, en yeniden en eskiye sıralı döner. */
function orderedPastRows(rows: HistoryRow[], cutoff: Date): HistoryRow[] {
  return rowsBeforeCutoff(rows, cutoff)
    .map((r) => ({ row: r, date: parseTjkDate(r.date)! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((x) => x.row);
}

async function toWeightedPoint(
  row: HistoryRow,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn
): Promise<{ r: number | null; w: number | null; unresolved: boolean; highConfidence: boolean }> {
  const outcome: RaceOutcome = await rowToOutcome(row, resolver);
  const r = finishRatio(outcome);
  const unresolved = outcome.kind === "finished-unknown-field-size";
  const highConfidence = outcome.kind === "finished" && outcome.confidence === "high";
  const rowDate = parseTjkDate(row.date);
  if (r == null || rowDate == null) return { r: null, w: null, unresolved, highConfidence };
  const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
  const w = timeDecayWeight(deltaDays, halfLifeDays);
  return { r, w, unresolved, highConfidence };
}

/** FORM_01 — son 5 geçerli (R hesaplanabilen) yarışın ağırlıklı ortalaması.
 *  `resolver` paylaşılan bir createFieldSizeResolver() olabilir — birden fazla at için
 *  toplu (eğitim) hesaplamada AYNI yarışı tekrar tekrar sorgulamamak için (kullanıcı
 *  talimatı: N+1 sorgu sorunu). */
export async function computeFormLevel(
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver()
): Promise<FormResult<number>> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const points: { value: number | null; weight: number | null }[] = [];
  let skippedUnknownFieldSize = 0;
  let highConfidenceCount = 0;
  for (const row of allRows) {
    if (points.length >= 5) break;
    const { r, w, unresolved, highConfidence } = await toWeightedPoint(row, cutoff, halfLifeDays, resolver);
    if (unresolved) skippedUnknownFieldSize++;
    if (r != null && w != null) {
      points.push({ value: r, weight: w });
      if (highConfidence) highConfidenceCount++;
    }
  }
  return {
    value: weightedAverage(points),
    observationCount: points.length,
    highConfidenceCount,
    skippedUnknownFieldSize,
    totalHistoryRows: allRows.length,
    coverageState: classifyCoverage(tjkAtId != null, allRows.length, points.length),
  };
}

/** FORM_02 — son 2 yarış ortalaması eksi önceki 3 yarış ortalaması. 5'ten az geçerli
 *  gözlem varsa "belirsiz" (null) — 0 ile KARIŞTIRILMAZ. */
export async function computeFormTrend(
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number,
  resolver: FieldSizeResolverFn = createFieldSizeResolver()
): Promise<FormResult<number>> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const validR: number[] = [];
  let skippedUnknownFieldSize = 0;
  let highConfidenceCount = 0;
  for (const row of allRows) {
    if (validR.length >= 5) break;
    const { r, unresolved, highConfidence } = await toWeightedPoint(row, cutoff, halfLifeDays, resolver);
    if (unresolved) skippedUnknownFieldSize++;
    if (r != null) {
      validR.push(r);
      if (highConfidence) highConfidenceCount++;
    }
  }
  const base = {
    observationCount: validR.length,
    highConfidenceCount,
    skippedUnknownFieldSize,
    totalHistoryRows: allRows.length,
    coverageState: classifyCoverage(tjkAtId != null, allRows.length, validR.length),
  };
  if (validR.length < 5) return { value: null, ...base };
  const son2 = (validR[0] + validR[1]) / 2;
  const onceki3 = (validR[2] + validR[3] + validR[4]) / 3;
  return { value: son2 - onceki3, ...base };
}

/** FORM_03 — son yarıştan bu yana geçen gün sayısının log dönüşümü. N GEREKTİRMEZ —
 *  yalnız tarih bilgisine dayanır, bu yüzden 2019-2025 dönemi için de TAM kullanılabilir
 *  (kullanıcı kuralı: "N olmadan kullanılabilir mi? Son yarıştan geçen süre: Evet"). */
export function computeLayoff(tjkAtId: number | null, rowsJson: unknown, cutoff: Date): FormResult<number> {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const base = {
    observationCount: allRows.length > 0 ? 1 : 0,
    highConfidenceCount: 0,
    skippedUnknownFieldSize: 0,
    totalHistoryRows: allRows.length,
    // N-bağımsız sinyal: tek bir geçmiş satır bile varsa "yeterli" sayılır (minObservations=1).
    coverageState: classifyCoverage(tjkAtId != null, allRows.length, allRows.length > 0 ? 1 : 0, 1),
  };
  if (allRows.length === 0) return { value: null, ...base };
  const lastDate = parseTjkDate(allRows[0].date);
  if (lastDate == null) return { value: null, ...base };
  const days = (cutoff.getTime() - lastDate.getTime()) / 86_400_000;
  return { value: Math.log(1 + days), ...base };
}
