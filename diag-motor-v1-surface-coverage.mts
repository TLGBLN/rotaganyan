import { db } from "@/lib/db";
import { parseSurface } from "@/lib/motor-v1/features/surface-classifier";

type HistoryRow = { surface?: string };

async function main() {
  const rows = await db.horseRaceHistoryCache.findMany({ select: { rowsJson: true } });
  let total = 0;
  let unknown = 0;
  const unknownSamples = new Set<string>();
  const distinctValues = new Map<string, number>();
  for (const r of rows) {
    const arr = Array.isArray(r.rowsJson) ? (r.rowsJson as HistoryRow[]) : [];
    for (const row of arr) {
      total++;
      const raw = typeof row.surface === "string" ? row.surface : "";
      distinctValues.set(raw, (distinctValues.get(raw) ?? 0) + 1);
      const parsed = parseSurface(raw);
      if (parsed.parseStatus === "UNKNOWN") {
        unknown++;
        unknownSamples.add(raw);
      }
    }
  }
  console.log("TÜM VERİ TABANI — toplam satır:", total, "| distinct değer:", distinctValues.size);
  console.log("UNKNOWN satır sayısı:", unknown, `(%${((unknown / total) * 100).toFixed(3)})`);
  console.log("UNKNOWN örnek değerler:", [...unknownSamples].slice(0, 20));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
