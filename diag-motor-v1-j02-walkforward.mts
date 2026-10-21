import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeFeatureStats,
  fitModel,
  scoreRace,
  type TrainingRace,
} from "./src/lib/motor-v1/engine/training";

const path = resolve(
  process.cwd(),
  "src/lib/motor-v1/artifacts/j02-oos-21x6-snapshot.json"
);

const snapshot = JSON.parse(readFileSync(path, "utf8"));

if (
  snapshot.nTrain !== 21 ||
  snapshot.nValid !== 6 ||
  !Array.isArray(snapshot.dataset) ||
  snapshot.dataset.length !== 27
) {
  throw new Error("Snapshot integrity failed");
}

const dataset = snapshot.dataset.map((r: TrainingRace & {date: string}) => ({
  ...r,
  date: new Date(r.date),
})) as TrainingRace[];

for (let i = 0; i < dataset.length; i++) {
  const r = dataset[i];

  if (
    !Number.isFinite(r.date.getTime()) ||
    r.vectors.length < 2 ||
    !r.vectors.some(v => v.no === r.winnerNo) ||
    (i > 0 && r.date.getTime() <= dataset[i-1].date.getTime())
  ) {
    throw new Error(`Invalid race at index ${i}`);
  }
}

function maskRace(r: TrainingRace): TrainingRace {
  return {
    ...r,
    vectors: r.vectors.map(v => ({
      ...v,
      signals: v.signals.map(s =>
        s.code === "JOKEY_02"
          ? { ...s, observed: false, rawValue: null }
          : s
      ),
    })),
  };
}

function fitPair(train: TrainingRace[]) {
  const fullStats = computeFeatureStats(
    train.flatMap(r => r.vectors)
  );

  const full = fitModel(train, fullStats);

  const maskedTrain = train.map(maskRace);
  const maskedStats = computeFeatureStats(
    maskedTrain.flatMap(r => r.vectors)
  );

  const masked = fitModel(maskedTrain, maskedStats);

  if (
    full.nRacesUsed !== train.length ||
    masked.nRacesUsed !== train.length
  ) {
    throw new Error("Training race count mismatch");
  }

  return { full, masked };
}

function evaluate(
  race: TrainingRace,
  models: ReturnType<typeof fitPair>
) {
  const full = scoreRace(race.vectors, models.full)
    .sort((a,b) => b.probability - a.probability);

  const masked = scoreRace(
    maskRace(race).vectors, models.masked
  ).sort((a,b) => b.probability - a.probability);

  const a = full.find(r => r.no === race.winnerNo);
  const b = masked.find(r => r.no === race.winnerNo);

  if (!a || !b) {
    throw new Error("Winner not found");
  }

  for (const scores of [full, masked]) {
    const sum = scores.reduce((s,r) => s+r.probability, 0);
    if (
      scores.some(r => !Number.isFinite(r.probability)) ||
      Math.abs(sum - 1) > 1e-8
    ) {
      throw new Error("Probability integrity failed");
    }
  }

  return {
    date: race.date.toISOString().slice(0,10),
    fullLoss: -Math.log(Math.max(a.probability,1e-12)),
    maskedLoss: -Math.log(Math.max(b.probability,1e-12)),
    fullHit: Number(full[0].no === race.winnerNo),
    maskedHit: Number(masked[0].no === race.winnerNo),
    uniformLoss: Math.log(race.vectors.length),
  };
}

function summarize(rows: ReturnType<typeof evaluate>[]) {
  const avg = (key: keyof ReturnType<typeof evaluate>) =>
    rows.reduce((s,r) => s + Number(r[key]),0) / rows.length;

  const full = avg("fullLoss");
  const masked = avg("maskedLoss");

  return {
    races: rows.length,
    fullLogLoss: full,
    withoutJ02LogLoss: masked,
    deltaLogLoss: masked - full,
    uniformLogLoss: avg("uniformLoss"),
    fullTop1: avg("fullHit"),
    withoutJ02Top1: avg("maskedHit"),
    maskedBetterRaces: rows.filter(
      r => r.maskedLoss < r.fullLoss
    ).length,
  };
}

// Kaydedilen 21+6 sonucunu yeniden uret.
const baselinePair = fitPair(dataset.slice(0,21));
const baseline = summarize(
  dataset.slice(21).map(r => evaluate(r,baselinePair))
);

if (
  Math.abs(baseline.fullLogLoss - 2.347884432720369) > 1e-7 ||
  Math.abs(baseline.withoutJ02LogLoss - 2.2842191618312087) > 1e-7
) {
  throw new Error("Snapshot does not reproduce prior OOS");
}

console.log("V1_J02_SNAPSHOT_PARITY", "PASS");

// Genisleyen egitim penceresi: 12..26 egitim yarisi.
const rolling = [];

for (let i=12; i<dataset.length; i++) {
  const pair = fitPair(dataset.slice(0,i));
  const result = evaluate(dataset[i],pair);
  rolling.push({trainRaces:i,...result});

  console.log("V1_J02_ROLLING_RACE",JSON.stringify({
    trainRaces:i,
    ...result
  }));
}

console.log("V1_J02_ROLLING_SUMMARY",JSON.stringify({
  last15: summarize(rolling),
  last9: summarize(rolling.slice(-9))
}));

console.log("V1_J02_ROLLING_PASS");