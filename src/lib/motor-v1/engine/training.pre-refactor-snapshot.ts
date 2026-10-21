// PARİTE DOĞRULAMASI İÇİN SNAPSHOT — bu dosya training.ts'in SIGNAL_CODES-parametrize
// edilmeden ÖNCEKİ (2026-10-17, AGF öncesi) BİREBİR hâlidir. Yalnız diag-motor-v1-parity-
// check.mts tarafından, gerçek veriyle önce/sonra karşılaştırması için kullanılır — kalıcı
// bir modül DEĞİLDİR, commit edilmeyecektir.

import { db } from "@/lib/db";
import { dot, fitConditionalLogit, type TrainingRunner } from "@/lib/v5461/conditional-logit";
import { softmax } from "@/lib/v5461/math";
import { buildFeatureVectorsForRace, type RunnerFeatureVector } from "./feature-vector";
import type { TempoContext } from "../features/tempo";

export const MODEL_VERSION = "rotaganyan-v1.0-preliminary-smallsample-2026-10-17";

export const SIGNAL_CODES = [
  "FORM_01", "FORM_02", "FORM_03",
  "HIZ_01",
  "SINIF_01",
  "PMZ_01", "PMZ_02", "FORM_x_ZEMIN",
  "TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04",
  "JOKEY_01", "JOKEY_02", "JOKEY_03", "JOKEY_04",
  "KILO_01", "KILO_02", "KILO_03", "KILO_04",
] as const;
export type SignalCode = (typeof SIGNAL_CODES)[number];

export type FeatureStats = Map<SignalCode, { mu: number; sigma: number; nObserved: number }>;

export function computeFeatureStats(vectors: RunnerFeatureVector[]): FeatureStats {
  const stats: FeatureStats = new Map();
  for (const code of SIGNAL_CODES) {
    const values = vectors.flatMap((v) => {
      const s = v.signals.find((x) => x.code === code);
      return s && s.observed && s.rawValue != null && Number.isFinite(s.rawValue) ? [s.rawValue] : [];
    });
    if (values.length < 2) {
      stats.set(code, { mu: 0, sigma: 1, nObserved: values.length });
      continue;
    }
    const mu = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
    stats.set(code, { mu, sigma: Math.sqrt(variance) || 1, nObserved: values.length });
  }
  return stats;
}

export type ModelFeatureName = `${SignalCode}_z` | `${SignalCode}_missing`;

export function toModelVector(fv: RunnerFeatureVector, stats: FeatureStats): { vector: number[]; names: ModelFeatureName[] } {
  const vector: number[] = [];
  const names: ModelFeatureName[] = [];
  for (const code of SIGNAL_CODES) {
    const s = fv.signals.find((x) => x.code === code);
    const { mu, sigma } = stats.get(code)!;
    const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
    vector.push(observed ? (s!.rawValue! - mu) / (sigma || 1) : 0);
    names.push(`${code}_z`);
    vector.push(observed ? 0 : 1);
    names.push(`${code}_missing`);
  }
  return { vector, names };
}

export type TrainingRace = { raceId: string; date: Date; vectors: RunnerFeatureVector[]; winnerNo: number | null };

export async function selectTrainingRaces(limit: number, beforeDate: Date): Promise<{ raceId: string; date: Date }[]> {
  const races = await db.race.findMany({
    where: { raceDay: { date: { lt: beforeDate } }, result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "desc" } },
    take: limit * 2,
  });
  return races
    .filter((r) => r.runners.length >= 3)
    .slice(0, limit)
    .map((r) => ({ raceId: r.id, date: r.raceDay.date }));
}

