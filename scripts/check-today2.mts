import { db } from "../src/lib/db";
const today = new Date("2026-07-04T00:00:00.000Z");
const tomorrow = new Date("2026-07-05T00:00:00.000Z");
const days = await db.raceDay.findMany({
  where: { date: { gte: today, lt: tomorrow } },
  include: { hippodrome: true, races: { include: { _count: { select: { runners: true } } } } }
});
for (const d of days) {
  const runnerTotals = d.races.reduce((s, r) => s + r._count.runners, 0);
  console.log(d.hippodrome.name + " | " + d.races.length + " kosu | " + runnerTotals + " runner");
  for (const r of d.races) {
    console.log("  Kos" + r.raceNo + " " + r.classType + " | " + r._count.runners + " runner");
  }
}
await db.$disconnect();
