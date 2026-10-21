import { db } from "./src/lib/db";

async function main() {
  const records = await db.prediction.findMany({
    select: {
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
          scoreExact: true,
          runner: { select: { no: true } }
        }
      }
    }
  });

  const completed = records.filter(p => p.race.result);
  let missingTime = 0;
  let publishedPreRace = 0;
  let editedAfterStart = 0;
  let strictCount = 0;
  let eligible = 0;
  let top1 = 0;
  let top3 = 0;
  let randomTop1 = 0;
  let randomTop3 = 0;
  let exactN = 0;
  let loss = 0;
  let uniformLoss = 0;
  let deadHeat = 0;

  for (const p of completed) {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(
      p.race.time?.trim() ?? ""
    );

    if (!match || Number(match[1]) > 23) {
      missingTime++;
      continue;
    }

    const d = p.race.raceDay.date;
    const start = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      Number(match[1]) - 3,
      Number(match[2])
    );

    if (!p.publishedAt ||
        !p.published ||
        p.publishedAt.getTime() >= start) {
      continue;
    }

    publishedPreRace++;

    if (p.updatedAt.getTime() >= start) {
      editedAfterStart++;
      continue;
    }

    if (p.createdAt.getTime() >= start ||
        p.race.result!.enteredAt.getTime() < start) {
      continue;
    }

    strictCount++;

    const result = p.race.result!;
    const winners = result.winnerNos.length
      ? result.winnerNos
      : result.winnerNo == null ? [] : [result.winnerNo];

    if (winners.length > 1) {
      deadHeat++;
      continue;
    }

    if (winners.length !== 1) continue;

    const field = new Set(p.race.runners.map(r => r.no));
    const picks = [...p.picks].sort((a,b) => a.rank-b.rank);

    const first3 = picks.filter(
      x => x.rank >= 1 && x.rank <= 3
    );

    if (field.size < 3 ||
        first3.length !== 3 ||
        first3.some(x =>
          x.runner?.no == null ||
          !field.has(x.runner.no)
        )) {
      continue;
    }

    const winner = winners[0];
    const first = first3.find(x => x.rank === 1);

    if (!first) continue;

    eligible++;
    if (first.runner!.no === winner) top1++;
    if (first3.some(x => x.runner!.no === winner)) top3++;

    randomTop1 += 1 / field.size;
    randomTop3 += 3 / field.size;

    const complete =
      picks.length === field.size &&
      picks.every((x,i) =>
        x.rank === i + 1 &&
        x.runner?.no != null &&
        field.has(x.runner.no) &&
        x.scoreExact != null &&
        Number.isFinite(x.scoreExact) &&
        x.scoreExact >= 0 &&
        x.scoreExact <= 100
      ) &&
      new Set(picks.map(x => x.runner!.no)).size === field.size;

    if (!complete) continue;

    const sum = picks.reduce(
      (s,x) => s + x.scoreExact!, 0
    );

    if (Math.abs(sum - 100) > 1 || sum <= 0) continue;

    const winnerPick = picks.find(
      x => x.runner!.no === winner
    );

    if (!winnerPick) continue;

    exactN++;
    loss -= Math.log(
      Math.max(winnerPick.scoreExact! / sum, 1e-12)
    );
    uniformLoss += Math.log(field.size);
  }

  console.log("V1_PRE_TIMING", JSON.stringify({
    completed: completed.length,
    missingTime,
    publishedPreRace,
    editedAfterStart,
    strictCount,
    deadHeat
  }));

  console.log("V1_PRE_RANKING", JSON.stringify({
    evaluated: eligible,
    top1Hits: top1,
    top1Rate: eligible ? top1/eligible : null,
    top3Hits: top3,
    top3Rate: eligible ? top3/eligible : null,
    uniformTop1: eligible ? randomTop1/eligible : null,
    uniformTop3: eligible ? randomTop3/eligible : null
  }));

  console.log("V1_PRE_LOGLOSS", JSON.stringify({
    evaluated: exactN,
    logLoss: exactN ? loss/exactN : null,
    uniformLogLoss: exactN ? uniformLoss/exactN : null
  }));

  console.log("V1_PRE_PASS");
}

main().catch(e => {
  console.error("V1_PRE_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});