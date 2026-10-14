import { softmax } from "./math";

export interface TrainingRunner {
  raceId: string;
  runnerId: string;
  winner: boolean;
  features: number[];
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function raceNll(runners: TrainingRunner[], beta: number[]): number {
  const probs = softmax(runners.map((r) => dot(r.features, beta)));
  const w = runners.findIndex((r) => r.winner);
  if (w < 0) throw new Error("Race has no winner");
  return -Math.log(Math.max(probs[w], 1e-15));
}

export function raceGradient(runners: TrainingRunner[], beta: number[]): number[] {
  const p = softmax(runners.map((r) => dot(r.features, beta)));
  const g: number[] = Array(beta.length).fill(0);
  for (let i = 0; i < runners.length; i++) {
    const err = p[i] - (runners[i].winner ? 1 : 0);
    for (let j = 0; j < beta.length; j++) g[j] += err * runners[i].features[j];
  }
  return g;
}

// Eğitim amaçlı referans optimizer (gradyan inişi). Üretimde daha güçlü bir optimizer kullanılabilir;
// amaç fonksiyonu (NLL + ridge) aynı kalmalıdır.
export function fitConditionalLogit(
  races: TrainingRunner[][],
  featureCount: number,
  opts: { lambda: number; learningRate: number; iterations: number; prior?: number[] },
): number[] {
  const beta = opts.prior ? [...opts.prior] : Array(featureCount).fill(0);
  for (let step = 0; step < opts.iterations; step++) {
    const grad: number[] = Array(featureCount).fill(0);
    for (const race of races) {
      const rg = raceGradient(race, beta);
      for (let j = 0; j < featureCount; j++) grad[j] += rg[j];
    }
    const scale = 1 / Math.max(1, races.length);
    for (let j = 0; j < featureCount; j++) {
      const target = opts.prior?.[j] ?? 0;
      const g = grad[j] + 2 * opts.lambda * (beta[j] - target);
      beta[j] -= opts.learningRate * g * scale;
    }
  }
  return beta;
}