function resolveWinnerNo(actualOrder: unknown, winnerNos: number[] | null | undefined): number | null {
  if (winnerNos && winnerNos.length > 0) return winnerNos[0];
  if (Array.isArray(actualOrder) && actualOrder.length > 0) {
    const n = parseInt(String(actualOrder[0]), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function buildTrainingSet(raceStubs: { raceId: string; date: Date }[], tempoCtx: TempoContext): Promise<TrainingRace[]> {
  const out: TrainingRace[] = [];
  for (const stub of raceStubs) {
    const [vectors, result] = await Promise.all([
      buildFeatureVectorsForRace(stub.raceId, tempoCtx),
      db.result.findUnique({ where: { raceId: stub.raceId }, select: { actualOrder: true, winnerNos: true } }),
    ]);
    const winnerNo = resolveWinnerNo(result?.actualOrder ?? null, result?.winnerNos ?? null);
    out.push({ raceId: stub.raceId, date: stub.date, vectors, winnerNo });
  }
  return out;
}

export type FitOptions = { lambda: number; learningRate: number; iterations: number };
export const DEFAULT_FIT_OPTIONS: FitOptions = { lambda: 1, learningRate: 0.05, iterations: 300 };

export type FittedModel = { beta: number[]; names: ModelFeatureName[]; stats: FeatureStats; nRacesUsed: number; nRacesSkipped: number; opts: FitOptions };

export function fitModel(trainingSet: TrainingRace[], stats: FeatureStats, opts: FitOptions = DEFAULT_FIT_OPTIONS): FittedModel {
  let names: ModelFeatureName[] = [];
  let nSkipped = 0;
  const races: TrainingRunner[][] = [];
  for (const t of trainingSet) {
    if (t.winnerNo == null || t.vectors.length < 2) {
      nSkipped++;
      continue;
    }
    const race: TrainingRunner[] = t.vectors.map((v) => {
      const { vector, names: n } = toModelVector(v, stats);
      names = n;
      return { raceId: t.raceId, runnerId: String(v.no), winner: v.no === t.winnerNo, features: vector };
    });
    if (!race.some((r) => r.winner)) {
      nSkipped++;
      continue;
    }
    races.push(race);
  }
  const featureCount = names.length;
  const beta = races.length > 0 ? fitConditionalLogit(races, featureCount, opts) : Array(featureCount).fill(0);
  return { beta, names, stats, nRacesUsed: races.length, nRacesSkipped: nSkipped, opts };
}

export type ScoredRunner = { no: number; name: string; score: number; probability: number };

export function scoreRace(vectors: RunnerFeatureVector[], model: FittedModel): ScoredRunner[] {
  const scored = vectors.map((v) => {
    const { vector } = toModelVector(v, model.stats);
    return { no: v.no, name: v.name, score: dot(vector, model.beta) };
  });
  const probs = softmax(scored.map((s) => s.score));
  return scored.map((s, i) => ({ ...s, probability: probs[i] }));
}

export type SignalEffectRow = {
  code: SignalCode;
  family: string | null;
  rawValue: number | null;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  missingIndicatorCoefficient: number;
  missingIndicatorContribution: number;
  observed: boolean;
  coverageState: string | null;
  modelVersion: string;
};

export function explainRunner(fv: RunnerFeatureVector, model: FittedModel): { rows: SignalEffectRow[]; totalScore: number; interactionContribution: null } {
  const { vector } = toModelVector(fv, model.stats);
  const rows: SignalEffectRow[] = SIGNAL_CODES.map((code, i) => {
    const zIdx = i * 2;
    const missIdx = i * 2 + 1;
    const s = fv.signals.find((x) => x.code === code);
    return {
      code,
      family: s?.family ?? null,
      rawValue: s?.rawValue ?? null,
      standardizedValue: vector[zIdx],
      learnedCoefficient: model.beta[zIdx],
      scoreContribution: model.beta[zIdx] * vector[zIdx],
      missingIndicatorCoefficient: model.beta[missIdx],
      missingIndicatorContribution: model.beta[missIdx] * vector[missIdx],
      observed: !!s?.observed,
      coverageState: s?.coverageState ?? null,
      modelVersion: MODEL_VERSION,
    };
  });
  const totalScore = rows.reduce((acc, r) => acc + r.scoreContribution + r.missingIndicatorContribution, 0);
  return { rows, totalScore, interactionContribution: null };
}
