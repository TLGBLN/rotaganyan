import "dotenv/config";
import { syncIdmanForDate } from "../src/server/services/ingest/tjk-idman-stats.adapter";
import { turkeyDateString } from "../src/lib/tz";

async function main() {
  // Optional date override: npx tsx scripts/run-galop-sync.ts 2026-07-13
  // Without a date, bugün için senkronlar
  const dateStr = process.argv[2] ?? turkeyDateString();
  console.log("İdman (galop) sync başlıyor:", dateStr);
  const result = await syncIdmanForDate(dateStr);
  console.log("Sonuç:", JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });