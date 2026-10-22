import { db } from "./src/lib/db";
async function main() {
  const race = await db.race.findUnique({
    where: { id: "cmvg7uuhj00ci08jp4q8yo35m" },
    select: {
      raceNo: true, result: { select: { winnerNos: true } },
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: { select: { no: true, name: true }, orderBy: { no: "asc" } },
    },
  });
  console.log(JSON.stringify(race, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
