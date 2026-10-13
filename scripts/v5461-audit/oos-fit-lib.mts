// REDUCED-BASELINE WALK-FORWARD OOS FIT — SAF (DB-SİZ) ÇEKİRDEK KÜTÜPHANE.
// 2026-10-11 kullanıcı talebi. Yeni optimizer/regularization İCAT EDİLMEDİ — fit,
// src/lib/v5461/conditional-logit.ts'teki fitConditionalLogit'i DOĞRUDAN import edip
// kullanıyor (DEĞİŞTİRİLMEMİŞ). Standardizasyon/softmax/skorlama production bandeNoktala
// sözleşmesiyle birebir (bkz. oos-fold-manifest.json → fitSemantics).
import { fitConditionalLogit, type TrainingRunner } from "../../src/lib/v5461/conditional-logit";
import { softmax } from "../../src/lib/v5461/math";

export type Chal = { raw: number | null; observed: boolean; reliability: number };
export type FeatureRow = { raceId: string; runnerId: string; win: boolean; challengers: Record<string, Chal> };

export type MuSigma = { mu: number; sigma: number; observedCount: number; degenerate: boolean; degenerateReason: string | null };

const MIN_OBSERVED_FOR_STANDARDIZATION = 5;

/** TRAIN + observed=true satırlarından μ/σ — TEST'in hiçbir satırı buraya GİRMEZ (çağıran
 *  yalnız train satırlarını vermeli). σ=0 veya observedCount<5 ise degenerate=true. */
export function computeStandardization(trainRows: FeatureRow[], featureNames: string[]): Map<string, MuSigma> {
  const result = new Map<string, MuSigma>();
  for (const name of featureNames) {
    const vals: number[] = [];
    for (const r of trainRows) {
      const c = r.challengers[name];
      if (c?.observed && c.raw != null) vals.push(c.raw);
    }
    if (vals.length < MIN_OBSERVED_FOR_STANDARDIZATION) {
      result.set(name, { mu: 0, sigma: 0, observedCount: vals.length, degenerate: true, degenerateReason: `observedCount=${vals.length} < ${MIN_OBSERVED_FOR_STANDARDIZATION}` });
      continue;
    }
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mu) ** 2, 0) / vals.length;
    const sigma = Math.sqrt(variance);
    if (sigma < 1e-9) {
      result.set(name, { mu, sigma: 0, observedCount: vals.length, degenerate: true, degenerateReason: "sigma≈0" });
      continue;
    }
    result.set(name, { mu, sigma, observedCount: vals.length, degenerate: false, degenerateReason: null });
  }
  return result;
}

/** X_ij = reliability_ij × z_ij (observed=false veya feature degenerate → 0, z hesaplanmaz).
 *  Production bandeNoktala'yla birebir aynı semantik. */
export function featureVector(row: FeatureRow, featureNames: string[], muSigma: Map<string, MuSigma>): number[] {
  return featureNames.map((name) => {
    const ms = muSigma.get(name)!;
    if (ms.degenerate) return 0;
    const c = row.challengers[name];
    if (!c?.observed || c.raw == null) return 0;
    const z = (c.raw - ms.mu) / ms.sigma;
    return c.reliability * z;
  });
}

export type RaceGroup = { raceId: string; runners: TrainingRunner[] };
export type RaceBuildResult = { races: RaceGroup[]; excludedRaces: { raceId: string; reason: string }[] };

/** Satırları raceId'ye göre gruplar, TrainingRunner'a çevirir. ≥2 runner + tam 1 kazanan
 *  şartını sağlamayan race'ler EXCLUDE edilir + sayılır/raporlanır (sessiz düzeltme YOK). */
export function buildRaces(rows: FeatureRow[], featureNames: string[], muSigma: Map<string, MuSigma>): RaceBuildResult {
  const byRace = new Map<string, FeatureRow[]>();
  for (const r of rows) { const a = byRace.get(r.raceId) ?? []; a.push(r); byRace.set(r.raceId, a); }
  const races: RaceGroup[] = [];
  const excludedRaces: { raceId: string; reason: string }[] = [];
  for (const [raceId, rs] of byRace) {
    if (rs.length < 2) { excludedRaces.push({ raceId, reason: `runnerCount=${rs.length}<2` }); continue; }
    const winners = rs.filter((r) => r.win);
    if (winners.length !== 1) { excludedRaces.push({ raceId, reason: `winnerCount=${winners.length}≠1` }); continue; }
    races.push({
      raceId,
      runners: rs.map((r) => ({ raceId: r.raceId, runnerId: r.runnerId, winner: r.win, features: featureVector(r, featureNames, muSigma) })),
    });
  }
  return { races, excludedRaces };
}

export type FitResult = { beta: number[]; converged: boolean; convergedBy: "NLL_STABILITY" | "NOT_CONVERGED"; finalGradNorm: number; nllAtHalf: number; nllAtFull: number; nllDelta: number; iterations: number };

