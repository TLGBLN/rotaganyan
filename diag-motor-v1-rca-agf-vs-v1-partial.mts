// READ-ONLY. RCA'nin MODEL_MISS kazananlari icin V1.0'in sirasini, ZATEN onbellekte olan
// alt kumede (14/79) hesaplar - hizli ilk sonuc icin.
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, DEFAULT_FIT_OPTIONS, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { cacheToTrainingRaces, fitModelBFromCache } from "./src/lib/motor-v1/engine/model-b-relational";
import type { SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CachedRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
type RcaRow = { raceId: string; tarih: string; hipodrom: string; raceNo: number; kazananNo: number; kazananAd: string; v546_agfDahil_sira: number; v546_agfCikarilmis_sira: number; agfKurtarirMiydi: boolean; sonuc: string };

function rankOf(scored: { no: number; probability: number }[], no: number): number {
  const sorted = [...scored].sort((a, b) => b.probability - a.probability);
  return sorted.findIndex((s) => s.no === no) + 1;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[] };
  const trainCache = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-feature-cache.json", "utf8")) as Record<string, CachedRaceShape>;
  const cache163 = JSON.parse(fs.readFileSync("C:/tmp/v546-comparison-feature-cache.json", "utf8")) as Record<string, CachedRaceShape>;
  const rca = JSON.parse(fs.readFileSync("C:/tmp/rca-model-miss-agf-stripped.json", "utf8")) as RcaRow[];
  const allCache = { ...trainCache, ...cache163 };

  const trainSet: TrainingRace[] = cacheToTrainingRaces(trainCache, lock.trainRaceIds);
  const statsA = computeFeatureStats(trainSet.flatMap((t) => t.vectors));
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  const modelB = fitModelBFromCache(trainCache, lock.trainRaceIds);

  console.log("raceId | tarih | kazanan | V5.46.1(AGF'li) | V5.46.1(AGF'siz) | V1.0-A | V1.0-B | n");
  let n = 0;
  const rows: Record<string, unknown>[] = [];
  for (const r of rca) {
    const cr = allCache[r.raceId];
    if (!cr) continue;
    n++;
    const vectors = cr.runners.map((rr) => ({ raceId: r.raceId, no: rr.no, name: rr.name, tjkAtId: null, jockey: null, signals: rr.vectors }));
    const scoredA = scoreRace(vectors, modelA);
    const scoredB = scoreRace(vectors, modelB);
    const rankA = rankOf(scoredA, r.kazananNo);
    const rankB = rankOf(scoredB, r.kazananNo);
    console.log(`${r.hipodrom} ${r.tarih} K${r.raceNo} | #${r.kazananNo} ${r.kazananAd} | ${r.v546_agfDahil_sira} | ${r.v546_agfCikarilmis_sira} | ${rankA} | ${rankB} | ${vectors.length}`);
    rows.push({ ...r, v1_modelA_sira: rankA, v1_modelB_sira: rankB, saha: vectors.length });
  }
  console.log(`\nToplam karsilastirilan (onbellekte olan): ${n}/${rca.length}`);
  fs.writeFileSync("C:/tmp/rca-agf-vs-v1-partial.json", JSON.stringify(rows, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
