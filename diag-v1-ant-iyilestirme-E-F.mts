// ROTAGANYAN V1.0 — ANT IYILESTIRMESI (10. VE SON AILE). Tek somut aday: ANT_TREND_SHRINKAGE_K
// (ant-trainer.ts'te "GECICI" diye isaretli, K=15 sabit, JOKEY_TREND30'dan kopyalanmis) —
// KILO_02 ornegindeki ayni disiplinle TRAIN-ici kronolojik CV ile test edilir. Kimlik
// eslestirme (Runner.trainer TAM string, tek kaynak) VE ANT_FRM_01 esit-bolustur (1/2) daha
// once diag-v1-ant-kok-neden-incelemesi.mts'te DOGRULANDI — burada TEKRAR EDILMIYOR.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { computeAntrenorTrend30 } from "./src/lib/motor-v1/features/ant-trainer";
import { shrinkageFactor } from "./src/lib/motor-v1/features/common";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];
const TMP_DROP = ["TEMPO_01", "TEMPO_03"];
const K_ADAYLARI = [2, 4, 8, 15, 30, 50, 100, 300, 1000];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const allCodes = [...currentModel.stats.keys()].filter((c) => !TMP_DROP.includes(c));

  // ANT_TREND30'u K adaylariyla CANLI DB'den yeniden hesapla (rawTrend + min(n1,n2) edin,
  // shrink'i burada farkli K'larla uygula). ANT_FRM_01 iliskisel kodu da BU rawValue uzerine
  // yeniden kurulur (form02 orijinal cache'ten rawValue'su ile).
  const allIds = [...lock.trainRaceIds, ...lock.holdoutRaceIds];
  const antRawByRace: Record<string, Record<number, { rawTrend: number | null; combinedN: number }>> = {};
  for (const raceId of allIds) {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, trainer: true } } },
    });
    if (!race) continue;
    antRawByRace[raceId] = {};
    for (const r of race.runners) {
      const res = await computeAntrenorTrend30(r.trainer ?? null, race.raceDay.date);
      const combinedN = Math.min(res.son30.observed, res.onceki30.observed);
      antRawByRace[raceId][r.no] = { rawTrend: res.rawTrend, combinedN };
    }
  }
  console.log(`ANT_TREND30 yeniden hesaplandi: ${Object.keys(antRawByRace).length}/${allIds.length} yaris.`);

  function mergedBase(id: string): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return { raceId: id, date: o.date, winnerNo: o.winnerNo, runners: o.runners.map((rr) => {
      const fNew = f.runners.find((x) => x.no === rr.no);
      const signals = rr.vectors.map((s) => ([...DAV_CODES, ...GEN_CODES].includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
      return { no: rr.no, name: rr.name, vectors: signals };
    })};
  }
  function withAntK(base: CacheRace, k: number): CacheRace {
    return { ...base, runners: base.runners.map((r) => {
      const entry = antRawByRace[base.raceId]?.[r.no];
      const rawTrend = entry?.rawTrend ?? null;
      const shrunk = rawTrend == null ? null : (k >= 999999 ? rawTrend : shrinkageFactor(entry!.combinedN, k) * rawTrend);
      const signals = r.vectors.map((s) => {
        if (s.code === "ANT_TREND30") return { ...s, rawValue: shrunk, observed: shrunk != null };
        if (s.code === "ANT_FRM_01") {
          const form02 = r.vectors.find((x) => x.code === "FORM_02");
          const form02v = form02?.observed ? form02.rawValue : null;
          const prod = shrunk == null || form02v == null ? null : shrunk * form02v;
          return { ...s, rawValue: prod, observed: prod != null };
        }
        return s;
      });
      return { ...r, vectors: signals };
    })};
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

  const trainSorted = [...trainBase].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFitIds = new Set(trainSorted.slice(0, trainSorted.length - cvValSize).map((r) => r.raceId));
  console.log(`\n=== TRAIN-ici kronolojik CV: ANT_TREND_SHRINKAGE_K adaylari ===`);
  let best = { k: 999999, ll: Infinity };
  for (const k of [999999, ...K_ADAYLARI]) {
    const cvFit = trainBase.filter((r) => cvFitIds.has(r.raceId)).map((r) => withAntK(r, k));
    const cvVal = trainBase.filter((r) => !cvFitIds.has(r.raceId)).map((r) => withAntK(r, k));
    const stats = computeStats(cvFit, allCodes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, allCodes), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, allCodes), beta);
    console.log(`  K=${k === 999999 ? "ESKI(shrinkage=15,sabit)" : k}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
    if (val.ll < best.ll) best = { k, ll: val.ll };
  }
  console.log(`\nSECILEN: K=${best.k === 999999 ? "ESKI(K=15)" : best.k} (val LogLoss=${best.ll.toFixed(4)})`);

  const kEski = 15; // mevcut production sabiti, "ESKI" referans olarak budur (shrink YOK degil!)
  const trainE = trainBase.map((r) => withAntK(r, kEski));
  const trainF = trainBase.map((r) => withAntK(r, best.k));
  const holdoutE = holdoutBase.map((r) => withAntK(r, kEski));
  const holdoutF = holdoutBase.map((r) => withAntK(r, best.k));
  const statsE = computeStats(trainE, allCodes);
  const betaE = fitConditionalLogit(toTR(trainE, statsE, allCodes), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  const statsF = computeStats(trainF, allCodes);
  const betaF = fitConditionalLogit(toTR(trainF, statsF, allCodes), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });

  function scoreModel(race: CacheRace, stats: Map<string, StatsEntry>, beta: number[]) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, stats, allCodes));
    const scores = vecs.map((v) => dot(v, beta));
    return { vectors, probs: softmax(scores) };
  }
  function evalPair(racesE: CacheRace[], racesF: CacheRace[], label: string) {
    let llE=0, llF=0, top1E=0, top1F=0, top3E=0, top3F=0, n=0, iyilesen=0, kotulesen=0;
    for (let i = 0; i < racesE.length; i++) {
      const re = racesE[i], rf = racesF[i];
      if (re.winnerNo == null) continue;
      const { vectors: ve, probs: pe } = scoreModel(re, statsE, betaE);
      const { vectors: vf, probs: pf } = scoreModel(rf, statsF, betaF);
      const winIdxE = ve.findIndex((v) => v.no === re.winnerNo), winIdxF = vf.findIndex((v) => v.no === re.winnerNo);
      if (winIdxE < 0 || winIdxF < 0) continue;
      const rankedE = ve.map((v,j)=>({no:v.no,p:pe[j]})).sort((a,b)=>b.p-a.p);
      const rankedF = vf.map((v,j)=>({no:v.no,p:pf[j]})).sort((a,b)=>b.p-a.p);
      const llEr=logLoss(pe[winIdxE]), llFr=logLoss(pf[winIdxF]);
      llE+=llEr; llF+=llFr; n++;
      if (rankedE[0].no===re.winnerNo) top1E++; if (rankedF[0].no===re.winnerNo) top1F++;
      if (rankedE.slice(0,3).some((r)=>r.no===re.winnerNo)) top3E++; if (rankedF.slice(0,3).some((r)=>r.no===re.winnerNo)) top3F++;
      if (llFr < llEr - 0.01) iyilesen++; else if (llFr > llEr + 0.01) kotulesen++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  E (ANT_TREND30 shrinkage K=15, mevcut): Top1=%${(top1E/n*100).toFixed(1)} Top3=%${(top3E/n*100).toFixed(1)} LogLoss=${(llE/n).toFixed(4)}`);
    console.log(`  F (ANT_TREND30 shrinkage K=${best.k}): Top1=%${(top1F/n*100).toFixed(1)} Top3=%${(top3F/n*100).toFixed(1)} LogLoss=${(llF/n).toFixed(4)}`);
    console.log(`  E->F: iyilesen=${iyilesen} kotulesen=${kotulesen} degismeyen=${n-iyilesen-kotulesen}`);
  }
  evalPair(trainE, trainF, "TRAIN(120)");
  evalPair(holdoutE, holdoutF, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