const LAMBDA = 0.1; // ridge — proje kuralı: {0,0.01,0.1,1} ön-kayıtlı grid'inden, bu OOS'ta sabit 0.1 (proje geçmişindeki "λ=0.1" konvansiyonuyla tutarlı, OOS SONUCUNA bakıp AYARLANMADI)
// 2026-10-11 — SMOKE TEST BULGUSU (scripts/v5461-audit/diag-lr.mts, silinmedi, kanıt
// olarak kalıcı): learningRate=2.0 İLE fit DIVERGE ediyordu (NLL 2.205→4.391'e çıkıp
// orada kalıyordu — AGF üçlüsünün (agfSirasi/agfPayi/agfPayi2) neredeyse kolinear olması
// nedeniyle ill-conditioned bir yönde aşırı adım). 0.5/0.1/0.05/0.01 öğrenme oranlarının
// HEPSİ AYNI optimuma (NLL≈1.744) yakınsadığı doğrulandı — bu GERÇEK yakınsama kanıtı
// (konveks problem, farklı adım boylarından AYNI noktaya inmek tesadüf değil). 0.1 seçildi
// (hız/stabilite dengesi). Algoritmanın KENDİSİ (fitConditionalLogit, src/lib/v5461/
// conditional-logit.ts) DEĞİŞMEDİ — yalnız adım-boyu hiperparametresi smoke-test ile
// doğrulanmış, yakınsayan bir değere düzeltildi (yeni optimizer İCAT EDİLMEDİ).
const LEARNING_RATE = 0.1;
const MAX_ITERATIONS = 4000;
// 2026-10-11 — İKİNCİ SMOKE-TEST BULGUSU (diag-lr.mts, silinmedi): lr=0.1 ile NLL 6
// ondalığa kadar KESİN sabitleniyor (1.745509@500iter → 1.743813@8000iter, Δ<0.002) AMA
// ||gradyan|| küçülmek yerine YAVAŞÇA BÜYÜYOR (0.217→0.284). Kök neden: agfSirasi/agfPayi/
// agfPayi2 NEREDEYSE kolinear (agfPayi2=agfPayi², agfSirasi agfPayi'nin sıralama-dönüşümü)
// — kayıp yüzeyinin bu üçlünün "null yönü"nde eğriliği (Hessian) neredeyse sıfıra yakın,
// yalnız ridge terimi (2λ) orada eğrilik sağlıyor, bu da o yönde yakınsamayı ASTRONOMİK
// derecede yavaşlatıyor (β o yönde pratik anlamda ÖNEMSİZ ama SIFIRA inmeyen bir hızla
// sürükleniyor). ||gradyan||<1e-3 kriteri bu yüzden PRATİKTE ULAŞILAMAZ bir hedef —
// optimizer'ın kendisi BOZUK değil (NLL doğru/istikrarlı yakınsıyor), yalnız ||gradyan||
// bu veri geometrisinde yakınsama SİNYALİ olarak GÜVENİLMEZ. Yeni optimizer İCAT ETMEK
// YERİNE (yasak), yakınsama kriteri NLL-stabilitesine (opts.iterations/2 vs opts.iterations,
// FRESH/prior'suz iki çağrı) dayandırıldı — ||gradyan|| hâlâ RAPORLANIYOR (şeffaflık için)
// ama PASS/FAIL kapısı değil.
const NLL_STABILITY_TOLERANCE = 1e-3;

function totalNll(races: RaceGroup[], beta: number[]): number {
  let s = 0;
  for (const race of races) {
    const probs = softmax(race.runners.map((r) => dotProd(r.features, beta)));
    const w = race.runners.findIndex((r) => r.winner);
    s += -Math.log(Math.max(probs[w], 1e-15));
  }
  return s / Math.max(1, races.length);
}
function dotProd(a: number[], b: number[]): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

/** src/lib/v5461/conditional-logit.ts'in fitConditionalLogit'ini DEĞİŞTİRMEDEN, İKİ KEZ
 *  (prior'SUZ, sıfır-başlangıçlı — opts.iterations/2 ve opts.iterations) çağırır. Chunk'lar
 *  arası prior:beta AKTARMAK YANLIŞTI (bkz. yukarıdaki not — prior, fitConditionalLogit'te
 *  ridge-shrinkage HEDEFİ, warm-start DEĞİL) — bu yüzden artık İKİ BAĞIMSIZ/FRESH çağrı
 *  yapılıyor ve NLL farkına bakılıyor (konverjans sinyali ||gradyan|| DEĞİL, NLL-stabilitesi
 *  — yukarıdaki not). */
