import { db } from "./src/lib/db";
import { gatherFaz1V5, faz2V5Sirala } from "./src/lib/methodology/v5-engine";

async function main() {
  const v5Baslangic = new Date("2026-08-16T00:00:00+03:00");

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: v5Baslangic }, hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } },
      runners: { some: {} },
    },
    select: { id: true, result: { select: { actualOrder: true } } },
  });

  console.log(`Toplam aday koşu: ${races.length}`);

  let islenen = 0;
  let top1 = 0;
  let top3 = 0;
  let hatali = 0;

  for (const race of races) {
    const actualOrder = race.result?.actualOrder as number[] | null;
    if (!Array.isArray(actualOrder) || actualOrder.length === 0) continue;
    try {
      const faz1 = await gatherFaz1V5(race.id);
      if (!faz1 || faz1.runners.length < 2) continue;
      const sirali = faz2V5Sirala(faz1);
      const modelSirasi = [...sirali].sort((a, b) => b.olasilik - a.olasilik);
      const winner = actualOrder[0];
      const top3Set = new Set(actualOrder.slice(0, 3));

      islenen++;
      if (modelSirasi[0]?.no === winner) top1++;
      if (modelSirasi.slice(0, 3).some((r) => r.no === winner)) top3++;
    } catch (e) {
      hatali++;
      console.error(`  hata raceId=${race.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nİşlenen koşu: ${islenen} (hata: ${hatali})`);
  console.log(`V5.27 (GÜNCEL kod) geriye dönük top1: %${((top1 / islenen) * 100).toFixed(1)} (${top1}/${islenen})`);
  console.log(`V5.27 (GÜNCEL kod) geriye dönük top3: %${((top3 / islenen) * 100).toFixed(1)} (${top3}/${islenen})`);

  process.exit(0);
}

main();
