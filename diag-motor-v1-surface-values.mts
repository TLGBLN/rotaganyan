import { db } from "@/lib/db";

type HistoryRow = { surface?: string; distance?: number };

async function main() {
  const rows = await db.horseRaceHistoryCache.findMany({ take: 300, select: { rowsJson: true } });
  const surfaceCounts = new Map<string, number>();
  let totalRows = 0;
  for (const r of rows) {
    const arr = Array.isArray(r.rowsJson) ? (r.rowsJson as HistoryRow[]) : [];
    for (const row of arr) {
      totalRows++;
      const s = typeof row.surface === "string" ? row.surface : "<missing>";
      surfaceCounts.set(s, (surfaceCounts.get(s) ?? 0) + 1);
    }
  }
  console.log("totalRows sampled:", totalRows, "from", rows.length, "horses");
  console.log([...surfaceCounts.entries()].sort((a, b) => b[1] - a[1]));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
