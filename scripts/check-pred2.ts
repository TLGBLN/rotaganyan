import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const race = await db.race.findFirst({
    where: { raceNo: 2, raceDay: { date: new Date("2026-06-22T00:00:00.000Z"), hippodrome: { slug: "bursa" } } },
    include: { prediction: { include: { picks: { where: { rank: 1 }, include: { runner: { select: { no: true, name: true } } } } } } },
  });
  console.log(JSON.stringify(race?.prediction?.picks, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
