import { db } from "../src/lib/db";
const today = new Date("2026-07-04T00:00:00.000Z");
const tomorrow = new Date("2026-07-05T00:00:00.000Z");
const days = await db.raceDay.findMany({
  where: { date: { gte: today, lt: tomorrow } },
  include: { hippodrome: true, races: { select: { raceNo: true, classType: true } } }
});
for (const d of days) {
  console.log(d.hippodrome.name + " - " + d.races.length + " races");
}
if (days.length === 0) console.log("NO DATA for today");
await db.$disconnect();
