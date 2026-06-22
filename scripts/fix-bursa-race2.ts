import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const race = await db.race.findFirst({
    where: { raceNo: 2, raceDay: { date: new Date("2026-06-22T00:00:00.000Z"), hippodrome: { slug: "bursa" } } },
    include: { result: true, runners: { select: { no: true, name: true } } },
  });
  console.log(JSON.stringify(race, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
