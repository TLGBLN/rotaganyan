import { db } from "./src/lib/db";
async function main() {
  console.log("=== AccuraceHorseSplit.checkpoints ornek ===");
  const splits = await db.accuraceHorseSplit.findMany({ where: { runnerId: { not: null } }, take: 2, select: { horseName: true, checkpoints: true, place: true, finishTimeReal: true } });
  console.log(JSON.stringify(splits, null, 2));

  console.log("\n=== Result.gecCikanlar ornek + toplam sayilar ===");
  const totalResults = await db.result.count();
  const gecCikanDolu = await db.result.count({ where: { gecCikanlar: { not: null } } });
  console.log("Toplam Result:", totalResults, "gecCikanlar dolu:", gecCikanDolu);
  const gecOrnek = await db.result.findMany({ where: { gecCikanlar: { not: null } }, take: 3, select: { gecCikanlar: true } });
  console.log(JSON.stringify(gecOrnek, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
