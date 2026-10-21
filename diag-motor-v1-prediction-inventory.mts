import { db } from "./src/lib/db";

async function main() {
  const predictions = await db.prediction.findMany({
    select: {
      id: true,
      raceId: true,
      createdAt: true,
      updatedAt: true,
      published: true,
      publishedAt: true,
      race: {
        select: {
          time: true,
          raceDay: { select: { date: true } },
          result: {
            select: {
              winnerNo: true,
              winnerNos: true,
              enteredAt: true
            }
          },
          runners: {
            where: { scratched: false },
            select: { no: true }
          }
        }
      },
      picks: {
        select: {
          rank: true,
          score: true,
          scoreExact: true,
          runner: { select: { no: true } }
        }
      },
      history: {
        select: { id: true }
      }
    }
  });

  const completed = predictions.filter(p => p.race.result);

  let top1N = 0, top1Hit = 0;
  let top3N = 0, top3Hit = 0;
  let exactProbabilityFields = 0;
  let createdBeforeResult = 0;
  let updatedAfterResult = 0;
  let publishedBeforeResult = 0;

  const timeExamples = new Set<string>();

  for (const p of completed) {
    const result = p.race.result!;
    const winners = result.winnerNos.length
      ? result.winnerNos
      : result.winnerNo != null
        ? [result.winnerNo]
        : [];

    if (p.race.time) timeExamples.add(p.race.time);

    if (p.createdAt < result.enteredAt) createdBeforeResult++;
    if (p.updatedAt > result.enteredAt) updatedAfterResult++;
    if (p.publishedAt && p.publishedAt < result.enteredAt) {
      publishedBeforeResult++;
    }

    if (!winners.length) continue;

    const picks = [...p.picks].sort((a,b) => a.rank-b.rank);
    const first = picks.find(x => x.rank === 1);

    if (first?.runner?.no != null) {
      top1N++;
      if (winners.includes(first.runner.no)) top1Hit++;
    }

    const first3 = picks.filter(x => x.rank >= 1 && x.rank <= 3);

    if (first3.length === 3 &&
        first3.every(x => x.runner?.no != null)) {
      top3N++;
      if (first3.some(x => winners.includes(x.runner!.no))) {
        top3Hit++;
      }
    }

    const runnerCount = p.race.runners.length;
    const knownNumbers = picks.map(x => x.runner?.no);

    const completeField =
      runnerCount >= 2 &&
      picks.length === runnerCount &&
      knownNumbers.every(x => x != null) &&
      new Set(knownNumbers).size === runnerCount &&
      picks.every(x =>
        x.scoreExact != null &&
        Number.isFinite(x.scoreExact) &&
        x.scoreExact >= 0 &&
        x.scoreExact <= 100
      );

    if (completeField) {
      const sum = picks.reduce((s,x) => s + x.scoreExact!, 0);
      if (Math.abs(sum - 100) <= 1) {
        exactProbabilityFields++;
      }
    }
  }

  const dates = completed.map(
    p => p.race.raceDay.date.toISOString().slice(0,10)
  ).sort();

  console.log("V1_INV_TOTAL", predictions.length);
  console.log("V1_INV_COMPLETED", completed.length);
  console.log("V1_INV_PUBLISHED", completed.filter(p=>p.published).length);
  console.log("V1_INV_WITH_HISTORY", completed.filter(p=>p.history.length>0).length);
  console.log("V1_INV_DATE_RANGE", JSON.stringify({
    first: dates[0] ?? null,
    last: dates.at(-1) ?? null,
    distinctDays: new Set(dates).size
  }));
  console.log("V1_INV_TOP1", JSON.stringify({
    evaluated: top1N, hits: top1Hit,
    rate: top1N ? top1Hit/top1N : null
  }));
  console.log("V1_INV_TOP3", JSON.stringify({
    evaluated: top3N, hits: top3Hit,
    rate: top3N ? top3Hit/top3N : null
  }));
  console.log("V1_INV_EXACT_PROB_FIELDS", exactProbabilityFields);
  console.log("V1_INV_TIMING", JSON.stringify({
    createdBeforeResult,
    updatedAfterResult,
    publishedBeforeResult,
    warning: "Before result does not prove before race"
  }));
  console.log("V1_INV_RACE_TIME_EXAMPLES",
    JSON.stringify([...timeExamples].slice(0,10)));
  console.log("V1_INV_PASS");
}

main().catch(e => {
  console.error("V1_INV_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});