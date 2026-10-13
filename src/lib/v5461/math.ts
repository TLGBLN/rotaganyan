// V5.46.1 matematik çekirdeği. Canlı yola BAĞLI DEĞİL: yalnız saf fonksiyonlar.

export const EPS = 1e-12;

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function logit(p: number): number {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return Math.log(q / (1 - q));
}

export function softmax(scores: number[]): number[] {
  if (!scores.length) return [];
  const mx = Math.max(...scores);
  const ex = scores.map((x) => Math.exp(x - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / sum);
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function weightedMean(values: number[], weights: number[]): number | null {
  if (values.length !== weights.length || !values.length) return null;
  let sw = 0;
  let sx = 0;
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(weights[i])) continue;
    if (weights[i] <= 0) continue;
    sw += weights[i];
    sx += weights[i] * values[i];
  }
  return sw > 0 ? sx / sw : null;
}

export function reliability(effectiveN: number, k: number): number {
  if (effectiveN <= 0) return 0;
  return effectiveN / (effectiveN + k);
}

export function recencyWeight(daysAgo: number, halfLifeDays: number): number {
  return Math.exp((-Math.log(2) * Math.max(0, daysAgo)) / halfLifeDays);
}

export function distanceSimilarity(pastDistance: number, targetDistance: number, tauMeters: number): number {
  return Math.exp(-Math.abs(pastDistance - targetDistance) / tauMeters);
}

export function conditionSimilarity(pastStrength: number, targetStrength: number, tau: number): number {
  return Math.exp(-Math.abs(pastStrength - targetStrength) / tau);
}
