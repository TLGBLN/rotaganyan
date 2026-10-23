// ROTAGANYAN V1.0 — PMZ IYILESTIRMESI. Referans: E modeli (DAV+GEN+TMP, RAK F DEGIL —
// kullanici karari). PMZ_01/02 orneklem-buyuklugu kullanimi KOD OKUMASIYLA dogrulandi
// (shrinkageFactor zaten kullaniliyor, SINIF_01 ile AYNI disiplin — degisiklik GEREKMIYOR).
// TEK somut aday: FORM_x_ZEMIN'in sabit -0.310 eksik-veri cezasinin gercekten yardimci mi
// yoksa zararli mi oldugu, TRAIN-ici kronolojik CV ile test edilir (varsayimla degil).
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
  const allCodes = [...currentModel.stats.keys()].filter((c) => !TMP_DROP.includes(c)); // E referansi (36 kod)

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
  const trainE = lock.trainRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  const holdoutE = lock.holdoutRaceIds.map(merged).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN(E): ${trainE.length}/120  HOLDOUT(E): ${holdoutE.length}/30`);

  // FORM_x_ZEMIN gozlemsizlik orani ve coverageState kirilimi (TRAIN)
  const covCount: Record<string, number> = {};
  let totalRunner = 0, missingCount = 0;
  for (const race of trainE) for (const r of race.runners) {
    totalRunner++;
    const s = r.vectors.find((x) => x.code === "FORM_x_ZEMIN");
    if (!s?.observed) { missingCount++; covCount[s?.coverageState ?? "null"] = (covCount[s?.coverageState ?? "null"] ?? 0) + 1; }
  }
  console.log(`\nFORM_x_ZEMIN gozlemsiz: ${missingCount}/${totalRunner} (%${(100*missingCount/totalRunner).toFixed(1)})`);
  console.log(`CoverageState kirilimi (gozlemsiz olanlarda): ${JSON.stringify(covCount)}`);

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
  // forceZeroMissing: bu kod(lar)in "missing" sutunu HER ZAMAN 0 — o kodun eksik-veri
  // cezasi/odulu MODELDEN TAMAMEN CIKARILIR (ogrenilemez hale gelir), z-skor sutunu AYNI kalir.
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, codes: string[], forceZeroMissing: Set<string>): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      const z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      vec.push(z);
      vec.push(observed ? 0 : (forceZeroMissing.has(code) ? 0 : 1));
    }
    return vec;
  }
  function toTR(races: CacheRace[], stats: Map<string, StatsEntry>, codes: string[], forceZeroMissing: Set<string>): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of races) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, codes, forceZeroMissing) };
      });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, n = 0;
    for (const race of races) {
      const scores = race.map((r) => dot(r.features, beta));
      const p = softmax(scores);
      const winIdx = race.findIndex((r) => r.winner);
      const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]);
      ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; n++;
    }
    return { ll: ll / n, top1: top1 / n, n };
  }

  // ====== TRAIN-ici kronolojik CV: FORM_x_ZEMIN missing-indicator adaylari ======
  const trainSorted = [...trainE].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFitIds = new Set(trainSorted.slice(0, trainSorted.length - cvValSize).map((r) => r.raceId));
  const cvFit = trainE.filter((r) => cvFitIds.has(r.raceId));
  const cvVal = trainE.filter((r) => !cvFitIds.has(r.raceId));

  console.log(`\n=== TRAIN-ici kronolojik CV: FORM_x_ZEMIN eksik-veri cezasi ===`);
  const ADAYLAR: { ad: string; forceZero: Set<string> }[] = [
    { ad: "BASELINE (eksik-veri cezasi AKTIF)", forceZero: new Set() },
    { ad: "FORM_x_ZEMIN eksik-ceza KALDIRILDI", forceZero: new Set(["FORM_x_ZEMIN"]) },
  ];
  let best: { forceZero: Set<string>; ll: number; ad: string } = { forceZero: new Set(), ll: Infinity, ad: "" };
  for (const aday of ADAYLAR) {
    const stats = computeStats(cvFit, allCodes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, allCodes, aday.forceZero), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, allCodes, aday.forceZero), beta);
    console.log(`  ${aday.ad}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
    if (val.ll < best.ll) best = { forceZero: aday.forceZero, ll: val.ll, ad: aday.ad };
  }
  console.log(`\nSECILEN: ${best.ad} (val LogLoss=${best.ll.toFixed(4)})`);

  // ====== Tam TRAIN: E (baseline) vs PMZ-deneysel (secilen) ======
  const statsE = computeStats(trainE, allCodes);
  const betaE = fitConditionalLogit(toTR(trainE, statsE, allCodes, new Set()), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  const betaPMZ = fitConditionalLogit(toTR(trainE, statsE, allCodes, best.forceZero), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });

  function scoreModel(race: CacheRace, stats: Map<string, StatsEntry>, beta: number[], forceZero: Set<string>) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, stats, allCodes, forceZero));
    const scores = vecs.map((v) => dot(v, beta));
    const probs = softmax(scores);
    return { vectors, probs };
  }
  function evalPair(races: CacheRace[], label: string) {
    let llE = 0, llP = 0, top1E = 0, top1P = 0, top3E = 0, top3P = 0, n = 0, iyilesen = 0, kotulesen = 0;
    for (const race of races) {
      if (race.winnerNo == null) continue;
      const { vectors: ve, probs: pe } = scoreModel(race, statsE, betaE, new Set());
      const { vectors: vp, probs: pp } = scoreModel(race, statsE, betaPMZ, best.forceZero);
      const winIdxE = ve.findIndex((v) => v.no === race.winnerNo), winIdxP = vp.findIndex((v) => v.no === race.winnerNo);
      if (winIdxE < 0 || winIdxP < 0) continue;
      const rankedE = ve.map((v,j)=>({no:v.no,p:pe[j]})).sort((a,b)=>b.p-a.p);
      const rankedP = vp.map((v,j)=>({no:v.no,p:pp[j]})).sort((a,b)=>b.p-a.p);
      const llEr = logLoss(pe[winIdxE]), llPr = logLoss(pp[winIdxP]);
      llE += llEr; llP += llPr; n++;
      if (rankedE[0].no === race.winnerNo) top1E++; if (rankedP[0].no === race.winnerNo) top1P++;
      if (rankedE.slice(0,3).some((r)=>r.no===race.winnerNo)) top3E++; if (rankedP.slice(0,3).some((r)=>r.no===race.winnerNo)) top3P++;
      if (llPr < llEr - 0.01) iyilesen++; else if (llPr > llEr + 0.01) kotulesen++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  E (baseline):         Top1=%${(top1E/n*100).toFixed(1)} Top3=%${(top3E/n*100).toFixed(1)} LogLoss=${(llE/n).toFixed(4)}`);
    console.log(`  PMZ-deneysel:         Top1=%${(top1P/n*100).toFixed(1)} Top3=%${(top3P/n*100).toFixed(1)} LogLoss=${(llP/n).toFixed(4)}`);
    console.log(`  E->PMZ: iyilesen=${iyilesen} kotulesen=${kotulesen} degismeyen=${n-iyilesen-kotulesen}`);
  }
  evalPair(trainE, "TRAIN(120)");
  evalPair(holdoutE, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");

  // Odak yarislar
  console.log(`\n=== Odak yarislar: E -> PMZ-deneysel ===`);
  const allOldIds = Object.keys(oldCache);
  for (const prefix of ["cmup2gg0", "cmu60zh6"]) { // MAKUL/OPERASYON, NO BRAKES/LADY ONAT
    const raceId = allOldIds.find((id) => id.startsWith(prefix));
    if (!raceId) continue;
    const race = merged(raceId);
    if (!race) { console.log(`  ${prefix}: onbellekte YOK`); continue; }
    const { vectors: ve, probs: pe } = scoreModel(race, statsE, betaE, new Set());
    const { vectors: vp, probs: pp } = scoreModel(race, statsE, betaPMZ, best.forceZero);
    const winIdxE = ve.findIndex((v) => v.no === race.winnerNo), winIdxP = vp.findIndex((v) => v.no === race.winnerNo);
    const rankedE = ve.map((v,j)=>({no:v.no,p:pe[j]})).sort((a,b)=>b.p-a.p);
    const rankedP = vp.map((v,j)=>({no:v.no,p:pp[j]})).sort((a,b)=>b.p-a.p);
    console.log(`  ${race.date.slice(0,10)} ${raceId.slice(0,8)} ${race.runners.find((r)=>r.no===race.winnerNo)?.name}: E sira=${rankedE.findIndex((r)=>r.no===race.winnerNo)+1}. %${(pe[winIdxE]*100).toFixed(2)}  ->  PMZ sira=${rankedP.findIndex((r)=>r.no===race.winnerNo)+1}. %${(pp[winIdxP]*100).toFixed(2)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
