// READ-ONLY. 17 at-sayisi-uyusmazligi olan yarisi TESPIT edip, onlar DISLANDIGINDA
// Model A/B vs V5.46.1 sonucunun DEGISIP DEGISMEDIGINI kontrol eder.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { computeFeatureStats, fitModel, scoreRace, DEFAULT_FIT_OPTIONS, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { cacheToTrainingRaces, fitModelBFromCache } from "./src/lib/motor-v1/engine/model-b-relational";
import type { SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CachedRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const TRAIN_CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";
const NEW_CACHE_PATH = "C:/tmp/v546-comparison-feature-cache.json";

function top1(s: {no:number;probability:number}[], w: number|null){ if(w==null||s.length===0) return false; return [...s].sort((a,b)=>b.probability-a.probability)[0].no===w; }
function top3(s: {no:number;probability:number}[], w: number|null){ if(w==null) return false; return [...s].sort((a,b)=>b.probability-a.probability).slice(0,3).some(x=>x.no===w); }
function winP(s: {no:number;probability:number}[], w: number|null){ return w==null?null:s.find(x=>x.no===w)?.probability??null; }
function logLoss(p:(number|null)[]){ const x=p.filter((v):v is number=>v!=null&&v>0); return x.length?-x.reduce((s,v)=>s+Math.log(v),0)/x.length:null; }

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH,"utf8")) as {trainRaceIds:string[]};
  const trainCache = JSON.parse(fs.readFileSync(TRAIN_CACHE_PATH,"utf8")) as Record<string,CachedRaceShape>;
  const newCache = JSON.parse(fs.readFileSync(NEW_CACHE_PATH,"utf8")) as Record<string,CachedRaceShape>;
  const raceIds = Object.keys(newCache);

  const picks = await db.pick.findMany({
    where: { prediction: { raceId: { in: raceIds } }, featureSnapshot: { path: ["motorEtiketi"], string_contains: "V5.46.1" } },
    select: { score: true, scoreExact: true, runner: { select: { no: true, name: true, scratched: true } }, prediction: { select: { raceId: true } } },
  });
  const v546ByRace = new Map<string, { no: number; name: string|null; scratched: boolean|undefined; prob: number }[]>();
  for (const p of picks) {
    if (p.runner?.no == null) continue;
    const arr = v546ByRace.get(p.prediction.raceId) ?? [];
    arr.push({ no: p.runner.no, name: p.runner.name, scratched: p.runner.scratched, prob: (p.scoreExact ?? p.score ?? 0) / 100 });
    v546ByRace.set(p.prediction.raceId, arr);
  }

  const mismatched = new Set<string>();
  console.log("=== UYUSMAYAN 17 YARIS DETAYI ===");
  for (const raceId of raceIds) {
    const v1Nos = new Set(newCache[raceId].runners.map(r => r.no));
    const v5 = v546ByRace.get(raceId) ?? [];
    const v5Nos = new Set(v5.map(r => r.no));
    if (v1Nos.size !== v5Nos.size) {
      mismatched.add(raceId);
      const onlyV1 = [...v1Nos].filter(n => !v5Nos.has(n));
      const onlyV5 = v5.filter(r => !v1Nos.has(r.no));
      console.log(`${raceId}: V1=${v1Nos.size} V5=${v5Nos.size} | sadece-V1=${JSON.stringify(onlyV1)} | sadece-V5=${JSON.stringify(onlyV5.map(r=>`${r.no}:${r.name}(scratched=${r.scratched})`))}`);
    }
  }
  console.log(`\nToplam uyusmayan: ${mismatched.size}`);

  // --- Model A/B yeniden fit (ayni, 120 train) ---
  const trainSet: TrainingRace[] = cacheToTrainingRaces(trainCache, lock.trainRaceIds);
  const statsA = computeFeatureStats(trainSet.flatMap(t=>t.vectors));
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  const modelB = fitModelBFromCache(trainCache, lock.trainRaceIds);

  const testRaces = cacheToTrainingRaces(newCache, raceIds).filter(t => !mismatched.has(t.raceId));
  console.log(`\n=== SONUC (uyusmayan ${mismatched.size} yaris DISLANDI, n=${testRaces.length}) ===`);

  const aWinP:(number|null)[]=[], bWinP:(number|null)[]=[], vWinP:(number|null)[]=[];
  let aT1=0,aT3=0,bT1=0,bT3=0,vT1=0,vT3=0;
  for (const t of testRaces) {
    const sa = scoreRace(t.vectors, modelA), sb = scoreRace(t.vectors, modelB);
    if (top1(sa,t.winnerNo)) aT1++; if (top3(sa,t.winnerNo)) aT3++;
    if (top1(sb,t.winnerNo)) bT1++; if (top3(sb,t.winnerNo)) bT3++;
    aWinP.push(winP(sa,t.winnerNo)); bWinP.push(winP(sb,t.winnerNo));
    const v5 = v546ByRace.get(t.raceId)!;
    if (top1(v5,t.winnerNo)) vT1++; if (top3(v5,t.winnerNo)) vT3++;
    vWinP.push(winP(v5,t.winnerNo));
  }
  const n = testRaces.length;
  console.log(`Model A: top1=${(aT1/n*100).toFixed(1)}% top3=${(aT3/n*100).toFixed(1)}% logLoss=${logLoss(aWinP)?.toFixed(4)}`);
  console.log(`Model B: top1=${(bT1/n*100).toFixed(1)}% top3=${(bT3/n*100).toFixed(1)}% logLoss=${logLoss(bWinP)?.toFixed(4)}`);
  console.log(`V5.46.1: top1=${(vT1/n*100).toFixed(1)}% top3=${(vT3/n*100).toFixed(1)}% logLoss=${logLoss(vWinP)?.toFixed(4)}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error("HATA:",e);process.exit(1);});
