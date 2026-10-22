import { db } from "./src/lib/db";

async function main() {
  const runners = await db.runner.findMany({
    where: { name: { contains: "LOVESICK", mode: "insensitive" } },
    select: {
      name: true, no: true,
      race: {
        select: {
          id: true, raceNo: true, result: { select: { winnerNos: true } },
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
        },
      },
    },
  });
  for (const r of runners) {
    console.log(`${r.name} #${r.no} | race=${r.race.id} ${r.race.raceDay.hippodrome.name} ${r.race.raceDay.date.toISOString().slice(0,10)} K${r.race.raceNo} | winnerNos=${JSON.stringify(r.race.result?.winnerNos)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
