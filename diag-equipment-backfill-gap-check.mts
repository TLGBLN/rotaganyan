import { db } from "./src/lib/db";
import fs from "node:fs";
async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const allIds = [...lock.trainRaceIds, ...lock.holdoutRaceIds];
  const races = await db.race.findMany({
    where: { id: { in: allIds } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { equipment: true } } },
  });
  let racesWithAnyEquip = 0, racesAllBlank = 0;
  const dates: string[] = [];
  for (const race of races) {
    const anyFilled = race.runners.some((r) => r.equipment && r.equipment.trim() !== "");
    if (anyFilled) racesWithAnyEquip++; else { racesAllBlank++; dates.push(race.raceDay.date.toISOString().slice(0,10)); }
  }
  console.log(`Toplam yaris: ${races.length}`);
  console.log(`En az 1 runner'da equipment dolu olan yaris: ${racesWithAnyEquip}`);
  console.log(`TÜM runner'ları BOŞ olan yaris (muhtemel backfill bosluğu): ${racesAllBlank}`);
  console.log(`Tüm-boş yarışların tarih aralığı: ${[...new Set(dates)].sort().join(", ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
