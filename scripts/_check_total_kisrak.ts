import { db } from "../src/lib/db";
async function main() {
  const total = await db.damStat.count();
  const byFilter = await db.damStat.groupBy({
    by: ["irk", "filtrePist", "filtreMesafe"],
    _count: true,
    orderBy: [{ irk: "asc" }, { filtrePist: "asc" }, { filtreMesafe: "asc" }],
  });
  console.log(`Toplam: ${total}`);
  for (const b of byFilter) console.log(`  ${b.irk} ${b.filtrePist} ${b.filtreMesafe}: ${b._count}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
