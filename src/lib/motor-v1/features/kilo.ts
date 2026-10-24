// ROTAGANYAN ANALİZ MOTORU v1.0 — KİLO ailesi (registry: KILO_01 saha-göreli kilo, KILO_02
// geçmişe-göre kilo farkı, KILO_03 kilo×mesafe, KILO_04 kilo×sınıf/handikap).
//
// VERİ DOĞRULAMASI (kullanıcı talimatı, 2026-10-17): Runner.weight'in GERÇEK anlamı kod
// okumasıyla doğrulandı — src/server/services/ingest/tjk.adapter.ts:207 TJK PROGRAM
// TABLOSUNDAKİ "kilo" sütununu DOĞRUDAN parse ediyor (virgül→nokta ondalık, "57,5"→57.5 kg).
// TJK bu sütunda jokeyin O GÜN TAŞIYACAĞI NET kiloyu yayınlar — apprentice/jokey indirimi
// (varsa) ZATEN BU SAYIYA YANSIMIŞTIR (ayrı bir "brüt handikap kilosu" sütunu şemada/ingestte
// YOK, Runner.apprentice yalnız AYRI bir bayrak, kiloyu KENDİSİ DÜZELTMEZ). HorseRaceHistoryCache.
// rowsJson[].weight de AYNI format/birimde (string, virgüllü, kg) — iki kaynak TUTARLI.

import { db } from "@/lib/db";
import { median, timeDecayWeight, weightedAverage, classifyCoverage, type CoverageState } from "./common";
import { parseHistoryRows, parseTjkDate, rowsBeforeCutoff, type HistoryRow } from "./history-source";

// KILO_02 SHRINKAGE DENEYI (kullanici talebi, 2026-10-23): SINIF_01/PMZ_01 ile AYNI
// shrinkageFactor disiplini TRAIN-ici kronolojik CV ile test edildi (diag-v1-kil-
// iyilestirme-E-F.mts). SONUC DEJENERE: val LogLoss, K=2'den K=1000'e KADAR MONOTONIK
// iyilesiyor, bir platoya ULASMIYOR — CV "sinirli bir shrinkage K'si" bulamiyor, yalnizca
// "K->sonsuz" (yani sinyali neredeyse SIFIRLA) yonunu tercih ediyor. Bu, az-orneklemli
// gurultuyu notrlemeye calisan GERCEK bir shrinkage kalibrasyonu DEGIL — sinyalin
// KENDISININ ongoru degeri tasiyip tasimadigi sorusu (ayri bir ablation testi gerektirir,
// "kucuk etki -> otomatik kaldirma YOK" kuralina gore burada YAPILMADI). Deger HAM
// (shrink'siz) kaliyor — bkz. kok neden takip tablosu, "Henuz cozulmedi" kategorisi.

