// ROTAGANYAN V1.0 — DAV YENIDEN EGITIMI: A (eski model+eski veri) vs B (eski model+
// kurtarilmis veri) vs C (yeniden egitilmis model+kurtarilmis veri). SADECE DAV'in ham
// verisi degisir (DAV_TAKI_EKLENDI/CIKARILDI) — digerleri (GEN dahil) ESKI kalir, boylece
// DAV'in etkisi izole olculur. Mevcut DUZ 76-ozellik (38 kod x [z,missing]) mimarisi
// korunur. Z_CAP=11 ZORUNLU kabul edilmez — TRAIN-ici kronolojik CV ile adaylar arasindan
// secilir (lambda=1, production ile AYNI, sabit). V5.46.1/production/digerleri DEGISMEZ.
import fs from "node:fs";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { scoreRace, explainRunner } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const DAV_7_PREFIXES = ["cmt875dz", "cmt5caao", "cmu52aat", "cmudmxle", "cmup2gg0", "cmu60zh6", "cmsh1uys"];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const recCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()];

  // SADECE DAV kodlarini kurtarilmis veriyle degistir — digerleri (GEN dahil) ESKI kalir.
  function davOnlyMerged(id: string): CacheRace | null {
    const o = oldCache[id], r = recCache[id];
    if (!o || !r) return null;
    return {
      raceId: id, date: o.date, winnerNo: o.winnerNo,
      runners: o.runners.map((rr) => {
        const rNew = r.runners.find((x) => x.no === rr.no);
        const signals = rr.vectors.map((s) => (DAV_CODES.includes(s.code) ? (rNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
        return { no: rr.no, name: rr.name, vectors: signals };
      }),
    };
  }
  const trainMerged = lock.trainRaceIds.map(davOnlyMerged).filter((r): r is CacheRace => !!r);
  const holdoutMerged = lock.holdoutRaceIds.map(davOnlyMerged).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN(DAV-kurtarilmis, digerleri ESKI): ${trainMerged.length}/120  HOLDOUT: ${holdoutMerged.length}/30`);

  function isIkili(values: number[]): boolean {
    if (values.length < 2) return false;
    const s = new Set(values);
    return [...s].every((v) => v === 0 || v === 1) && s.size <= 2;
  }
  type StatsEntry = { mu: number; sigma: number };
  function computeStats(racesSubset: CacheRace[]): Map<string, StatsEntry> {
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
  const globalIkiliKodlar = new Set(codes.filter((code) => {
    const vals: number[] = [];
    for (const race of trainMerged) for (const r of race.runners) {
      const s = r.vectors.find((x) => x.code === code);
      if (s?.observed && s.rawValue != null) vals.push(s.rawValue);
    }
    return isIkili(vals);
  }));
  console.log(`Ikili kodlar (tam TRAIN'den, DAV-kurtarilmis): ${[...globalIkiliKodlar].join(", ")}`);

  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, zCap: number | null): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      let z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      if (observed && globalIkiliKodlar.has(code) && zCap != null) z = Math.max(-zCap, Math.min(zCap, z));
      vec.push(z); vec.push(observed ? 0 : 1);
    }
    return vec;
  }
  function toTR(racesSubset: CacheRace[], stats: Map<string, StatsEntry>, zCap: number | null): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of racesSubset) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, zCap) };
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

  // ====== ADIM 1: TRAIN-ici KRONOLOJIK CV — Z_CAP secimi (lambda=1 SABIT) ======
  const trainSorted = [...trainMerged].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFit = trainSorted.slice(0, trainSorted.length - cvValSize);
  const cvVal = trainSorted.slice(trainSorted.length - cvValSize);
  const cvStats = computeStats(cvFit);
  const Z_CAP_ADAYLARI: (number | null)[] = [null, 4, 6, 8, 11, 15, 20];
  let best: { cap: number | null; ll: number } = { cap: null, ll: Infinity };
  console.log(`\n=== TRAIN-ici kronolojik CV: Z_CAP adaylari (lambda=${currentModel.opts.lambda}) ===`);
  for (const cap of Z_CAP_ADAYLARI) {
    const fitR = toTR(cvFit, cvStats, cap);
    const valR = toTR(cvVal, cvStats, cap);
    const beta = fitConditionalLogit(fitR, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(valR, beta);
    console.log(`  Z_CAP=${cap ?? "YOK"}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
    if (val.ll < best.ll) best = { cap, ll: val.ll };
  }
  console.log(`\nSECILEN Z_CAP: ${best.cap ?? "YOK"} (val LogLoss=${best.ll.toFixed(4)}) — 11 OTOMATIK kabul edilmedi, veriyle secildi.`);

  // ====== ADIM 2: TAM TRAIN(120) retrain ======
  const fullStats = computeStats(trainMerged);
  const fullTR = toTR(trainMerged, fullStats, best.cap);
  const newBeta = fitConditionalLogit(fullTR, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  console.log(`\nYeniden egitim bitti. NaN var mi: ${newBeta.some((b) => !Number.isFinite(b))}`);

  // DAV'in yeni ogrenilen katsayisi
  const davEklendiIdx = codes.indexOf("DAV_TAKI_EKLENDI") * 2;
  const davCikarildiIdx = codes.indexOf("DAV_TAKI_CIKARILDI") * 2;
  const oldBetaEklendi = currentModel.beta[davEklendiIdx], oldBetaCikarildi = currentModel.beta[davCikarildiIdx];
  console.log(`\nDAV_TAKI_EKLENDI beta: eski=${oldBetaEklendi.toFixed(3)} -> yeni=${newBeta[davEklendiIdx].toFixed(3)}`);
  console.log(`DAV_TAKI_CIKARILDI beta: eski=${oldBetaCikarildi.toFixed(3)} -> yeni=${newBeta[davCikarildiIdx].toFixed(3)}`);
  console.log(`DAV_TAKI_EKLENDI missing-beta: eski=${currentModel.beta[davEklendiIdx+1].toFixed(3)} -> yeni=${newBeta[davEklendiIdx+1].toFixed(3)}`);
  console.log(`DAV_TAKI_CIKARILDI missing-beta: eski=${currentModel.beta[davCikarildiIdx+1].toFixed(3)} -> yeni=${newBeta[davCikarildiIdx+1].toFixed(3)}`);
  const stEkl = fullStats.get("DAV_TAKI_EKLENDI")!;
  console.log(`DAV_TAKI_EKLENDI: mu=${stEkl.mu.toFixed(4)} sigma=${stEkl.sigma.toFixed(4)} -> z(x=1,kirpilmemis)=${((1-stEkl.mu)/stEkl.sigma).toFixed(2)}, Z_CAP=${best.cap ?? "YOK"}`);

  function scoreWithNew(race: CacheRace) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, fullStats, best.cap));
    const scores = vecs.map((v) => dot(v, newBeta));
    const probs = softmax(scores);
    return { vectors, probs };
  }

  // ====== ADIM 3: A/B/C uc-durum karsilastirma, TRAIN+HOLDOUT ayri ======
  function compareABC(oldRaces: CacheRace[], mergedRaces: CacheRace[], label: string) {
    let llA = 0, llB = 0, llC = 0, top1A = 0, top1B = 0, top1C = 0, top3A = 0, top3B = 0, top3C = 0, n = 0;
    let iyilesenBC = 0, kotulesenBC = 0;
    for (let i = 0; i < oldRaces.length; i++) {
      const oldRace = oldRaces[i], mergedRace = mergedRaces[i];
      if (oldRace.winnerNo == null) continue;
      const vecOld: RunnerFeatureVector[] = oldRace.runners.map((r) => ({ raceId: oldRace.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const scoredA = scoreRace(vecOld, currentModel); // A: eski model + eski DAV veri
      const winIdxA = scoredA.findIndex((s) => s.no === oldRace.winnerNo);
      if (winIdxA < 0) continue;
      const rankedA = [...scoredA].sort((a, b) => b.probability - a.probability);

      const vecMerged: RunnerFeatureVector[] = mergedRace.runners.map((r) => ({ raceId: mergedRace.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const scoredB = scoreRace(vecMerged, currentModel); // B: eski model + kurtarilmis DAV veri
      const winIdxB = scoredB.findIndex((s) => s.no === oldRace.winnerNo);
      const rankedB = [...scoredB].sort((a, b) => b.probability - a.probability);

      const { vectors: vecC, probs: probsC } = scoreWithNew(mergedRace); // C: yeniden egitilmis model + kurtarilmis veri
      const winIdxC = vecC.findIndex((v) => v.no === oldRace.winnerNo);
      const rankedC = vecC.map((v, j) => ({ no: v.no, p: probsC[j] })).sort((a, b) => b.p - a.p);

      llA += logLoss(scoredA[winIdxA].probability); llB += logLoss(scoredB[winIdxB].probability); llC += logLoss(probsC[winIdxC]);
      if (rankedA[0].no === oldRace.winnerNo) top1A++; if (rankedB[0].no === oldRace.winnerNo) top1B++; if (rankedC[0].no === oldRace.winnerNo) top1C++;
      if (rankedA.slice(0,3).some((r)=>r.no===oldRace.winnerNo)) top3A++; if (rankedB.slice(0,3).some((r)=>r.no===oldRace.winnerNo)) top3B++; if (rankedC.slice(0,3).some((r)=>r.no===oldRace.winnerNo)) top3C++;
      const llBrace = logLoss(scoredB[winIdxB].probability), llCrace = logLoss(probsC[winIdxC]);
      if (llCrace < llBrace - 0.01) iyilesenBC++; else if (llCrace > llBrace + 0.01) kotulesenBC++;
      n++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  A (eski model+eski DAV veri):        Top1=%${(top1A/n*100).toFixed(1)} Top3=%${(top3A/n*100).toFixed(1)} LogLoss=${(llA/n).toFixed(4)}`);
    console.log(`  B (eski model+kurtarilmis DAV veri):  Top1=%${(top1B/n*100).toFixed(1)} Top3=%${(top3B/n*100).toFixed(1)} LogLoss=${(llB/n).toFixed(4)}`);
    console.log(`  C (yeniden egitilmis model+kurtarilmis): Top1=%${(top1C/n*100).toFixed(1)} Top3=%${(top3C/n*100).toFixed(1)} LogLoss=${(llC/n).toFixed(4)}`);
    console.log(`  B->C degisim: iyilesen=${iyilesenBC} kotulesen=${kotulesenBC} degismeyen=${n-iyilesenBC-kotulesenBC}`);
  }
  const oldTrainRaces = lock.trainRaceIds.map((id) => oldCache[id]).filter((r): r is CacheRace => !!r);
  const oldHoldoutRaces = lock.holdoutRaceIds.map((id) => oldCache[id]).filter((r): r is CacheRace => !!r);
  compareABC(oldTrainRaces, trainMerged, "TRAIN(120)");
  compareABC(oldHoldoutRaces, holdoutMerged, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");

  // ====== ADIM 4: 7 DAV-kritik yariş (verisi mevcut olanlar) eski->yeni ======
  console.log(`\n=== 7 DAV-kritik yariştan TRAIN+HOLDOUT'ta olanlar: A->C ===`);
  const allIds = Object.keys(oldCache);
  for (const prefix of DAV_7_PREFIXES) {
    const raceId = allIds.find((id) => id.startsWith(prefix));
    if (!raceId || !(lock.trainRaceIds.includes(raceId) || lock.holdoutRaceIds.includes(raceId))) continue;
    const oldRace = oldCache[raceId];
    const mergedRace = davOnlyMerged(raceId)!;
    const vecOld: RunnerFeatureVector[] = oldRace.runners.map((r) => ({ raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const scoredA = scoreRace(vecOld, currentModel);
    const winIdxA = scoredA.findIndex((s) => s.no === oldRace.winnerNo);
    const rankedA = [...scoredA].sort((a,b)=>b.probability-a.probability);
    const rankA = rankedA.findIndex((s)=>s.no===oldRace.winnerNo)+1;
    const { vectors: vecC, probs: probsC } = scoreWithNew(mergedRace);
    const winIdxC = vecC.findIndex((v) => v.no === oldRace.winnerNo);
    const rankedC = vecC.map((v,j)=>({no:v.no,p:probsC[j]})).sort((a,b)=>b.p-a.p);
    const rankC = rankedC.findIndex((r)=>r.no===oldRace.winnerNo)+1;
    console.log(`  ${oldRace.date.slice(0,10)} ${raceId.slice(0,8)} ${oldRace.runners.find((r)=>r.no===oldRace.winnerNo)?.name}: A sira=${rankA}. %${(scoredA[winIdxA].probability*100).toFixed(2)}  ->  C sira=${rankC}. %${(probsC[winIdxC]*100).toFixed(2)}`);
  }

  // Takı eklenen/çıkarılan atlarda skor dağılımı (yeni katsayıyla)
  console.log(`\n=== Takı EKLENEN atlarda yeni DAV skor katkısı dağılımı (TRAIN+HOLDOUT, kurtarılmış veri) ===`);
  let katkilar: number[] = [];
  for (const race of [...trainMerged, ...holdoutMerged]) {
    for (const r of race.runners) {
      const s = r.vectors.find((x) => x.code === "DAV_TAKI_EKLENDI");
      if (s?.observed && s.rawValue === 1) {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        const vec = buildVector(fv, fullStats, best.cap);
        const idx = davEklendiIdx;
        katkilar.push(newBeta[idx] * vec[idx]);
      }
    }
  }
  katkilar.sort((a,b)=>a-b);
  console.log(`  n=${katkilar.length}, min=${katkilar[0]?.toFixed(3)}, medyan=${katkilar[Math.floor(katkilar.length/2)]?.toFixed(3)}, max=${katkilar[katkilar.length-1]?.toFixed(3)}, ortalama=${(katkilar.reduce((a,b)=>a+b,0)/katkilar.length).toFixed(3)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
