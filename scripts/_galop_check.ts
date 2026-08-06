import { db } from "../src/lib/db";
async function main() {
  const today = new Date("2026-07-12T00:00:00Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: today, hippodrome: { slug: "istanbul" } },
    include: {
      races: {
        orderBy: { raceNo: "asc" },
        select: {
          raceNo: true,
          runners: {
            select: {
              name: true,
              _count: { select: { gallops: true } },
            },
          },
        },
      },
    },
  });

  for (const rd of raceDays) {
    for (const race of rd.races) {
      const withGalop = race.runners.filter(r => r._count.gallops > 0).length;
      const total = race.runners.length;
      const names = race.runners.filter(r => r._count.gallops === 0).map(r => r.name).join(", ");
      console.log(`Kosu ${race.raceNo}: ${withGalop}/${total} galop${names ? `  | yok: ${names}` : ""}`);
    }
  }

  // Kosu 7'nin birinci atının galop kayitlarini bul (farkli runner'a mi baglanmis?)
  const kos7runners = raceDays[0]?.races.find(r => r.raceNo === 7)?.runners ?? [];
  if (kos7runners.length > 0) {
    const firstRunner = kos7runners[0];
    console.log(`\nKosu 7 ilk at: ${firstRunner.name}`);
    // Bu isimle tum galop kayitlarini bul
    const allRunners = await db.runner.findMany({
      where: { name: firstRunner.name },
      select: { id: true, name: true, _count: { select: { gallops: true } }, race: { select: { raceNo: true, raceDay: { select: { date: true } } } } },
    });
    allRunners.forEach(r => {
      console.log(`  runner ${r.id.slice(0,8)}: kosu ${r.race.raceNo}, ${r.race.raceDay.date.toISOString().slice(0,10)}, galop=${r._count.gallops}`);
    });
  }

  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
