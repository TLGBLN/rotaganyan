import { syncGalopForDate } from "../src/server/services/ingest/liderform-galop.adapter";

async function main() {
  const arg = process.argv[2];
  let dateStr: string;
  if (arg) {
    dateStr = arg;
  } else {
    const now = new Date();
    dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  }
  console.log("Galop sync başlıyor:", dateStr);
  const result = await syncGalopForDate(dateStr);
  console.log("Sonuç:", JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
