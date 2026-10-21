import { db } from "./src/lib/db";

async function main() {
  const start = new Date("2023-01-01T00:00:00Z");
  const end = new Date("2027-01-01T00:00:00Z");

  const records = await db.accuraceRace.findMany({
    where: {
      date: { gte: start, lt: end }
    },
    select: {
      date: true,
      raceId: true,
      citySlug: true,
      raceNo: true,
      _count: {
        select: { splits: true }
      }
    }
  });

  for (const year of [2023, 2024, 2025, 2026]) {
    const rows = records.filter(
      r => r.date.getUTCFullYear() === year
    );

    const linked = rows.filter(r => r.raceId != null);
    const standalone = rows.filter(r => r.raceId == null);
    const withSplits = rows.filter(r => r._count.splits > 0);

    const tjkCount = await db.tjkDereceKaydi.count({
      where: {
        tarih: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00Z`)
        }
      }
    });

    console.log("V1_ARCHIVE_YEAR", JSON.stringify({
      year,
      accuraceRaces: rows.length,
      linkedToRace: linked.length,
      standalone: standalone.length,
      withSplits: withSplits.length,
      totalSplits: rows.reduce(
        (sum, r) => sum + r._count.splits, 0
      ),
      tjkDegreeRecords: tjkCount
    }));
  }

  console.log("V1_ARCHIVE_INVENTORY_PASS");
}

main().catch(error => {
  console.error("V1_ARCHIVE_INVENTORY_ERROR", error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});