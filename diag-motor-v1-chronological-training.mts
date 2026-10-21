import { db } from "./src/lib/db";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import {
  computeFeatureStats,
  fitModel,
  scoreRace,
} from "./src/lib/motor-v1/engine/training";
import { mkdirSync, writeFileSync } from "node:fs";

async function main() {
  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: {
        date: {
          gte: new Date("2026-01-01T00:00:00Z"),
          lt: new Date("2026-09-01T00:00:00Z")
        }
      }
    },
    select: {
      id: true,
      raceNo: true,
      raceDay: { select: { date: true } },
      result: { select: { winnerNo: true } },
      runners: {
        where: { scratched: false },
        select: { no: true }
      }
    },
    orderBy: [
      { raceDay: { date: "asc" } },
      { raceNo: "asc" }
    ]
  });

  const eligible = races.filter(r =>
    r.result?.winnerNo != null &&
    r.runners.length >= 3 &&
    r.runners.some(x => x.no === r.result?.winnerNo)
  );

  function sampleMonths(
    months: number[],
    perMonth: number
  ) {
    return months.flatMap(month => {
      const group = eligible.filter(r =>
        r.raceDay.date.getUTCMonth() + 1 === month
      );

      const count = Math.min(perMonth, group.length);

      return Array.from({ length: count }, (_, i) =>
        group[Math.floor(
          (i + 0.5) * group.length / count
        )]
      );
    });
  }

  const trainTargets = sampleMonths(
    [1, 2, 3, 4, 5, 6], 10
  );
  const valTargets = sampleMonths([7, 8], 8);

  type Vector = Awaited<
    ReturnType<typeof buildFeatureVectorsForRace>
  >;

  type Sample = {
    raceId: string;
    winnerNo: number;
    vectors: Vector;
  };

  async function collect(
    targets: typeof races,
    phase: string
  ): Promise<Sample[]> {
    const output: Sample[] = [];

    for (const r of targets) {
      try {
        const vectors = await buildFeatureVectorsForRace(r.id);
        const winnerNo = r.result?.winnerNo;

        if (
          winnerNo == null ||
          vectors.length < 3 ||
          !vectors.some(x => x.no === winnerNo)
        ) {
          console.log("V1_SKIP", phase, r.id);
          continue;
        }

        output.push({
          raceId: r.id,
          winnerNo,
          vectors
        });
      } catch (error) {
        console.log("V1_ERROR", JSON.stringify({
          phase,
          raceId: r.id,
          error: String(error)
        }));
      }

      console.log("V1_PROGRESS", JSON.stringify({
        phase,
        completed: output.length,
        attempted: targets.indexOf(r) + 1,
        total: targets.length
      }));
    }

    return output;
  }

  console.log("V1_TRAINING_START", JSON.stringify({
    eligible: eligible.length,
    trainingTargets: trainTargets.length,
    validationTargets: valTargets.length,
    finalHoldout: "2026-09-01 onward — untouched"
  }));

  const train = await collect(trainTargets, "TRAIN");

  if (train.length < 20) {
    throw new Error("INSUFFICIENT_TRAINING_RACES");
  }

  const stats = computeFeatureStats(
    train.flatMap(r => r.vectors)
  );

  const model = fitModel(train, stats);

  console.log("V1_MODEL_FITTED", JSON.stringify({
    trainingRaces: train.length,
    coefficients: model.beta.length
  }));

  const validation = await collect(valTargets, "VALIDATION");

  if (validation.length < 5) {
    throw new Error("INSUFFICIENT_VALIDATION_RACES");
  }

  let correct = 0;
  let nll = 0;
  let uniformNll = 0;
  let uniformTop1 = 0;

  for (const race of validation) {
    const scored = scoreRace(race.vectors, model);

    const winner = scored.find(s => s.no === race.winnerNo);
    if (!winner) throw new Error("WINNER_MISSING");

    const predicted = scored.reduce((a, b) =>
      b.probability > a.probability ? b : a
    );

    if (predicted.no === race.winnerNo) correct++;

    nll -= Math.log(
      Math.max(1e-12, winner.probability)
    );

    uniformNll += Math.log(scored.length);
    uniformTop1 += 1 / scored.length;
  }

  const result = {
    status: "PROVISIONAL_RESEARCH",
    trainedOn: "2026-01 to 2026-06",
    validatedOn: "2026-07 to 2026-08",
    finalHoldout: "2026-09 to 2026-10-17",
    trainingRaces: train.length,
    validationRaces: validation.length,
    model: {
      top1: correct / validation.length,
      logLoss: nll / validation.length
    },
    uniformBaseline: {
      top1: uniformTop1 / validation.length,
      logLoss: uniformNll / validation.length
    },
    notes: [
      "Not production-ready",
      "Point-in-time source audit incomplete",
      "No final holdout used"
    ]
  };

  const folder = "src/lib/motor-v1/artifacts";
  mkdirSync(folder, { recursive: true });

  const file = `${folder}/v1-chronological-${
    new Date().toISOString().replace(/[:.]/g, "-")
  }.json`;

  writeFileSync(
    file,
    JSON.stringify(result, null, 2),
    { encoding: "utf8", flag: "wx" }
  );

  console.log("V1_TRAINING_RESULT", JSON.stringify(result));
  console.log("V1_TRAINING_REPORT", file);
  console.log("V1_TRAINING_PASS");
}

main().catch(error => {
  console.error("V1_TRAINING_FATAL", error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});