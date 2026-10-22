import { db } from "./src/lib/db";
async function main() {
  const total = await db.runner.count({ where: { scratched: false } });
  const nonNull = await db.runner.count({ where: { scratched: false, equipment: { not: null } } });
  const nonEmpty = await db.runner.count({ where: { scratched: false, equipment: { not: null, notIn: [""] } } });
  console.log(`Toplam scratched=false runner: ${total}`);
  console.log(`equipment NOT NULL: ${nonNull} (%${(100*nonNull/total).toFixed(2)})`);
  console.log(`equipment NOT NULL ve NOT EMPTY: ${nonEmpty} (%${(100*nonEmpty/total).toFixed(2)})`);

  // Tarihe gore kirilim - belki yalniz eski tarihlerde bos
  const sample = await db.runner.findMany({
    where: { scratched: false },
    select: { equipment: true, race: { select: { raceDay: { select: { date: true } } } } },
    orderBy: { race: { raceDay: { date: "desc" } } },
    take: 500,
  });
  const nonEmptyRecent = sample.filter((r) => r.equipment && r.equipment.trim() !== "").length;
  console.log(`En son 500 runner (tarihe gore DESC) icinde equipment dolu: ${nonEmptyRecent}/500`);
  const dates = sample.map((s) => s.race.raceDay.date.toISOString().slice(0,10));
  console.log(`Bu 500 ornegin tarih araligi: ${dates[dates.length-1]} - ${dates[0]}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
