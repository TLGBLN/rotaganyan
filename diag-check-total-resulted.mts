import { db } from "./src/lib/db";
async function main() {
  const total = await db.race.count({ where: { result: { isNot: null } } });
  const withEnoughRunners = await db.race.count({
    where: { result: { isNot: null }, runners: { some: {} } },
  });
  const earliest = await db.race.findFirst({
    where: { result: { isNot: null } },
    orderBy: { raceDay: { date: "asc" } },
    select: { raceDay: { select: { date: true } } },
  });
  const latest = await db.race.findFirst({
    where: { result: { isNot: null } },
    orderBy: { raceDay: { date: "desc" } },
    select: { raceDay: { select: { date: true } } },
  });
  console.log("Toplam sonuçlanmış yarış:", total);
  console.log("Tarih aralığı:", earliest?.raceDay.date.toISOString().slice(0,10), "->", latest?.raceDay.date.toISOString().slice(0,10));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
