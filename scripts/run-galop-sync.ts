import { syncGalopForDate } from "../src/server/services/ingest/liderform-galop.adapter";

async function main() {
  // Optional date override: npx tsx scripts/run-galop-sync.ts 2026-07-13
  // Without a date, auto-detects from liderform.com.tr/program/galop
  const dateStr = process.argv[2] as string | undefined;
  console.log("Galop sync başlıyor:", dateStr ?? "auto");
  const result = await syncGalopForDate(dateStr);
  console.log("Sonuç:", JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