export function fitWithConvergenceCheck(races: RaceGroup[], featureCount: number): FitResult {
  const trainingRunners: TrainingRunner[][] = races.map((r) => r.runners);
  const half = Math.floor(MAX_ITERATIONS / 2);
  const betaHalf = fitConditionalLogit(trainingRunners, featureCount, { lambda: LAMBDA, learningRate: LEARNING_RATE, iterations: half });
  const betaFull = fitConditionalLogit(trainingRunners, featureCount, { lambda: LAMBDA, learningRate: LEARNING_RATE, iterations: MAX_ITERATIONS });
  const nllAtHalf = totalNll(races, betaHalf);
  const nllAtFull = totalNll(races, betaFull);
  const nllDelta = Math.abs(nllAtHalf - nllAtFull);

  let gradNormSq = 0;
  {
    const g = Array(featureCount).fill(0);
    for (const race of races) {
      const probs = softmax(race.runners.map((r) => dotProd(r.features, betaFull)));
      for (let i = 0; i < race.runners.length; i++) {
        const err = probs[i] - (race.runners[i].winner ? 1 : 0);
        for (let j = 0; j < featureCount; j++) g[j] += err * race.runners[i].features[j];
      }
    }
    const scale = 1 / Math.max(1, races.length);
    for (let j = 0; j < featureCount; j++) { const gj = g[j] * scale + 2 * LAMBDA * betaFull[j]; gradNormSq += gj * gj; }
  }
  const finalGradNorm = Math.sqrt(gradNormSq);
  const converged = nllDelta < NLL_STABILITY_TOLERANCE;
  return {
    beta: betaFull,
    converged,
    convergedBy: converged ? "NLL_STABILITY" : "NOT_CONVERGED",
    finalGradNorm, nllAtHalf, nllAtFull, nllDelta,
    iterations: MAX_ITERATIONS,
  };
}

export type RaceEval = {
  raceId: string;
  logLoss: number;
  brier: number;
  winnerRank: number; // 1-based
  winnerInTop1: boolean;
  winnerInTop3: boolean;
  winnerInTop6: boolean;
  reciprocalRank: number;
};

export function evaluateRaces(races: RaceGroup[], beta: number[]): RaceEval[] {
  return races.map((race) => {
    const scores = race.runners.map((r) => dotProd(r.features, beta));
    const probs = softmax(scores);
    const wIdx = race.runners.findIndex((r) => r.winner);
    const logLoss = -Math.log(Math.max(probs[wIdx], 1e-15));
    const brier = probs.reduce((s, p, i) => s + (p - (race.runners[i].winner ? 1 : 0)) ** 2, 0);
    const order = [...probs.keys()].sort((a, b) => probs[b] - probs[a]);
    const winnerRank = order.indexOf(wIdx) + 1;
    return {
      raceId: race.raceId,
      logLoss,
      brier,
      winnerRank,
      winnerInTop1: winnerRank <= 1,
      winnerInTop3: winnerRank <= 3,
      winnerInTop6: winnerRank <= 6,
      reciprocalRank: 1 / winnerRank,
    };
  });
}

export type PairedDelta = { raceId: string; dateKey: string; deltaLogLoss: number; deltaBrier: number; challengerLogLoss: number; baselineLogLoss: number };

/** Paired bootstrap CI — race-level (her race'i kendi birimi olarak resample eder) VEYA
 *  day-cluster-level (her günü birimi olarak resample eder, o günün TÜM race'lerini birlikte alır). */
export function pairedBootstrapCI(deltas: PairedDelta[], mode: "race" | "day", nBoot = 2000, seed = 42): { mean: number; lower: number; upper: number; nBoot: number } {
  if (deltas.length === 0) return { mean: 0, lower: 0, upper: 0, nBoot: 0 };
  let rngState = seed;
  const rng = () => { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const pointEstimate = mean(deltas.map((d) => d.deltaLogLoss));

  const means: number[] = [];
  if (mode === "race") {
    const n = deltas.length;
    for (let b = 0; b < nBoot; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += deltas[Math.floor(rng() * n)].deltaLogLoss;
      means.push(s / n);
    }
  } else {
    const byDay = new Map<string, number[]>();
    for (const d of deltas) { const a = byDay.get(d.dateKey) ?? []; a.push(d.deltaLogLoss); byDay.set(d.dateKey, a); }
    const days = [...byDay.keys()];
    for (let b = 0; b < nBoot; b++) {
      const sampledVals: number[] = [];
      for (let i = 0; i < days.length; i++) {
        const day = days[Math.floor(rng() * days.length)];
        sampledVals.push(...byDay.get(day)!);
      }
      means.push(mean(sampledVals));
    }
  }
  means.sort((a, b) => a - b);
  const lower = means[Math.floor(0.025 * nBoot)];
  const upper = means[Math.min(nBoot - 1, Math.ceil(0.975 * nBoot))];
  return { mean: pointEstimate, lower, upper, nBoot };
}

export function classify(raceCI: { lower: number; upper: number }, dayCI: { lower: number; upper: number }): "PASS" | "WORSE" | "INCONCLUSIVE" {
  if (raceCI.upper < 0 && dayCI.upper < 0) return "PASS";
  if (raceCI.lower > 0 && dayCI.lower > 0) return "WORSE";
  return "INCONCLUSIVE";
}
