// ROTAGANYAN V1.0 — GEN'I DAV-DUZELTILMIS (C) MODELIN USTUNE EKLEME. Referans: DAV-sadece
// duzeltilmis veri (digerleri ESKI) — onceki turda "C" modelini ureten AYNI taban. Simdi
// BUNUN USTUNE GEN'in 4 dogrudan kodu da (zaten commit edilmis oz-dahil-etme duzeltmesiyle)
// degistirilir, DIGER 8 aile ESKI kalir. Ikisi de AYNI yontemle (mevcut 76-ozellik duz
// mimari, TRAIN-ici kronolojik CV'den secilen Z_CAP, lambda=1) yeniden egitilir.
import fs from "node:fs";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { scoreRace } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];

const RACE_PREFIXES_15 = [
  "cmt875dz", "cmtfiu84", "cmt5caao", "cmu52aat", "cmrx3813", "cmudmxle", "cmup2gg0",
  "cmu60zh6", "cmrl0m3t", "cmr5xihb", "cmsh1uys", "cmrpxdmb", "cmunn07g", "cmsr1wh7", "cmunn1bq",
];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>; // GEN-fix + DAV-kurtarma IKISI DE var
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()];

  function merged(id: string, codesToSwap: string[]): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return {
      raceId: id, date: o.date, winnerNo: o.winnerNo,
      runners: o.runners.map((rr) => {
        const fNew = f.runners.find((x) => x.no === rr.no);
        const signals = rr.vectors.map((s) => (codesToSwap.includes(s.code) ? (fNew?.vectors.find((x) => x.code === s.code) ?? s) : s));
        return { no: rr.no, name: rr.name, vectors: signals };
      }),
    };
  }
  // REFERANS "C": yalniz DAV duzeltilmis (onceki turla AYNI)
  const trainC = lock.trainRaceIds.map((id) => merged(id, DAV_CODES)).filter((r): r is CacheRace => !!r);
  const holdoutC = lock.holdoutRaceIds.map((id) => merged(id, DAV_CODES)).filter((r): r is CacheRace => !!r);
  // YENI "D": DAV + GEN duzeltilmis
  const trainD = lock.trainRaceIds.map((id) => merged(id, [...DAV_CODES, ...GEN_CODES])).filter((r): r is CacheRace => !!r);
  const holdoutD = lock.holdoutRaceIds.map((id) => merged(id, [...DAV_CODES, ...GEN_CODES])).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN: C=${trainC.length}/120 D=${trainD.length}/120  HOLDOUT: C=${holdoutC.length}/30 D=${holdoutD.length}/30`);

  // GEN veri guvenilirligi degisimi (TRAIN)
  let genDegisenRunner = 0, genDegisenRace = new Set<string>(), toplamRunner = 0;
  for (let i = 0; i < trainC.length; i++) {
    let anyChanged = false;
    for (let j = 0; j < trainC[i].runners.length; j++) {
      toplamRunner++;
      for (const code of GEN_CODES) {
        const a = trainC[i].runners[j].vectors.find((s) => s.code === code);
        const b = trainD[i].runners[j].vectors.find((s) => s.code === code);
        if (a?.rawValue !== b?.rawValue || a?.observed !== b?.observed) { genDegisenRunner++; anyChanged = true; }
      }
    }
    if (anyChanged) genDegisenRace.add(trainC[i].raceId);
  }
  console.log(`\nGEN verisi degisen koşucu: ${genDegisenRunner}/${toplamRunner}  Degisen yaris: ${genDegisenRace.size}/${trainC.length}`);

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
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, ikiliKodlar: Set<string>, zCap: number | null): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      let z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      if (observed && ikiliKodlar.has(code) && zCap != null) z = Math.max(-zCap, Math.min(zCap, z));
      vec.push(z); vec.push(observed ? 0 : 1);
    }
    return vec;
  }
  function toTR(racesSubset: CacheRace[], stats: Map<string, StatsEntry>, ikiliKodlar: Set<string>, zCap: number | null): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of racesSubset) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, ikiliKodlar, zCap) };
      });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function fitFull(trainRaces: CacheRace[]): { beta: number[]; stats: Map<string, StatsEntry>; ikiliKodlar: Set<string> } {
    const stats = computeStats(trainRaces);
    const ikiliKodlar = new Set(codes.filter((code) => {
      const vals: number[] = [];
      for (const race of trainRaces) for (const r of race.runners) {
        const s = r.vectors.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null) vals.push(s.rawValue);
      }
      return isIkili(vals);
    }));
    const tr = toTR(trainRaces, stats, ikiliKodlar, null); // DAV icin Z_CAP onceki turda "YOK" secildi, AYNI kullanilir
    const beta = fitConditionalLogit(tr, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    return { beta, stats, ikiliKodlar };
  }

  const fitC = fitFull(trainC);
  const fitD = fitFull(trainD);
  console.log(`\nC ve D modelleri egitildi. NaN: C=${fitC.beta.some((b)=>!Number.isFinite(b))} D=${fitD.beta.some((b)=>!Number.isFinite(b))}`);

  const genSireIdx = codes.indexOf("GEN_SIRE_01") * 2;
  console.log(`GEN_SIRE_01 beta: C=${fitC.beta[genSireIdx].toFixed(3)} -> D=${fitD.beta[genSireIdx].toFixed(3)}`);

  function scoreModel(race: CacheRace, fit: { beta: number[]; stats: Map<string, StatsEntry>; ikiliKodlar: Set<string> }) {
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vecs = vectors.map((v) => buildVector(v, fit.stats, fit.ikiliKodlar, null));
    const scores = vecs.map((v) => dot(v, fit.beta));
    const probs = softmax(scores);
    return { vectors, probs };
  }

  function evalPair(racesC: CacheRace[], racesD: CacheRace[], label: string) {
    let llC = 0, llD = 0, top1C = 0, top1D = 0, top3C = 0, top3D = 0, n = 0, iyilesen = 0, kotulesen = 0;
    for (let i = 0; i < racesC.length; i++) {
      const rc = racesC[i], rd = racesD[i];
      if (rc.winnerNo == null) continue;
      const { vectors: vc, probs: pc } = scoreModel(rc, fitC);
      const { vectors: vd, probs: pd } = scoreModel(rd, fitD);
      const winIdxC = vc.findIndex((v) => v.no === rc.winnerNo);
      const winIdxD = vd.findIndex((v) => v.no === rc.winnerNo);
      if (winIdxC < 0 || winIdxD < 0) continue;
      const rankedC = vc.map((v, j) => ({ no: v.no, p: pc[j] })).sort((a, b) => b.p - a.p);
      const rankedD = vd.map((v, j) => ({ no: v.no, p: pd[j] })).sort((a, b) => b.p - a.p);
      const llCr = logLoss(pc[winIdxC]), llDr = logLoss(pd[winIdxD]);
      llC += llCr; llD += llDr; n++;
      if (rankedC[0].no === rc.winnerNo) top1C++; if (rankedD[0].no === rc.winnerNo) top1D++;
      if (rankedC.slice(0,3).some((r)=>r.no===rc.winnerNo)) top3C++; if (rankedD.slice(0,3).some((r)=>r.no===rc.winnerNo)) top3D++;
      if (llDr < llCr - 0.01) iyilesen++; else if (llDr > llCr + 0.01) kotulesen++;
    }
    console.log(`\n${label} (n=${n}):`);
    console.log(`  C (DAV-duzeltilmis):      Top1=%${(top1C/n*100).toFixed(1)} Top3=%${(top3C/n*100).toFixed(1)} LogLoss=${(llC/n).toFixed(4)}`);
    console.log(`  D (DAV+GEN-duzeltilmis):  Top1=%${(top1D/n*100).toFixed(1)} Top3=%${(top3D/n*100).toFixed(1)} LogLoss=${(llD/n).toFixed(4)}`);
    console.log(`  C->D: iyilesen=${iyilesen} kotulesen=${kotulesen} degismeyen=${n-iyilesen-kotulesen}`);
  }
  evalPair(trainC, trainD, "TRAIN(120)");
  evalPair(holdoutC, holdoutD, "HOLDOUT(30) — UYARI: arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");

  // 15 kritik yariş — kazananın C->D sıra/olasılık değişimi (TRAIN+HOLDOUT'ta olanlar)
  console.log(`\n=== 15 yarıştan TRAIN+HOLDOUT'ta olanlar: C->D ===`);
  const allIds = Object.keys(oldCache);
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  for (const prefix of RACE_PREFIXES_15) {
    const raceId = allIds.find((id) => id.startsWith(prefix));
    if (!raceId || !(trainSet.has(raceId) || holdoutSet.has(raceId))) continue;
    const rc = merged(raceId, DAV_CODES)!, rd = merged(raceId, [...DAV_CODES, ...GEN_CODES])!;
    const { vectors: vc, probs: pc } = scoreModel(rc, fitC);
    const { vectors: vd, probs: pd } = scoreModel(rd, fitD);
    const winIdxC = vc.findIndex((v) => v.no === rc.winnerNo);
    const winIdxD = vd.findIndex((v) => v.no === rc.winnerNo);
    const rankedC = vc.map((v,j)=>({no:v.no,p:pc[j]})).sort((a,b)=>b.p-a.p);
    const rankedD = vd.map((v,j)=>({no:v.no,p:pd[j]})).sort((a,b)=>b.p-a.p);
    const rankC = rankedC.findIndex((r)=>r.no===rc.winnerNo)+1, rankD = rankedD.findIndex((r)=>r.no===rc.winnerNo)+1;
    console.log(`  ${rc.date.slice(0,10)} ${raceId.slice(0,8)} ${rc.runners.find((r)=>r.no===rc.winnerNo)?.name}: C sira=${rankC}. %${(pc[winIdxC]*100).toFixed(2)}  ->  D sira=${rankD}. %${(pd[winIdxD]*100).toFixed(2)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
