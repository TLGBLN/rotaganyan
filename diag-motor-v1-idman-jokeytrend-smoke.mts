import { db } from "./src/lib/db";
import { loadGalopPaceIndex, computeIdman01 } from "./src/lib/motor-v1/features/idman-galop";
import { computeJokeyTrend30 } from "./src/lib/motor-v1/features/int-jokey-trend";

async function main() {
  console.log("Galop pace index yukleniyor (TUM 64k kayit, bir kez)...");
  const t0 = Date.now();
  const paceIndex = await loadGalopPaceIndex();
  console.log(`Yuklendi: ${paceIndex.size} kova, ${Date.now() - t0}ms`);
  for (const [k, v] of paceIndex) console.log(`  kova ${k}: ${v.length} nokta`);

  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { tjkAtId: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: {
      id: true, raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, name: true, jockey: true, tjkAtId: true, gallops: { select: { date: true, splits: true } } } },
    },
  });
  if (!race) { console.log("yaris yok"); return; }
  console.log(`\nYaris: ${race.id} ${race.raceDay.date.toISOString().slice(0,10)}, ${race.runners.length} at`);

  for (const r of race.runners) {
    const idman = computeIdman01(r.gallops, race.raceDay.date, paceIndex);
    const trend = await computeJokeyTrend30(r.jockey, race.raceDay.date);
    console.log(`  at#${r.no} ${r.name} (jokey=${r.jockey}): IDMAN_01=${idman.value?.toFixed(3) ?? "null"} (${idman.missingReason ?? "OK, n=" + idman.populationN}) | JOKEY_TREND=${trend.value?.toFixed(3) ?? "null"} (son30:${trend.son30.wins}/${trend.son30.observed} onceki30:${trend.onceki30.wins}/${trend.onceki30.observed}) ${trend.missingReason ?? ""}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
