import type { PedigreeRating } from "@prisma/client";
import {
  PEDIGREE_SCORE,
  galopFormScore,
  agfScore,
  weightScore,
  jockeyScore,
  equipmentScore,
  BANKO_THRESHOLD,
  TARGET_THRESHOLD,
} from "./config";

export type RunnerInput = {
  id: string;
  no: number;
  name: string;
  weight?: number | null;
  weightChange?: number | null;
  agf?: number | null;
  sameJockey: boolean;
  equipmentAdded?: string | null;
  pedigreeRating?: PedigreeRating | null;
  gallops: Array<{ form?: string | null; date: Date }>;
};

export type ScoredRunner = RunnerInput & {
  totalScore: number;
  scoreBreakdown: {
    galop: number;
    pedigree: number;
    agf: number;
    weight: number;
    jockey: number;
    equipment: number;
  };
  suggestedRank?: number;
  isTarget: boolean;
  isBankoCandidate: boolean;
};

function latestGalopForm(gallops: Array<{ form?: string | null; date: Date }>): string | null {
  if (gallops.length === 0) return null;
  const sorted = [...gallops].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted[0].form ?? null;
}

export function scoreRunners(runners: RunnerInput[]): ScoredRunner[] {
  const totalRunners = runners.length;

  const scored = runners.map((r): ScoredRunner => {
    const galop = galopFormScore(latestGalopForm(r.gallops));
    const pedigree = PEDIGREE_SCORE[r.pedigreeRating ?? "BILINMIYOR"];
    const agf = agfScore(r.agf, totalRunners);
    const weight = weightScore(r.weightChange);
    const jockey = jockeyScore(r.sameJockey);
    const equipment = equipmentScore(r.equipmentAdded);
    const totalScore = galop + pedigree + agf + weight + jockey + equipment;

    return {
      ...r,
      totalScore,
      scoreBreakdown: { galop, pedigree, agf, weight, jockey, equipment },
      isTarget: false,
      isBankoCandidate: false,
    };
  });

  // Sort descending and assign suggested rank
  scored.sort((a, b) => b.totalScore - a.totalScore);
  scored.forEach((r, i) => {
    r.suggestedRank = i + 1;
    r.isTarget = i === 0 && r.totalScore >= TARGET_THRESHOLD;
    r.isBankoCandidate = i === 0 && r.totalScore >= BANKO_THRESHOLD;
  });

  return scored;
}

export function detectTempo(runners: RunnerInput[]): string {
  const earlyRunners = runners.filter((r) => {
    const form = latestGalopForm(r.gallops);
    return form === "K1" || form === "K2";
  });
  if (earlyRunners.length >= 3) return "Yüksek tempo bekleniyor — çok koşucu hızlı start alabilir.";
  if (earlyRunners.length === 0) return "Düşük/orta tempo bekleniyor.";
  return "Orta tempo bekleniyor.";
}
