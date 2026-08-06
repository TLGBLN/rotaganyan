import { db } from "../src/lib/db";
const start = new Date("2026-07-05T00:00:00.000Z");
const end   = new Date("2026-07-06T00:00:00.000Z");
const days = await db.raceDay.findMany({
  where: { date: { gte: start, lt: end } },
  include: { hippodrome: true, races: { select: { raceNo: true } } }
});
for (const d of days) console.log(d.hippodrome.name + " - " + d.races.length + " kosu");
await db.$disconnect();
