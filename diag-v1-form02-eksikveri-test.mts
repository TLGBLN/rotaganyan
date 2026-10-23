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

  function merged(id: string): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return { raceId: id, date: o.date, winnerNo: o.winnerNo, runners: o.runners.map((rr) => {
      const fNew = f.runners.find((x) => x.no === rr.no);
      const signals = rr.vectors.map((s) => ([...DAV_CODES, ...GEN_CODES].includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
      return { no: rr.no, name: rr.name, vectors: signals };
    })};
  }
  const trainE = lock.trainRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  const holdoutE = lock.holdoutRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  let miss=0, tot=0; for (const race of trainE) for (const r of race.runners) { tot++; const s=r.vectors.find(x=>x.code==="FORM_02"); if(!s?.observed) miss++; }
  console.log(`FORM_02 gozlemsiz (TRAIN): ${miss}/${tot} (%${(100*miss/tot).toFixed(1)})`);

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
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, codes: string[], forceZero: Set<string>): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      vec.push(observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0);
      vec.push(observed ? 0 : (forceZero.has(code) ? 0 : 1));
    }
    return vec;
  }
  function toTR(races: CacheRace[], stats: Map<string, StatsEntry>, codes: string[], forceZero: Set<string>): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of races) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => { const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }; return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, codes, forceZero) }; });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, n = 0;
    for (const race of races) { const scores = race.map((r) => dot(r.features, beta)); const p = softmax(scores); const winIdx = race.findIndex((r) => r.winner); const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]); ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; n++; }
    return { ll: ll / n, top1: top1 / n, n };
  }
  const trainSorted = [...trainE].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFitIds = new Set(trainSorted.slice(0, trainSorted.length - cvValSize).map((r) => r.raceId));
  const cvFit = trainE.filter((r) => cvFitIds.has(r.raceId));
  const cvVal = trainE.filter((r) => !cvFitIds.has(r.raceId));
  console.log(`\n=== TRAIN-ici kronolojik CV: FORM_02 eksik-veri katkisi ===`);
  for (const [label, fz] of [["BASELINE (+0.067 benzeri ogrenilmis ceza aktif)", new Set<string>()], ["FORM_02 eksik-katki KALDIRILDI", new Set(["FORM_02"])]] as const) {
    const stats = computeStats(cvFit, allCodes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, allCodes, fz), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, allCodes, fz), beta);
    console.log(`  ${label}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
