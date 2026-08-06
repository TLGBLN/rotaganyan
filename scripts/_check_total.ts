import { db } from "../src/lib/db";
async function main() {
  console.log(`Toplam: ${await db.sireStat.count()}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
