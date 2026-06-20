import type { PedigreeRating } from "@prisma/client";

export const GALOP_FORM_SCORE: Record<string, number> = {
  K1: 30, K2: 25,
  A1: 20, A2: 16,
  S1: 10, S2: 6,
  "İyi": 22, "Düz": 14, "Geride": 6,
  "Yavaş": 6, "Hızlı": 24,
};

export const PEDIGREE_SCORE: Record<PedigreeRating, number> = {
  COK_YUKSEK: 25,
  YUKSEK: 20,
  GUCLU: 16,
  ORTA: 12,
  DUSUK: 8,
  ZAYIF: 4,
  SORU: 10,
  BILINMIYOR: 10,
};

export const WEIGHT_CHANGE_THRESHOLDS = {
  bigDrop: -2,     // ≥ 2kg azalma → best
  smallDrop: 0,    // herhangi azalma
  noChange: 0,     // fark yok
};

export const SCORES = {
  galopMax: 30,
  pedigreeMax: 25,
  agfMax: 20,
  weightMax: 10,
  jockeyMax: 10,
  equipmentMax: 5,
};

export const BANKO_THRESHOLD = 82;
export const TARGET_THRESHOLD = 72;

export function galopFormScore(form: string | null | undefined): number {
  if (!form) return 10;
  return GALOP_FORM_SCORE[form] ?? 10;
}

export function agfScore(agf: number | null | undefined, totalRunners: number): number {
  if (agf == null) return 8;
  const rank = Math.ceil((agf / 100) * totalRunners);
  if (rank <= 1) return 20;
  if (rank <= 2) return 16;
  if (rank <= 3) return 13;
  if (rank <= 4) return 10;
  if (rank <= 5) return 7;
  return 4;
}

export function weightScore(change: number | null | undefined): number {
  if (change == null) return 5;
  if (change <= -2) return 10;
  if (change < 0) return 7;
  if (change === 0) return 5;
  return 2;
}

export function jockeyScore(sameJockey: boolean): number {
  return sameJockey ? 8 : 4;
}

export function equipmentScore(added: string | null | undefined): number {
  if (!added) return 0;
  if (added.toLowerCase().includes("gözlük")) return 5;
  return 3;
}
