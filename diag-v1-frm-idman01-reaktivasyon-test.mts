// ROTAGANYAN V1.0 — FRM IYILESTIRMESI: IDMAN_01'in GERCEK kapsamini olc, yeterliyse
// TRAIN-ici kronolojik CV ile EK (37.) bir ozellik olarak deneysel test et. Yeterli degilse
// egitim disinda birakilmasi dogrulanir (neden acikca kaydedilir).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { computeIdman01, loadGalopPaceIndex } from "./src/lib/motor-v1/features/idman-galop";
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
  const baseCodes = [...currentModel.stats.keys()].filter((c) => !TMP_DROP.includes(c)); // E referansi (36)
  const allCodesIDMAN = [...baseCodes, "IDMAN_01"]; // 37

  const paceIndex = await loadGalopPaceIndex();

  async function idman01ForRace(raceId: string): Promise<Map<number, { value: number | null; observed: boolean }>> {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, gallops: { select: { date: true, splits: true } } } } },
    });
    const out = new Map<number, { value: number | null; observed: boolean }>();
    if (!race) return out;
    for (const r of race.runners) {
      const res = computeIdman01(r.gallops, race.raceDay.date, paceIndex);
      out.set(r.no, { value: res.value, observed: res.observed });
    }
    return out;
  }

  console.log("IDMAN_01 TRAIN+HOLDOUT icin hesaplaniyor (150 yaris, canli DB)...");
  const idmanByRace: Record<string, Map<number, { value: number | null; observed: boolean }>> = {};
  let totalRunner = 0, observedRunner = 0;
  for (const id of [...lock.trainRaceIds, ...lock.holdoutRaceIds]) {
    idmanByRace[id] = await idman01ForRace(id);
    for (const v of idmanByRace[id].values()) { totalRunner++; if (v.observed) observedRunner++; }
  }
  console.log(`Gercek kapsam (TRAIN+HOLDOUT, 150 yaris): ${observedRunner}/${totalRunner} (%${(100*observedRunner/totalRunner).toFixed(1)}) gozlemli`);
  console.log(`(NOT: production excludedCodes metadata'sinda %5.99 kayitliydi — bu FARKLI/daha genis bir TRAIN orneklemiyle olculmus olabilir, kesin kaynagi dogrulanamadi — burada KENDI 150-yarislik kilitli setimizle TAZE olculdu)`);

  function merged(id: string): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    const idmanMap = idmanByRace[id];
    return {
      raceId: id, date: o.date, winnerNo: o.winnerNo,
      runners: o.runners.map((rr) => {
        const fNew = f.runners.find((x) => x.no === rr.no);
        const signals: SignalEntry[] = o.runners.find((x)=>x.no===rr.no)!.vectors.map((s) => ([...DAV_CODES, ...GEN_CODES].includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
        const idm = idmanMap.get(rr.no);
        signals.push({ code: "IDMAN_01", family: "FRM", rawValue: idm?.observed ? idm.value : null, observed: !!idm?.observed } as unknown as SignalEntry);
        return { no: rr.no, name: rr.name, vectors: signals };
      }),
    };
  }
  const trainData = lock.trainRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  const holdoutData = lock.holdoutRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN: ${trainData.length}/120  HOLDOUT: ${holdoutData.length}/30`);

  type StatsEntry = { mu: number; sigma: number };
  function computeStats(races: CacheRace[], codes: string[]): Map<string, StatsEntry> {
    const stats = new Map<string, StatsEntry>();
    for (const code of codes) {
      const values: number[] = [];
      for (const race of races) for (const r of race.runners) {
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
  function toTR(races: CacheRace[], stats: Map<string, StatsEntry>, codes: string[]): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of races) {
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
      ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; if (ranked.slice(0,3).includes(winIdx)) top3++; n++;
    }
    return { ll: ll / n, top1: top1 / n, top3: top3/n, n };
  }

  const trainSorted = [...trainData].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFitIds = new Set(trainSorted.slice(0, trainSorted.length - cvValSize).map((r) => r.raceId));
  const cvFit = trainData.filter((r) => cvFitIds.has(r.raceId));
  const cvVal = trainData.filter((r) => !cvFitIds.has(r.raceId));

  console.log(`\n=== TRAIN-ici kronolojik CV: IDMAN_01 reaktivasyonu ===`);
  for (const [label, codes] of [["BASELINE (IDMAN_01 YOK, 36 kod)", baseCodes], ["IDMAN_01 EKLENDI (37 kod)", allCodesIDMAN]] as const) {
    const stats = computeStats(cvFit, codes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, codes), codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, codes), beta);
    console.log(`  ${label}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
  }

  // Tam TRAIN: E (36) vs FRM-deneysel (37, IDMAN_01 eklenmis)
  const statsE = computeStats(trainData, baseCodes);
  const betaE = fitConditionalLogit(toTR(trainData, statsE, baseCodes), baseCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  const statsFRM = computeStats(trainData, allCodesIDMAN);
  const betaFRM = fitConditionalLogit(toTR(trainData, statsFRM, allCodesIDMAN), allCodesIDMAN.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });

  function scoreModel(race: CacheRace, stats: Map<string, StatsEntry>, beta: number[], codes: string[]) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, stats, codes));
    const scores = vecs.map((v) => dot(v, beta));
    const probs = softmax(scores);
    return { vectors, probs };
  }
  function evalPair(races: CacheRace[], label: string) {
    let llE=0, llF=0, top1E=0, top1F=0, top3E=0, top3F=0, n=0, iyilesen=0, kotulesen=0;
    for (const race of races) {
      if (race.winnerNo == null) continue;
      const { vectors: ve, probs: pe } = scoreModel(race, statsE, betaE, baseCodes);
      const { vectors: vf, probs: pf } = scoreModel(race, statsFRM, betaFRM, allCodesIDMAN);
      const winIdxE = ve.findIndex((v) => v.no === race.winnerNo), winIdxF = vf.findIndex((v) => v.no === race.winnerNo);
      if (winIdxE < 0 || winIdxF < 0) continue;
      const rankedE = ve.map((v,j)=>({no:v.no,p:pe[j]})).sort((a,b)=>b.p-a.p);
      const rankedF = vf.map((v,j)=>({no:v.no,p:pf[j]})).sort((a,b)=>b.p-a.p);
      const llEr=logLoss(pe[winIdxE]), llFr=logLoss(pf[winIdxF]);
      llE+=llEr; llF+=llFr; n++;
      if (rankedE[0].no===race.winnerNo) top1E++; if (rankedF[0].no===race.winnerNo) top1F++;
      if (rankedE.slice(0,3).some((r)=>r.no===race.winnerNo)) top3E++; if (rankedF.slice(0,3).some((r)=>r.no===race.winnerNo)) top3F++;
      if (llFr < llEr - 0.01) iyilesen++; else if (llFr > llEr + 0.01) kotulesen++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  E (IDMAN_01 yok):   Top1=%${(top1E/n*100).toFixed(1)} Top3=%${(top3E/n*100).toFixed(1)} LogLoss=${(llE/n).toFixed(4)}`);
    console.log(`  FRM (IDMAN_01 var): Top1=%${(top1F/n*100).toFixed(1)} Top3=%${(top3F/n*100).toFixed(1)} LogLoss=${(llF/n).toFixed(4)}`);
    console.log(`  E->FRM: iyilesen=${iyilesen} kotulesen=${kotulesen} degismeyen=${n-iyilesen-kotulesen}`);
  }
  evalPair(trainData, "TRAIN(120)");
  evalPair(holdoutData, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
