import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import {
  selectTrainingRaces,
  buildTrainingSet,
  computeFeatureStats,
  fitModel,
  scoreRace,
  explainRunner
} from "@/lib/motor-v1/engine/training";

const nTrain = Number(process.env.V1_TRAIN ?? 12);
const nValid = Number(process.env.V1_VALID ?? 4);
const cutoff = new Date("2026-10-17T00:00:00.000Z");

async function main() {
  if (!Number.isInteger(nTrain) || nTrain < 2 ||
      !Number.isInteger(nValid) || nValid < 1) {
    throw new Error("Invalid train/validation counts");
  }

  const candidates = await selectTrainingRaces(600, cutoff);
  const byDay = new Map<string, (typeof candidates)[number]>();

  for (const r of candidates) {
    const day = r.date.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, r);
  }

  const selected = [...byDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-(nTrain + nValid));

  if (selected.length !== nTrain + nValid) {
    throw new Error(
      `Insufficient distinct dates: ${selected.length}`
    );
  }

  console.log("V1_SELECTED_DATES", selected.map(
    r => r.date.toISOString().slice(0, 10)
  ));

  const ctx = await loadTempoContext();
  const dataset = [];

  for (const stub of selected) {
    const start = Date.now();
    const [race] = await buildTrainingSet([stub], ctx);

    dataset.push(race);
    console.log(
      "V1_FEATURE_BUILD",
      stub.date.toISOString().slice(0, 10),
      race.vectors.length,
      Date.now() - start
    );
  }

  const train = dataset.slice(0, nTrain);
  const valid = dataset.slice(nTrain);

  const stats = computeFeatureStats(
    train.flatMap(r => r.vectors)
  );

  const model = fitModel(train, stats);

  if (model.nRacesUsed < 2) {
    throw new Error("Insufficient valid training races");
  }

  console.log("V1_TRAINED", model.nRacesUsed);
  console.log("V1_TRAIN_SKIPPED", model.nRacesSkipped);
  console.log("V1_COEFFICIENTS", JSON.stringify(model.beta));

  let evaluated = 0;
  let top1 = 0;
  let totalLoss = 0;

  for (const race of valid) {
    if (race.winnerNo == null) continue;

    const scored = scoreRace(race.vectors, model);
    const winner = scored.find(r => r.no === race.winnerNo);

    if (!winner) continue;

    const sum = scored.reduce(
      (a, r) => a + r.probability, 0
    );

    if (Math.abs(sum - 1) > 1e-8) {
      throw new Error("Softmax sum invalid");
    }

    const sorted = [...scored].sort(
      (a, b) => b.probability - a.probability
    );

    const loss = -Math.log(
      Math.max(winner.probability, 1e-12)
    );

    evaluated++;
    totalLoss += loss;

    if (sorted[0].no === race.winnerNo) top1++;

    console.log("V1_VALIDATION_RACE", JSON.stringify({
      date: race.date.toISOString().slice(0, 10),
      actualWinner: race.winnerNo,
      predictedWinner: sorted[0].no,
      winnerProbability: winner.probability,
      logLoss: loss
    }));
  }

  console.log("V1_VALIDATED", evaluated);
  console.log(
    "V1_OOS_LOGLOSS",
    evaluated ? totalLoss / evaluated : null
  );
  console.log(
    "V1_OOS_TOP1",
    evaluated ? top1 / evaluated : null
  );

  const last = valid[valid.length - 1];
  const scored = scoreRace(last.vectors, model)
    .sort((a, b) => b.probability - a.probability);

  console.log("V1_LAST_RACE_SCORES", JSON.stringify(scored));

  const best = last.vectors.find(
    v => v.no === scored[0].no
  )!;

  const effects = explainRunner(best, model);

  if (Math.abs(effects.totalScore - scored[0].score) > 1e-8) {
    throw new Error("Signal contribution mismatch");
  }

  console.log("V1_SIGNAL_EFFECTS", JSON.stringify({
    horse: best.name,
    score: effects.totalScore,
    rows: effects.rows
  }));
}

main().catch(e => {
  console.error("V1_ERROR", e);
  process.exitCode = 1;
});
