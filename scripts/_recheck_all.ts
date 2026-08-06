import { db } from "@/lib/db";
async function main() {
  // Tüm "Ankara 1.Koşu" adaylarını bul (tarih farketmeksizin, son 3 gün)
  const races = await db.race.findMany({
    where: {
      raceNo: 1,
      raceDay: { hippodrome: { slug: "ankara" } },
    },
    include: {
      raceDay: true,
      prediction: { include: { picks: { orderBy: { rank: "asc" }, take: 3 } } },
    },
    orderBy: { raceDay: { date: "desc" } },
    take: 5,
  });
  for (const r of races) {
    console.log(`\nraceId=${r.id} tarih=${r.raceDay.date.toISOString().slice(0,10)}`);
    if (r.prediction) {
      console.log("  published:", r.prediction.published, "updatedAt:", r.prediction.updatedAt.toISOString());
      for (const p of r.prediction.picks) console.log(`    #${p.rank} ${p.runnerLabel} score=${p.score}`);
    } else {
      console.log("  prediction yok");
    }
  }
  process.exit(0);
}
main();
