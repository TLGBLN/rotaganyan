import { FeatureValue, RaceFamily } from "./feature-contract";

// Standardizasyon: yalnız TRAIN observed değerlerinden (test verisi asla girmez).
export interface Normalizer { mean: number; sd: number }

export function fitNormalizer(values: number[]): Normalizer {
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return { mean: 0, sd: 1 };
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return { mean: m, sd: s > 1e-12 ? s : 1 };
}

// Katkı sözleşmesi: observed ? reliability × β × z : 0.  Eksik ham değer asla 0 olarak standardize edilmez.
export function contribution(f: FeatureValue, norm: Normalizer, beta: number): number {
  if (!f.observed || f.raw == null) return 0;
  const z = (f.raw - norm.mean) / Math.max(norm.sd, 1e-12);
  return f.reliability * beta * z;
}

// Etkin katsayı: β_global + δ_family. δ ridge ile sıfıra çekilir (elle sıfırlama yok).
export interface Coefficients {
  global: number[];
  delta: Record<RaceFamily, number[]>;
}

export function effectiveBeta(c: Coefficients, family: RaceFamily, j: number): number {
  return c.global[j] + (c.delta[family]?.[j] ?? 0);
}

// Race-level skor: S_i = Σ_j contribution_ij (+ B_i). Olasılık: softmax(S) — yarış başına.
export function raceScores(
  runners: { features: FeatureValue[] }[],
  norms: Normalizer[],
  c: Coefficients,
  family: RaceFamily,
  bLayer: number[] = [],
): number[] {
  return runners.map((r, i) => {
    let s = bLayer[i] ?? 0;
    for (let j = 0; j < norms.length; j++) s += contribution(r.features[j], norms[j], effectiveBeta(c, family, j));
    return s;
  });
}

export function softmax(s: number[]): number[] {
  if (!s.length) return [];
  const m = Math.max(...s);
  const e = s.map((x) => Math.exp(x - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / t);
}

// Ridge'li koşullu logit kaybı: NLL + λG‖β‖² + λS‖δ‖². Gradyanı analitik; yarış-başına softmax.
export function lossAndGrad(
  races: { runners: { features: FeatureValue[] }[]; winner: number; family: RaceFamily }[],
  norms: Normalizer[],
  c: Coefficients,
  lambdaG: number,
  lambdaS: number,
): { loss: number; gGlobal: number[]; gDelta: Record<RaceFamily, number[]> } {
  const J = norms.length;
  const gG = new Array(J).fill(0);
  const gD: Record<RaceFamily, number[]> = {
    HANDICAP: new Array(J).fill(0), CONDITIONS: new Array(J).fill(0), MAIDEN: new Array(J).fill(0),
    KV_STAKES: new Array(J).fill(0), GROUP: new Array(J).fill(0), SALES: new Array(J).fill(0), OTHER: new Array(J).fill(0),
  };
  let nll = 0;
  for (const race of races) {
    const s = raceScores(race.runners, norms, c, race.family);
    const p = softmax(s);
    nll += -Math.log(Math.max(p[race.winner], 1e-15));
    for (let i = 0; i < race.runners.length; i++) {
      const err = p[i] - (i === race.winner ? 1 : 0);
      for (let j = 0; j < J; j++) {
        const x = contribution(race.runners[i].features[j], norms[j], 1); // β=1 → z×reliability
        gG[j] += err * x;
        gD[race.family][j] += err * x;
      }
    }
  }
  let reg = 0;
  for (let j = 0; j < J; j++) {
    gG[j] += 2 * lambdaG * c.global[j];
    reg += lambdaG * c.global[j] ** 2;
  }
  for (const fam of Object.keys(gD) as RaceFamily[]) {
    for (let j = 0; j < J; j++) {
      gD[fam][j] += 2 * lambdaS * (c.delta[fam]?.[j] ?? 0);
      reg += lambdaS * (c.delta[fam]?.[j] ?? 0) ** 2;
    }
  }
  return { loss: nll + reg, gGlobal: gG, gDelta: gD };
}
