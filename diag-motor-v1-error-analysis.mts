// READ-ONLY. KULLANICI TALIMATI MADDE 1: AGF'nin ilk-3'te buldugu AMA Model A/B'nin
// bulamadigi 10 holdout yarisinda (ab-compare-result.json::evals'tan AGFTop3=true VE
// (aTop3=false OR bTop3=false) filtrelenerek - YENIDEN HESAPLANMADAN, zaten onaylanmis
// sonuctan okunur) kazanan atin: (a) Model A/B'deki GERCEK sirasi, (b) explainRunner'in
// GERCEK en buyuk olumlu/olumsuz skor katkilari, (c) GEN/ANT/DAV/RAK (henuz skora girmeyen
// aileler) + PIST_DURUM_01/DAV_START_RISK (yapisal disarida) icin GERCEK veri durumu.
// Hiçbir yeni sinyal/formul yazilmadi - yalniz MEVCUT explainRunner + computeUnifiedFamiliesForRace
// cagriliyor, 10 BELIRLI yaris icin (genis bir tarama DEGIL).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { scoreRace, explainRunner, computeFeatureStats, fitModel, DEFAULT_FIT_OPTIONS, type TrainingRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { cacheToTrainingRaces, fitModelBFromCache, type CachedRaceShape, type ModelBCode } from "./src/lib/motor-v1/engine/model-b-relational";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";
const RESULT_PATH = "src/lib/motor-v1/artifacts/ab-compare-result.json";
const PROGRESS_PATH = "/c/tmp/error-analysis-progress.log";

function log(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  fs.appendFileSync(PROGRESS_PATH, stamped + "\n"); // BUFFERSIZ - anlik, gercek ilerleme kaniti
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT(${ms}ms): ${label}`)), ms)),
  ]);
}

function rankOf(scored: { no: number; probability: number }[], no: number): number {
  const sorted = [...scored].sort((a, b) => b.probability - a.probability);
  return sorted.findIndex((s) => s.no === no) + 1;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Record<string, CachedRaceShape>;
  const prior = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8")) as { evals: { raceId: string; winnerNo: number; aTop3: boolean; bTop3: boolean; agfTop3: boolean | null }[] };

  const flagged = prior.evals.filter((e) => e.agfTop3 === true && (!e.aTop3 || !e.bTop3));
  console.log(`Hedef yaris sayisi (AGF ilk-3 buldu, A ve/veya B bulamadi): ${flagged.length}\n`);

  const trainSet = cacheToTrainingRaces(cache, lock.trainRaceIds);
  const statsA = computeFeatureStats(trainSet.flatMap((t) => t.vectors));
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  const modelB: FittedModel<ModelBCode> = fitModelBFromCache(cache, lock.trainRaceIds);

  for (const f of flagged) {
    console.log(`\n========== YARIS ${f.raceId} (kazanan #${f.winnerNo}) ==========`);
    const trainingRace = cacheToTrainingRaces(cache, [f.raceId])[0];
    if (!trainingRace) { console.log("  onbellekte yok (atlandi)"); continue; }
    const winnerFv = trainingRace.vectors.find((v) => v.no === f.winnerNo);
    if (!winnerFv) { console.log("  kazananin vektoru yok (atlandi)"); continue; }

    const scoredA = scoreRace(trainingRace.vectors, modelA);
    const scoredB = scoreRace(trainingRace.vectors, modelB);
    console.log(`  Saha buyuklugu: ${trainingRace.vectors.length}`);
    console.log(`  Model A sirasi: ${rankOf(scoredA, f.winnerNo)}/${scoredA.length} (p=${(scoredA.find((s) => s.no === f.winnerNo)?.probability! * 100).toFixed(1)}%)`);
    console.log(`  Model B sirasi: ${rankOf(scoredB, f.winnerNo)}/${scoredB.length} (p=${(scoredB.find((s) => s.no === f.winnerNo)?.probability! * 100).toFixed(1)}%)`);

    const expA = explainRunner(winnerFv, modelA);
    const expB = explainRunner(winnerFv, modelB);
    const topN = (rows: typeof expA.rows, n: number, dir: "pos" | "neg") => {
      const sorted = [...rows].filter((r) => r.observed).sort((a, b) => dir === "pos" ? b.scoreContribution - a.scoreContribution : a.scoreContribution - b.scoreContribution);
      return sorted.slice(0, n).map((r) => `${r.code}=${r.rawValue?.toFixed(2)}(z=${r.standardizedValue.toFixed(2)}) katki=${r.scoreContribution.toFixed(3)}`);
    };
    console.log(`  Model A en olumlu 3: ${topN(expA.rows, 3, "pos").join(" | ")}`);
    console.log(`  Model A en olumsuz 3: ${topN(expA.rows, 3, "neg").join(" | ")}`);
    console.log(`  Model B en olumlu 3: ${topN(expB.rows, 3, "pos").join(" | ")}`);
    console.log(`  Model B en olumsuz 3: ${topN(expB.rows, 3, "neg").join(" | ")}`);
    const unobservedA = expA.rows.filter((r) => !r.observed).map((r) => r.code);
    if (unobservedA.length) console.log(`  Model A'da GOZLEMSIZ (missing-indicator devrede) kodlar: ${unobservedA.join(", ")}`);

    // --- DB: henuz skora girmeyen aileler (GEN/ANT/DAV/RAK) icin GERCEK veri durumu ---
    try {
      const unified = await computeUnifiedFamiliesForRace(f.raceId);
      const winnerUnified = unified.find((u) => u.no === f.winnerNo);
      if (winnerUnified) {
        for (const fam of winnerUnified.families.filter((fb) => ["GEN", "ANT", "DAV", "RAK", "PMZ"].includes(fb.family))) {
          const detail = fam.features.map((ft) => `${ft.code}=${ft.observed ? ft.rawValue?.toFixed(3) : "YOK(" + ft.missingReason + ")"}`).join(", ");
          console.log(`  [${fam.family}] ${detail}`);
        }
      } else {
        console.log("  (unified engine kazanan icin sonuc dondurmedi)");
      }
    } catch (e) {
      console.log(`  (unified engine HATA - atlandi: ${(e as Error).message})`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
