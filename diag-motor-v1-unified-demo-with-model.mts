// READ-ONLY. MODELIN_SKORUNDA'yi GERCEK bir FittedModel ile gosterir. Bu model, ONCEDEN
// ONAYLANMIS 150-yarislik ab-feature-cache.json'dan, AYNI DEFAULT_FIT_OPTIONS ile yeniden
// kurulur - SIFIR yeni DB sorgusu, SIFIR yeni deney. "Yeni egitim" DEGIL, zaten yapilmis
// A/B karsilastirmasinin Model A'sinin AYNI sekilde yeniden turetilmesi.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { computeFeatureStats, fitModel, DEFAULT_FIT_OPTIONS, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";
type CacheRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Record<string, CacheRaceShape>;
  const trainSet: TrainingRace[] = lock.trainRaceIds.filter((id) => cache[id]).map((id) => {
    const r = cache[id];
    const vectors: RunnerFeatureVector[] = r.runners.map((rr) => ({ raceId: id, no: rr.no, name: rr.name, tjkAtId: null, jockey: null, signals: rr.vectors }));
    return { raceId: id, date: new Date(r.date), vectors, winnerNo: r.winnerNo };
  });
  const statsA = computeFeatureStats(trainSet.flatMap((t) => t.vectors)); // codes verilmedi -> SIGNAL_CODES (Model A ile AYNI)
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  console.log(`Model A yeniden kuruldu (onceden onaylanmis 150-yarislik onbellekten, 0 yeni DB sorgusu): nRacesUsed=${modelA.nRacesUsed}, kod sayisi=${modelA.stats.size}`);

  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { sire: { not: null }, tjkAtId: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) { console.log("yaris yok"); return; }
  console.log(`\nDemo yarisi: ${race.id} ${race.raceDay.date.toISOString().slice(0,10)} ${race.raceDay.hippodrome.name}`);

  const results = await computeUnifiedFamiliesForRace(race.id, modelA); // MODEL VERILDI
  const r = results[0];
  console.log(`\n--- AT #${r.no} ${r.name} — featureStatus (MODELIN_SKORUNDA dahil) ---`);
  for (const code in r.featureStatus) {
    console.log(`  [${r.featureStatus[code]}] ${code}`);
  }
  const counts: Record<string, number> = {};
  for (const code in r.featureStatus) counts[r.featureStatus[code]] = (counts[r.featureStatus[code]] ?? 0) + 1;
  console.log(`\nDurum dagilimi: ${JSON.stringify(counts)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
