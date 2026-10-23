// ROTAGANYAN V1.0 — ANT gorev 3: ANT_TREND30 GOZLEMSIZLIGINDE ogrenilmis ceza (beta_missing=
// -0.220) gercekten faydali mi, yoksa gercek veri yetersizligine haksiz bir ceza mi? TRAIN-ici
// CV: "gozlemsiz -> ogrenilmis missing-beta" (mevcut) vs "gozlemsiz -> notr (z=0, sanki
// ortalama antrenor)" karsilastirilir. Mevcut onbellekteki (K=15 production) ANT_TREND30 ham
// degerleri KULLANILIR, yeniden DB hesaplama GEREKMEZ.
import fs from "node:fs";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];
const TMP_DROP = ["TEMPO_01", "TEMPO_03"];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const allCodes = [...currentModel.stats.keys()].filter((c) => !TMP_DROP.includes(c));

  function mergedBase(id: string): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return { raceId: id, date: o.date, winnerNo: o.winnerNo, runners: o.runners.map((rr) => {
      const fNew = f.runners.find((x) => x.no === rr.no);
      const signals = rr.vectors.map((s) => ([...DAV_CODES, ...GEN_CODES].includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
      return { no: rr.no, name: rr.name, vectors: signals };
    })};
  }
  // "notr" varyant: ANT_TREND30/ANT_FRM_01 gozlemsizken observed=true + rawValue=mu (z=0) yapilir
  // (asagida hesaplanan stats.mu ile) — bu, ogrenilmis missing-beta'nin DEVRE DISI birakilmasi
  // anlamina gelir (Neutraliz edilmis katki = 0, cezasiz).
  function neutralizeMissing(base: CacheRace, codes: string[], muByCode: Map<string, number>): CacheRace {
    return { ...base, runners: base.runners.map((r) => ({ ...r, vectors: r.vectors.map((s) =>
      codes.includes(s.code) && !s.observed ? { ...s, rawValue: muByCode.get(s.code) ?? 0, observed: true } : s
    ) })) };
  }

  const trainBase = lock.trainRaceIds.map(mergedBase).filter((r): r is CacheRace => !!r);
  const holdoutBase = lock.holdoutRaceIds.map(mergedBase).filter((r): r is CacheRace => !!r);

  type StatsEntry = { mu: number; sigma: number };
  function computeStats(races: CacheRace[], codes: string[]): Map<string, StatsEntry> {
    const stats = new Map<string, StatsEntry>();
    for (const code of codes) {
      const values: number[] = [];
      for (const race of races) for (const r of race.runners) { const s = r.vectors.find((x) => x.code === code); if (s?.observed && s.rawValue != null && Number.isFinite(s.rawValue)) values.push(s.rawValue); }
      if (values.length < 2) { stats.set(code, { mu: 0, sigma: 1 }); continue; }
      const mu = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
      stats.set(code, { mu, sigma: Math.sqrt(variance) || 1 });
    }
    return stats;
  }
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, codes: string[]): number[] {
    const vec: number[] = [];
    for (const code of codes) { const st = stats.get(code)!; const s = fv.signals.find((x) => x.code === code); const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue); vec.push(observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0); vec.push(observed ? 0 : 1); }
    return vec;
  }
  function toTR(races: CacheRace[], stats: Map<string, StatsEntry>, codes: string[]): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of races) { if (race.winnerNo == null || race.runners.length < 2) continue; const runners: TrainingRunner[] = race.runners.map((r) => { const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }; return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, codes) }; }); if (runners.some((r) => r.winner)) out.push(runners); }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, n = 0;
    for (const race of races) { const scores = race.map((r) => dot(r.features, beta)); const p = softmax(scores); const winIdx = race.findIndex((r) => r.winner); const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]); ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; n++; }
    return { ll: ll / n, top1: top1 / n, n };
  }

  const NEUTRALIZE_CODES = ["ANT_TREND30", "ANT_FRM_01"];
  const trainSorted = [...trainBase].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFitIds = new Set(trainSorted.slice(0, trainSorted.length - cvValSize).map((r) => r.raceId));

  console.log(`=== TRAIN-ici kronolojik CV: ANT_TREND30/_FRM_01 gozlemsizlik cezasi ===`);
  for (const variant of ["OGRENILMIS_CEZA_MEVCUT", "NOTR_CEZASIZ"] as const) {
    const cvFitRaw = trainBase.filter((r) => cvFitIds.has(r.raceId));
    const cvValRaw = trainBase.filter((r) => !cvFitIds.has(r.raceId));
    const statsForMu = computeStats(cvFitRaw, allCodes);
    const muMap = new Map(NEUTRALIZE_CODES.map((c) => [c, statsForMu.get(c)?.mu ?? 0]));
    const cvFit = variant === "NOTR_CEZASIZ" ? cvFitRaw.map((r) => neutralizeMissing(r, NEUTRALIZE_CODES, muMap)) : cvFitRaw;
    const cvVal = variant === "NOTR_CEZASIZ" ? cvValRaw.map((r) => neutralizeMissing(r, NEUTRALIZE_CODES, muMap)) : cvValRaw;
    const stats = computeStats(cvFit, allCodes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, allCodes), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, allCodes), beta);
    console.log(`  ${variant}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
