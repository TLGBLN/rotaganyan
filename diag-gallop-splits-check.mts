import { db } from "./src/lib/db";
async function main() {
  const rows = await db.gallop.findMany({ take: 8, orderBy: { date: "desc" }, select: { date: true, track: true, surface: true, splits: true } });
  for (const r of rows) console.log(JSON.stringify({ date: r.date.toISOString().slice(0,10), track: r.track, surface: r.surface, splits: r.splits }));
  const total = await db.gallop.count();
  console.log("Toplam Gallop kaydi:", total);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
