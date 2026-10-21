// READ-ONLY. predictRaceV1() UCTAN UCA GOSTERIMI — unified-family-engine (10 aile + 13
// iliski) artik training.ts'in GERCEK, ONCEDEN FIT EDILMIS modeliyle (Model A, 150-yarislik
// ONAYLANMIS onbellekten yeniden kurulur, 0 yeni DB sorgusu, 0 yeni katsayi) TEK girdi
// noktasindan skorlaniyor. Model sozlesmesi hangi ailenin skora GERCEKTEN katki verdigini,
// hangisinin henuz katsayi ogrenilmesini bekledigini gosterir.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
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
  const stats = computeFeatureStats(trainSet.flatMap((t) => t.vectors));
  const model = fitModel(trainSet, stats, DEFAULT_FIT_OPTIONS);
  console.log(`Model A (onceden onaylanmis onbellekten yeniden kurulan, 0 yeni egitim): nRacesUsed=${model.nRacesUsed}, kod sayisi=${model.stats.size}`);

  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { sire: { not: null }, tjkAtId: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) { console.log("yaris yok"); return; }
  console.log(`\nDemo yarisi: ${race.id} ${race.raceDay.date.toISOString().slice(0, 10)} ${race.raceDay.hippodrome.name}\n`);

  const result = await predictRaceV1(race.id, model);
  if (!result) { console.log("predictRaceV1 null dondu"); return; }

  console.log("--- GERCEK TAHMIN SKORU (training.ts::scoreRace, onceden ogrenilmis beta) ---");
  for (const s of [...result.scored].sort((a, b) => b.probability - a.probability)) {
    console.log(`  #${s.no} ${s.name}: score=${s.score.toFixed(4)} probability=${(s.probability * 100).toFixed(2)}%`);
  }

  console.log("\n--- MODEL SOZLESMESI (aile -> skorda temsil mi, bekliyor mu) ---");
  for (const f of result.contract.families) {
    const durum = f.representedInModel ? (f.pendingCodes.length > 0 ? "KISMEN TEMSIL" : "TEMSIL EDILIYOR") : "KATSAYI BEKLIYOR";
    console.log(`  [${durum}] ${f.family}: scored=${JSON.stringify(f.scoredCodes)} pending=${JSON.stringify(f.pendingCodes)} excluded=${JSON.stringify(f.excludedCodes)}`);
  }
  console.log(`\n  Tam temsil edilen (fullyPending DISI) aile sayisi: ${10 - result.contract.fullyPendingFamilies.length}/10`);
  console.log(`  Katsayi bekleyen aileler: ${JSON.stringify(result.contract.fullyPendingFamilies)}`);

  const scoredInteractions = result.contract.interactions.filter((i) => i.scored).length;
  const excludedInteractions = result.contract.interactions.filter((i) => i.excluded).length;
  console.log(`\n  Iliskiler: ${result.contract.interactions.length} toplam, ${scoredInteractions} skorda, ${excludedInteractions} disarida-birakilmis (PIT/secilim-yanliligi), ${result.contract.interactions.length - scoredInteractions - excludedInteractions} katsayi bekliyor`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
