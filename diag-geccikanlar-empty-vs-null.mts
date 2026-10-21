import { db } from "./src/lib/db";
async function main() {
  const totalNotNull = await db.result.count({ where: { gecCikanlar: { not: null } } });
  const rows = await db.result.findMany({ where: { gecCikanlar: { not: null } }, select: { gecCikanlar: true } });
  let emptyArr = 0, nonEmpty = 0, other = 0;
  for (const r of rows) {
    if (Array.isArray(r.gecCikanlar)) {
      if (r.gecCikanlar.length === 0) emptyArr++; else nonEmpty++;
    } else other++;
  }
  console.log("NOT NULL toplam:", totalNotNull, "| bos dizi []:", emptyArr, "| dolu dizi (>=1 at):", nonEmpty, "| diger:", other);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
