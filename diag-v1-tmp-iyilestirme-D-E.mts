// ROTAGANYAN V1.0 — TMP IYILESTIRMESI. Referans: D modeli (DAV+GEN duzeltilmis, digerleri
// ESKI). TEMPO_01/TEMPO_03'un (ayni styleVector kaynagindan, r=0.79 korelasyonlu) HER BIRININ
// GERCEKTEN ek tahmin degeri tasiyip tasimadigi TRAIN-ici KRONOLOJIK CV ile test edilir —
// korelasyon VAR diye otomatik silinmiyor. 4 aday: ikisi de VAR (baseline), TEMPO_03 YOK,
// TEMPO_01 YOK, ikisi de YOK. HOLDOUT'a GORE SECIM YAPILMAZ.
import fs from "node:fs";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const allCodes = [...currentModel.stats.keys()]; // 38 kod (DAV+GEN iceren D referansi)

  function merged(id: string): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return {
      raceId: id, date: o.date, winnerNo: o.winnerNo,
      runners: o.runners.map((rr) => {
        const fNew = f.runners.find((x) => x.no === rr.no);
        const signals = rr.vectors.map((s) => ([...DAV_CODES, ...GEN_CODES].includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
        return { no: rr.no, name: rr.name, vectors: signals };
      }),
    };
  }
  const trainD = lock.trainRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  const holdoutD = lock.holdoutRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN(D): ${trainD.length}/120  HOLDOUT(D): ${holdoutD.length}/30`);

  type StatsEntry = { mu: number; sigma: number };
  function computeStats(racesSubset: CacheRace[], codes: string[]): Map<string, StatsEntry> {
    const stats = new Map<string, StatsEntry>();
    for (const code of codes) {
      const values: number[] = [];
      for (const race of racesSubset) for (const r of race.runners) {
        const s = r.vectors.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null && Number.isFinite(s.rawValue)) values.push(s.rawValue);
      }
      if (values.length < 2) { stats.set(code, { mu: 0, sigma: 1 }); continue; }
      const mu = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
      stats.set(code, { mu, sigma: Math.sqrt(variance) || 1 });
    }
    return stats;
  }
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, codes: string[]): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      const z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      vec.push(z); vec.push(observed ? 0 : 1);
    }
    return vec;
  }
  function toTR(racesSubset: CacheRace[], stats: Map<string, StatsEntry>, codes: string[]): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of racesSubset) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, codes) };
      });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    for (const race of races) {
      const scores = race.map((r) => dot(r.features, beta));
      const p = softmax(scores);
      const winIdx = race.findIndex((r) => r.winner);
      const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]);
      ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; if (ranked.slice(0, 3).includes(winIdx)) top3++; n++;
    }
    return { ll: ll / n, top1: top1 / n, top3: top3 / n, n };
  }

  // ====== TRAIN-ici kronolojik CV: 4 aday kod-kumesi ======
  const trainSorted = [...trainD].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFit = trainSorted.slice(0, trainSorted.length - cvValSize);
  const cvVal = trainSorted.slice(trainSorted.length - cvValSize);

  const ADAYLAR: { ad: string; drop: string[] }[] = [
    { ad: "BASELINE (TEMPO_01+03 ikisi de VAR)", drop: [] },
    { ad: "TEMPO_03 CIKARILDI", drop: ["TEMPO_03"] },
    { ad: "TEMPO_01 CIKARILDI", drop: ["TEMPO_01"] },
    { ad: "IKISI DE CIKARILDI", drop: ["TEMPO_01", "TEMPO_03"] },
  ];
  console.log(`\n=== TRAIN-ici kronolojik CV: TMP redundancy adaylari ===`);
  let best: { drop: string[]; ll: number; ad: string } = { drop: [], ll: Infinity, ad: "" };
  for (const aday of ADAYLAR) {
    const codes = allCodes.filter((c) => !aday.drop.includes(c));
    const stats = computeStats(cvFit, codes);
    const fitR = toTR(cvFit, stats, codes);
    const valR = toTR(cvVal, stats, codes);
    const beta = fitConditionalLogit(fitR, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(valR, beta);
    console.log(`  ${aday.ad}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
    if (val.ll < best.ll) best = { drop: aday.drop, ll: val.ll, ad: aday.ad };
  }
  console.log(`\nSECILEN: ${best.ad} (val LogLoss=${best.ll.toFixed(4)})`);

  // ====== Tam TRAIN(120) uzerinde D (baseline, drop=[]) ve E (secilen) yeniden egitimi ======
  const codesD = allCodes;
  const statsD = computeStats(trainD, codesD);
  const betaD = fitConditionalLogit(toTR(trainD, statsD, codesD), codesD.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });

  const codesE = allCodes.filter((c) => !best.drop.includes(c));
  const statsE = computeStats(trainD, codesE);
  const betaE = fitConditionalLogit(toTR(trainD, statsE, codesE), codesE.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  console.log(`\nD ve E egitildi. codesD=${codesD.length} codesE=${codesE.length}`);

  function scoreModel(race: CacheRace, codes: string[], stats: Map<string, StatsEntry>, beta: number[]) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, stats, codes));
    const scores = vecs.map((v) => dot(v, beta));
    const probs = softmax(scores);
    return { vectors, probs };
  }

  function evalPair(races: CacheRace[], label: string) {
    let llD = 0, llE = 0, top1D = 0, top1E = 0, top3D = 0, top3E = 0, n = 0, iyilesen = 0, kotulesen = 0;
    for (const race of races) {
      if (race.winnerNo == null) continue;
      const { vectors: vd, probs: pd } = scoreModel(race, codesD, statsD, betaD);
      const { vectors: ve, probs: pe } = scoreModel(race, codesE, statsE, betaE);
      const winIdxD = vd.findIndex((v) => v.no === race.winnerNo);
      const winIdxE = ve.findIndex((v) => v.no === race.winnerNo);
      if (winIdxD < 0 || winIdxE < 0) continue;
      const rankedD = vd.map((v, j) => ({ no: v.no, p: pd[j] })).sort((a, b) => b.p - a.p);
      const rankedE = ve.map((v, j) => ({ no: v.no, p: pe[j] })).sort((a, b) => b.p - a.p);
      const llDr = logLoss(pd[winIdxD]), llEr = logLoss(pe[winIdxE]);
      llD += llDr; llE += llEr; n++;
      if (rankedD[0].no === race.winnerNo) top1D++; if (rankedE[0].no === race.winnerNo) top1E++;
      if (rankedD.slice(0,3).some((r)=>r.no===race.winnerNo)) top3D++; if (rankedE.slice(0,3).some((r)=>r.no===race.winnerNo)) top3E++;
      if (llEr < llDr - 0.01) iyilesen++; else if (llEr > llDr + 0.01) kotulesen++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  D (DAV+GEN):       Top1=%${(top1D/n*100).toFixed(1)} Top3=%${(top3D/n*100).toFixed(1)} LogLoss=${(llD/n).toFixed(4)}`);
    console.log(`  E (DAV+GEN+TMP):   Top1=%${(top1E/n*100).toFixed(1)} Top3=%${(top3E/n*100).toFixed(1)} LogLoss=${(llE/n).toFixed(4)}`);
    console.log(`  D->E: iyilesen=${iyilesen} kotulesen=${kotulesen} degismeyen=${n-iyilesen-kotulesen}`);
  }
  evalPair(trainD, "TRAIN(120)");
  evalPair(holdoutD, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");

  // KATI ZAMANI / KARIZMATIK ozel odak (EK setinde, tek-yaris canli duzeltmesi onceden hesaplandi)
  const katiRace = JSON.parse(fs.readFileSync("C:/tmp/kati-zamani-fixed-single.json", "utf8")) as CacheRace;
  const { vectors: vd, probs: pd } = scoreModel(katiRace, codesD, statsD, betaD);
  const { vectors: ve, probs: pe } = scoreModel(katiRace, codesE, statsE, betaE);
  const winIdxD = vd.findIndex((v) => v.no === katiRace.winnerNo), winIdxE = ve.findIndex((v) => v.no === katiRace.winnerNo);
  const rankedD = vd.map((v,j)=>({no:v.no,p:pd[j]})).sort((a,b)=>b.p-a.p), rankedE = ve.map((v,j)=>({no:v.no,p:pe[j]})).sort((a,b)=>b.p-a.p);
  console.log(`\n=== KATI ZAMANI/KARIZMATIK (${katiRace.date.slice(0,10)}) ===`);
  console.log(`  D: sira=${rankedD.findIndex((r)=>r.no===katiRace.winnerNo)+1}. %${(pd[winIdxD]*100).toFixed(2)}  ->  E: sira=${rankedE.findIndex((r)=>r.no===katiRace.winnerNo)+1}. %${(pe[winIdxE]*100).toFixed(2)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
