// READ-ONLY. ASIL SORU: V1.0 (Model A/B), CANLIDAKI V5.46.1'den daha mi iyi, daha mi kotu?
// 163 TAZE yaris (V5.46.1 parmak izi dogrulanmis, V1.0'in 150'lik onbelleginin DISINDA).
// Model A/B: MEVCUT 120-yarislik train split'ten (0 yeni egitim) fit edilir, bu 163 yaristan
// HICBIRI egitime girmez (tamamen bagimsiz test). V5.46.1: YENIDEN CALISTIRILMAZ, zaten
// kayitli Pick.scoreExact/score okunur.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { computeFeatureStats, fitModel, scoreRace, DEFAULT_FIT_OPTIONS, SIGNAL_CODES, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { cacheToTrainingRaces, fitModelBFromCache, MODEL_B_CODES } from "./src/lib/motor-v1/engine/model-b-relational";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const TRAIN_CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json"; // 120 train + 30 holdout (ESKI, sabit)
const NEW_CACHE_PATH = "C:/tmp/v546-comparison-feature-cache.json"; // 163 TAZE yaris

type CachedRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

function top1(scored: { no: number; probability: number }[], w: number | null) {
  if (w == null || scored.length === 0) return false;
  return [...scored].sort((a, b) => b.probability - a.probability)[0].no === w;
}
function top3(scored: { no: number; probability: number }[], w: number | null) {
  if (w == null) return false;
  return [...scored].sort((a, b) => b.probability - a.probability).slice(0, 3).some((s) => s.no === w);
}
function winP(scored: { no: number; probability: number }[], w: number | null) {
  return w == null ? null : scored.find((s) => s.no === w)?.probability ?? null;
}
function logLoss(probs: (number | null)[]) {
  const p = probs.filter((x): x is number => x != null && x > 0);
  return p.length ? -p.reduce((s, x) => s + Math.log(x), 0) / p.length : null;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[] };
  const trainCache = JSON.parse(fs.readFileSync(TRAIN_CACHE_PATH, "utf8")) as Record<string, CachedRaceShape>;
  const newCache = JSON.parse(fs.readFileSync(NEW_CACHE_PATH, "utf8")) as Record<string, CachedRaceShape>;

  // --- Model A / B: SADECE 120 train yaristan (163'ten HICBIRI yok) ---
  const trainSet: TrainingRace[] = cacheToTrainingRaces(trainCache, lock.trainRaceIds);
  const statsA = computeFeatureStats(trainSet.flatMap((t) => t.vectors));
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  const modelB = fitModelBFromCache(trainCache, lock.trainRaceIds);
  console.log(`Model A: nRacesUsed=${modelA.nRacesUsed} kod=${modelA.stats.size}`);
  console.log(`Model B: nRacesUsed=${modelB.nRacesUsed} kod=${modelB.stats.size}`);

  // --- 163 taze yarisi skorla (Model A/B) ---
  const testRaces: TrainingRace[] = cacheToTrainingRaces(newCache, Object.keys(newCache));
  console.log(`Test seti: ${testRaces.length} yaris\n`);

  // --- V5.46.1'in ZATEN KAYITLI skorlarini oku (yeniden calistirmadan) ---
  const raceIds = testRaces.map((t) => t.raceId);
  const picks = await db.pick.findMany({
    where: {
      prediction: { raceId: { in: raceIds } },
      featureSnapshot: { path: ["motorEtiketi"], string_contains: "V5.46.1" },
    },
    select: { score: true, scoreExact: true, runner: { select: { no: true } }, prediction: { select: { raceId: true } } },
  });
  const v546ByRace = new Map<string, { no: number; probability: number }[]>();
  for (const p of picks) {
    if (p.runner?.no == null) continue;
    const prob = (p.scoreExact ?? p.score ?? 0) / 100;
    const arr = v546ByRace.get(p.prediction.raceId) ?? [];
    arr.push({ no: p.runner.no, probability: prob });
    v546ByRace.set(p.prediction.raceId, arr);
  }

  const aWinP: (number | null)[] = [], bWinP: (number | null)[] = [], vWinP: (number | null)[] = [];
  let aT1 = 0, aT3 = 0, bT1 = 0, bT3 = 0, vT1 = 0, vT3 = 0, nV5Eval = 0;
  const v5MissedA_Caught: string[] = [], v5MissedB_Caught: string[] = [];

  for (const t of testRaces) {
    const scoredA = scoreRace(t.vectors, modelA);
    const scoredB = scoreRace(t.vectors, modelB);
    if (top1(scoredA, t.winnerNo)) aT1++;
    if (top3(scoredA, t.winnerNo)) aT3++;
    if (top1(scoredB, t.winnerNo)) bT1++;
    if (top3(scoredB, t.winnerNo)) bT3++;
    aWinP.push(winP(scoredA, t.winnerNo));
    bWinP.push(winP(scoredB, t.winnerNo));

    const v5 = v546ByRace.get(t.raceId);
    if (v5 && v5.length > 0) {
      nV5Eval++;
      const v5t3 = top3(v5, t.winnerNo);
      if (top1(v5, t.winnerNo)) vT1++;
      if (v5t3) vT3++;
      vWinP.push(winP(v5, t.winnerNo));
      if (!v5t3 && top3(scoredA, t.winnerNo)) v5MissedA_Caught.push(t.raceId);
      if (!v5t3 && top3(scoredB, t.winnerNo)) v5MissedB_Caught.push(t.raceId);
    } else {
      vWinP.push(null);
    }
  }

  const n = testRaces.length;
  console.log("=== SONUC (n=163, V5.46.1 icin n=" + nV5Eval + ") ===");
  console.log(`Model A: top1=${(aT1/n*100).toFixed(1)}% top3=${(aT3/n*100).toFixed(1)}% logLoss=${logLoss(aWinP)?.toFixed(4)}`);
  console.log(`Model B: top1=${(bT1/n*100).toFixed(1)}% top3=${(bT3/n*100).toFixed(1)}% logLoss=${logLoss(bWinP)?.toFixed(4)}`);
  console.log(`V5.46.1: top1=${(vT1/nV5Eval*100).toFixed(1)}% top3=${(vT3/nV5Eval*100).toFixed(1)}% logLoss=${logLoss(vWinP)?.toFixed(4)}`);
  console.log(`\nV5.46.1 ilk-3'te KACIRDI, Model A BULDU: ${v5MissedA_Caught.length} yaris: ${JSON.stringify(v5MissedA_Caught)}`);
  console.log(`V5.46.1 ilk-3'te KACIRDI, Model B BULDU: ${v5MissedB_Caught.length} yaris: ${JSON.stringify(v5MissedB_Caught)}`);

  fs.writeFileSync("C:/tmp/v546-final-compare-result.json", JSON.stringify({
    n, nV5Eval,
    modelA: { top1: aT1/n, top3: aT3/n, logLoss: logLoss(aWinP) },
    modelB: { top1: bT1/n, top3: bT3/n, logLoss: logLoss(bWinP) },
    v546: { top1: vT1/nV5Eval, top3: vT3/nV5Eval, logLoss: logLoss(vWinP) },
    v5MissedA_Caught, v5MissedB_Caught,
  }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
