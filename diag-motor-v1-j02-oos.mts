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

  // Ozellikler bir daha hesaplanmasin diye diske kaydet.
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const dir = join(process.cwd(), "src", "lib", "motor-v1", "artifacts");
  mkdirSync(dir, { recursive: true });

  const snapshot = join(dir, "j02-oos-21x6-snapshot.json");

  writeFileSync(snapshot, JSON.stringify({
    nTrain,
    nValid,
    cutoff: cutoff.toISOString(),
    dataset
  }), "utf8");

  console.log("V1_J02_SNAPSHOT", snapshot);

  // JOKEY_02 kapali veri. Diger 19 sinyal ayni kalir.
  const mask = (r: (typeof dataset)[number]) => ({
    ...r,
    vectors: r.vectors.map(v => ({
      ...v,
      signals: v.signals.map(s =>
        s.code === "JOKEY_02"
          ? { ...s, observed: false, rawValue: null }
          : s
      )
    }))
  });

  const maskedTrain = train.map(mask);
  const maskedValid = valid.map(mask);

  const maskedStats = computeFeatureStats(
    maskedTrain.flatMap(r => r.vectors)
  );

  const withoutJ02 = fitModel(maskedTrain, maskedStats);

  if (withoutJ02.nRacesUsed !== model.nRacesUsed) {
    throw new Error("Training race count mismatch");
  }

  let n = 0;
  let fullLoss = 0;
  let maskedLoss = 0;
  let uniformLoss = 0;
  let fullHits = 0;
  let maskedHits = 0;

  for (let i = 0; i < valid.length; i++) {
    const race = valid[i];

    if (race.winnerNo == null) {
      throw new Error("Missing OOS winner");
    }

    const full = scoreRace(race.vectors, model)
      .sort((a, b) => b.probability - a.probability);

    const masked = scoreRace(maskedValid[i].vectors, withoutJ02)
      .sort((a, b) => b.probability - a.probability);

    const a = full.find(x => x.no === race.winnerNo);
    const b = masked.find(x => x.no === race.winnerNo);

    if (!a || !b) {
      throw new Error("Winner not found");
    }

    const la = -Math.log(Math.max(a.probability, 1e-12));
    const lb = -Math.log(Math.max(b.probability, 1e-12));

    n++;
    fullLoss += la;
    maskedLoss += lb;
    uniformLoss += Math.log(race.vectors.length);

    if (full[0].no === race.winnerNo) fullHits++;
    if (masked[0].no === race.winnerNo) maskedHits++;

    console.log("V1_J02_RACE", JSON.stringify({
      date: race.date.toISOString().slice(0, 10),
      actualWinner: race.winnerNo,
      fullTop: full[0].no,
      withoutJ02Top: masked[0].no,
      fullLoss: la,
      withoutJ02Loss: lb
    }));
  }

  if (
    n !== nValid ||
    evaluated !== n ||
    fullHits !== top1 ||
    Math.abs(fullLoss - totalLoss) > 1e-8
  ) {
    throw new Error("OOS consistency check failed");
  }

  console.log("V1_J02_SUMMARY", JSON.stringify({
    trainingRaces: model.nRacesUsed,
    validationRaces: n,
    fullLogLoss: fullLoss / n,
    withoutJ02LogLoss: maskedLoss / n,
    uniformLogLoss: uniformLoss / n,
    deltaLogLoss: (maskedLoss - fullLoss) / n,
    fullTop1: fullHits / n,
    withoutJ02Top1: maskedHits / n
  }));

  console.log("V1_J02_OOS_PASS");

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