function parseWeightKg(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type Kilo01Result = { value: number | null; fieldSize: number; ownWeight: number | null };

/** KILO_01 — W_relative = W_i - median(W_field). Kilo bilgisi olmayan atlar medyana DAHİL
 *  EDİLMEZ (kullanıcı kuralı — registry'de zaten belirtilmiş). */
export function computeKiloSahaGoreli(ownWeight: number | null, fieldWeights: (number | null)[]): Kilo01Result {
  const valid = fieldWeights.filter((w): w is number => w != null && Number.isFinite(w) && w > 0);
  if (ownWeight == null || valid.length === 0) return { value: null, fieldSize: valid.length, ownWeight };
  return { value: ownWeight - median(valid), fieldSize: valid.length, ownWeight };
}

export type Kilo02Result = {
  rawValue: number | null; // ΔW = W_today - w-avg(W_history)
  value: number | null; // CV-TEST EDİLDİ (2026-10-23): shrinkage fayda sağlamadı, ham değer korunuyor
  observationCount: number;
  totalHistoryRows: number;
  coverageState: CoverageState;
};

function orderedPastRows(rows: HistoryRow[], cutoff: Date): HistoryRow[] {
  return rowsBeforeCutoff(rows, cutoff)
    .map((r) => ({ row: r, date: parseTjkDate(r.date)! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((x) => x.row);
}

/** KILO_02 — bugünkü kilo ile geçmiş (zaman-ağırlıklı) ortalama kilo farkı. Runner.weightChange
 *  DB alanı (%0 dolu, proje kuralı) KULLANILMAZ — HorseRaceHistoryCache'ten YENİDEN hesaplanır. */
export function computeKiloGecmiseGore(
  ownWeight: number | null,
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays: number
): Kilo02Result {
  const allRows = orderedPastRows(parseHistoryRows(rowsJson), cutoff);
  const empty = (coverageState: CoverageState): Kilo02Result => ({
    rawValue: null, value: null, observationCount: 0, totalHistoryRows: allRows.length, coverageState,
  });
  if (tjkAtId == null) return empty("IDENTITY_UNRESOLVED");
  if (allRows.length === 0) return empty("TRUE_DEBUTANT");
  if (ownWeight == null) return empty(classifyCoverage(true, allRows.length, 0));

  const points: { value: number | null; weight: number | null }[] = [];
  for (const row of allRows) {
    const w = parseWeightKg(row.weight);
    if (w == null) continue;
    const rowDate = parseTjkDate(row.date)!;
    const deltaDays = (cutoff.getTime() - rowDate.getTime()) / 86_400_000;
    const tw = timeDecayWeight(deltaDays, halfLifeDays);
    if (tw == null) continue;
    points.push({ value: w, weight: tw });
  }
  const histAvg = weightedAverage(points);
  const rawValue = histAvg == null ? null : ownWeight - histAvg;
  const value = rawValue;
  return {
    rawValue,
    value,
    observationCount: points.length,
    totalHistoryRows: allRows.length,
    coverageState: classifyCoverage(true, allRows.length, points.length),
  };
}

/**
 * KILO_03 — kilo×mesafe HAM etkileşim terimi. z(W_relative)×z(mesafe) formülü (registry) tek
 * bir CANLI yarış için anlamlı değildir (z-skor POPÜLASYON μ/σ gerektirir) — bu fonksiyon
 * standardize EDİLMEMİŞ ham çarpımı döner, STANDARDİZASYON eğitim/skorlama aşamasında (ortak
 * μ/σ ile) uygulanır — bkz. training.ts. Sabit bir katsayı/varsayım İÇERMEZ.
 */
export function computeKiloMesafeEtkilesimHam(kiloRelative: number | null, distanceMeters: number): number | null {
  if (kiloRelative == null || !Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  return kiloRelative * distanceMeters;
}

/**
 * KILO_04 — kilo×handikap HAM etkileşim terimi. Kullanıcı uyarısı: Handikap'ta yüksek kilo
 * genelde YÜKSEK RATİNGİ (güçlü at) yansıtır — KILO_01'in etkisi Handikap'ta ve diğer
 * (Şartlı/Maiden) sınıflarda FARKLI olabilir, bu yüzden tek bir sabit işaretle (+/-)
 * YORUMLANMAZ: isHandicapStyle BAYRAĞI (sinif-classifier.ts::parseClassType, YENİDEN
 * HESAPLANMADI) ile çarpılarak modele AYRI bir öğrenilebilir terim olarak sunulur.
 */
export function computeKiloHandikapEtkilesimHam(kiloRelative: number | null, isHandicapStyle: boolean): number | null {
  if (kiloRelative == null) return null;
  return kiloRelative * (isHandicapStyle ? 1 : 0);
}

export async function fieldWeightsForRace(raceId: string): Promise<Map<number, number | null>> {
  const runners = await db.runner.findMany({ where: { raceId, scratched: false }, select: { no: true, weight: true } });
  const out = new Map<number, number | null>();
  for (const r of runners) out.set(r.no, r.weight ?? null);
  return out;
}
