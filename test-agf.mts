import { syncAgfForDate } from "./src/server/services/agf-sync";
import { getAgfMovers } from "./src/server/services/agf-trend.service";

async function main() {
  const today = new Date("2026-07-03T00:00:00Z");
  const dateStr = "2026-07-03";

  console.log("=== Running AGF sync ===");
  const syncResult = await syncAgfForDate(today);
  console.log(JSON.stringify(syncResult, null, 2));

  console.log("\n=== AGF Movers after sync ===");
  const movers = await getAgfMovers(dateStr);
  console.log(`Risers: ${movers.risers.length}, Fallers: ${movers.fallers.length}`);
  movers.risers.slice(0, 3).forEach(r =>
    console.log(`  ↑ ${r.name} (${r.hippodromeName} R${r.raceNo}): ${r.first} → ${r.last} (Δ${r.delta > 0 ? "+" : ""}${r.delta})`));
  movers.fallers.slice(0, 3).forEach(r =>
    console.log(`  ↓ ${r.name} (${r.hippodromeName} R${r.raceNo}): ${r.first} → ${r.last} (Δ${r.delta})`));
}
main().catch(console.error);
