import { db } from "./src/lib/db";
async function main() {
  const raceCount = await db.accuraceRace.count();
  const splitCount = await db.accuraceHorseSplit.count({ where: { runnerId: { not: null } } });
  console.log("AccuraceRace satir sayisi (yaris basina 1):", raceCount);
  console.log("AccuraceHorseSplit (runnerId dolu, at basina 1):", splitCount);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
