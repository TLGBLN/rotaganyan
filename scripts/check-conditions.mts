import { db } from "../src/lib/db";
const start = new Date("2026-07-05T00:00:00.000Z");
const end   = new Date("2026-07-06T00:00:00.000Z");
const days = await db.raceDay.findMany({
  where: { date: { gte: start, lt: end } },
  include: { hippodrome: true, races: { select: { raceNo: true, classType: true, conditions: true } } }
});
for (const d of days) {
  console.log("=== " + d.hippodrome.name + " ===");
  for (const r of d.races) {
    console.log("  " + r.raceNo + ". " + r.classType + (r.conditions ? " ? " + r.conditions : ""));
  }
}
await db.$disconnect();
