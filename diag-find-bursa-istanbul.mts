import { db } from "./src/lib/db";

async function main() {
  const today = new Date();
  const from = new Date(today.getTime() - 3 * 86400000);

  const days = await db.raceDay.findMany({
    where: {
      date: { gte: from },
      hippodrome: { name: { in: ["Bursa", "İstanbul", "Istanbul"] } },
    },
    select: {
      date: true,
      hippodrome: { select: { name: true } },
      races: { select: { id: true, raceNo: true, classType: true, distance: true, surface: true, _count: { select: { runners: true } } }, orderBy: { raceNo: "asc" } },
    },
    orderBy: { date: "asc" },
  });

  for (const d of days) {
    console.log(`\n=== ${d.hippodrome.name} — ${d.date.toISOString().slice(0, 10)} ===`);
    for (const r of d.races) {
      console.log(`  K${r.raceNo} id=${r.id} sinif=${r.classType} mesafe=${r.distance} pist=${r.surface} saha=${r._count.runners}`);
    }
  }
  if (days.length === 0) console.log("Bu tarih araliginda Bursa/Istanbul programi bulunamadi.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
