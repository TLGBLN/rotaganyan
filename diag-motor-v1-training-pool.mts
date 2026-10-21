import { db } from "./src/lib/db";

async function main() {
  const races = await db.race.findMany({
    where: { result: { isNot: null } },
    select: {
      id: true,
      raceDay: { select: { date: true } },
      result: {
        select: { winnerNo: true, winnerNos: true }
      },
      runners: {
        where: { scratched: false },
        select: { no: true, tjkAtId: true }
      }
    },
    orderBy: { raceDay: { date: "asc" } }
  });

  const eligible = races.filter(r => {
    const winners = r.result?.winnerNos.length
      ? r.result.winnerNos
      : r.result?.winnerNo != null
        ? [r.result.winnerNo]
        : [];

    return r.runners.length >= 3 &&
      winners.some(w => r.runners.some(h => h.no === w));
  });

  const monthly = new Map<string, {
    races: number;
    eligible: number;
    distinctDays: Set<string>;
  }>();

  for (const r of races) {
    const date = r.raceDay.date.toISOString().slice(0, 10);
    const month = date.slice(0, 7);

    if (!monthly.has(month)) {
      monthly.set(month, {
        races: 0, eligible: 0,
        distinctDays: new Set()
      });
    }

    const entry = monthly.get(month)!;
    entry.races++;
    entry.distinctDays.add(date);

    if (eligible.includes(r)) entry.eligible++;
  }

  console.log("V1_POOL_TOTAL", races.length);
  console.log("V1_POOL_ELIGIBLE", eligible.length);

  for (const [month, x] of monthly) {
    console.log("V1_POOL_MONTH", JSON.stringify({
      month,
      races: x.races,
      eligible: x.eligible,
      days: x.distinctDays.size
    }));
  }

  console.log("V1_POOL_PASS");
}

main().catch(e => {
  console.error("V1_POOL_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});