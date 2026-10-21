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
  // OOS degerlendirmesi yukarida 21+6 olarak tamamlandi.
  // Son kullanim modeli tum 27 etiketli yaristan yeniden fit edilir.
  const finalStats = computeFeatureStats(
    dataset.flatMap(r => r.vectors)
  );
  const finalModel = fitModel(dataset, finalStats);

  if (
    finalModel.nRacesUsed !== dataset.length ||
    finalModel.names.length !== finalModel.beta.length ||
    finalModel.names.length !== 40 ||
    !finalModel.beta.every(Number.isFinite)
  ) {
    throw new Error("Final model integrity check failed");
  }

  const { MODEL_VERSION } =
    await import("./src/lib/motor-v1/engine/training");

  const artifact = {
    schemaVersion: 1,
    modelVersion: MODEL_VERSION,
    createdAt: new Date().toISOString(),
    trainingStartDate: dataset[0].date.toISOString().slice(0, 10),
    trainingEndDate: dataset[dataset.length - 1].date.toISOString().slice(0, 10),
    validation: {
      evaluatedModelTrainingRaces: model.nRacesUsed,
      validationRaces: evaluated,
      logLoss: evaluated ? totalLoss / evaluated : null,
      top1: evaluated ? top1 / evaluated : null,
      note: "OOS metrics belong to the 21-race model, not the final 27-race model"
    },
    model: {
      beta: finalModel.beta,
      names: finalModel.names,
      stats: [...finalModel.stats.entries()],
      opts: finalModel.opts,
      nRacesUsed: finalModel.nRacesUsed,
      nRacesSkipped: finalModel.nRacesSkipped
    }
  };

  // JSON'dan yeniden yukleme, ayni yarista ayni sonucu vermeli.
  const roundTrip = JSON.parse(JSON.stringify(artifact)) as typeof artifact;
  const restored = {
    ...roundTrip.model,
    stats: new Map(roundTrip.model.stats)
  };

  const before = scoreRace(last.vectors, finalModel);
  const after = scoreRace(last.vectors, restored);

  if (
    before.length !== after.length ||
    before.some((r, i) =>
      r.no !== after[i].no ||
      Math.abs(r.score - after[i].score) > 1e-12 ||
      Math.abs(r.probability - after[i].probability) > 1e-12
    )
  ) {
    throw new Error("Saved model round-trip parity failed");
  }

  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const dir = join(process.cwd(), "src", "lib", "motor-v1", "artifacts");
  mkdirSync(dir, { recursive: true });

  const path = join(dir, "model-v1-pilot.json");
  writeFileSync(path, JSON.stringify(artifact, null, 2), "utf8");

  console.log("V1_FINAL_TRAINED", finalModel.nRacesUsed);
  console.log("V1_MODEL_PARITY", "PASS");
  console.log("V1_MODEL_SAVED", path);
}

main().catch(e => {
  console.error("V1_ERROR", e);
  process.exitCode = 1;
});
