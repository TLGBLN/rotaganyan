import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import {
  MODEL_VERSION,
  SIGNAL_CODES,
  scoreRace,
  explainRunner,
  type FittedModel,
} from "./src/lib/motor-v1/engine/training";

type SavedArtifact = {
  schemaVersion: number;
  modelVersion: string;
  trainingEndDate: string;
  model: {
    beta: number[];
    names: string[];
    stats: Array<[string, {
      mu: number;
      sigma: number;
      nObserved: number;
    }]>;
    opts: FittedModel["opts"];
    nRacesUsed: number;
    nRacesSkipped: number;
  };
};

function loadModel(): {
  artifact: SavedArtifact;
  model: FittedModel;
} {
  const path = resolve(
    process.cwd(),
    "src/lib/motor-v1/artifacts/model-v1-pilot.json"
  );

  const artifact = JSON.parse(
    readFileSync(path, "utf8")
  ) as SavedArtifact;

  if (
    artifact.schemaVersion !== 1 ||
    artifact.modelVersion !== MODEL_VERSION
  ) {
    throw new Error("Model schema/version mismatch");
  }

  const expectedNames = SIGNAL_CODES.flatMap(code => [
    `${code}_z`,
    `${code}_missing`,
  ]);

  if (
    artifact.model.beta.length !== expectedNames.length ||
    artifact.model.names.length !== expectedNames.length ||
    !expectedNames.every(
      (name, i) => artifact.model.names[i] === name
    ) ||
    !artifact.model.beta.every(Number.isFinite)
  ) {
    throw new Error("Model coefficient/order integrity failure");
  }

  const stats = new Map(
    artifact.model.stats
  ) as FittedModel["stats"];

  if (
    stats.size !== SIGNAL_CODES.length ||
    !SIGNAL_CODES.every(code => {
      const s = stats.get(code);
      return (
        s != null &&
        Number.isFinite(s.mu) &&
        Number.isFinite(s.sigma) &&
        s.sigma > 0 &&
        Number.isInteger(s.nObserved) &&
        s.nObserved >= 0
      );
    })
  ) {
    throw new Error("Feature statistics integrity failure");
  }

  const model: FittedModel = {
    ...artifact.model,
    names: expectedNames as FittedModel["names"],
    stats,
  };

  return { artifact, model };
}

async function main() {
  const { artifact, model } = loadModel();
  const suppliedRaceId = process.argv[2];

  // Race ID verilmezse egitim bitisinden sonraki,
  // sonucu kaydedilmemis ilk yarisi bul.
  const race = suppliedRaceId
    ? await db.race.findUnique({
        where: { id: suppliedRaceId },
        select: {
          id: true,
          raceDay: { select: { date: true } },
        },
      })
    : await db.race.findFirst({
        where: {
          raceDay: {
            date: {
              gt: new Date(
                `${artifact.trainingEndDate}T23:59:59.999Z`
              ),
            },
          },
          result: { is: null },
          runners: {
            some: { scratched: false },
          },
        },
        orderBy: {
          raceDay: { date: "asc" },
        },
        select: {
          id: true,
          raceDay: { select: { date: true } },
        },
      });

  if (!race) {
    throw new Error(
      "Uygun yarıs bulunamadi. Yeni yaris verisi gerekli."
    );
  }

  const raceDate = race.raceDay.date
    .toISOString()
    .slice(0, 10);

  if (raceDate <= artifact.trainingEndDate) {
    throw new Error(
      "Hedef yaris egitim doneminde. Tahmin engellendi."
    );
  }

  const existingResult = await db.result.findFirst({
    where: { raceId: race.id },
    select: { raceId: true },
  });

  if (existingResult) {
    throw new Error(
      "Hedef yarisin sonucu mevcut. Pilot tahmin engellendi."
    );
  }

  console.log("V1_PREDICT_RACE", JSON.stringify({
    raceId: race.id,
    date: raceDate,
    modelVersion: artifact.modelVersion,
    trainingRaces: model.nRacesUsed,
  }));

  const vectors = await buildFeatureVectorsForRace(race.id);

  if (vectors.length < 2) {
    throw new Error("Yeterli kosan at yok");
  }

  for (const v of vectors) {
    const codes = new Set(v.signals.map(s => s.code));

    if (
      v.signals.length !== SIGNAL_CODES.length ||
      codes.size !== SIGNAL_CODES.length ||
      !SIGNAL_CODES.every(code => codes.has(code))
    ) {
      throw new Error(
        `Eksik/tekrarlanan sinyal: at ${v.no}`
      );
    }
  }

  const sorted = scoreRace(vectors, model)
    .sort((a, b) => b.probability - a.probability);

  const total = sorted.reduce(
    (sum, r) => sum + r.probability, 0
  );

  if (
    !sorted.every(
      r => Number.isFinite(r.probability) &&
           r.probability >= 0
    ) ||
    Math.abs(total - 1) > 1e-8
  ) {
    throw new Error("Probability validation failed");
  }

  const byNo = new Map(vectors.map(v => [v.no, v]));

  for (const [index, horse] of sorted.entries()) {
    const vector = byNo.get(horse.no)!;
    const explanation = explainRunner(vector, model);

    if (
      Math.abs(explanation.totalScore - horse.score) > 1e-8
    ) {
      throw new Error(
        `Signal contribution mismatch: ${horse.no}`
      );
    }

    const contributions = explanation.rows.map(row => ({
      code: row.code,
      contribution:
        row.scoreContribution +
        row.missingIndicatorContribution,
    }));

    const positive = contributions
      .filter(r => r.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    const negative = contributions
      .filter(r => r.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 3);

    console.log("V1_HORSE", JSON.stringify({
      rank: index + 1,
      no: horse.no,
      name: horse.name,
      probabilityPct: Number(
        (horse.probability * 100).toFixed(2)
      ),
      score: horse.score,
      positive,
      negative,
    }));
  }

  console.log("V1_PROBABILITY_SUM", total);
  console.log("V1_PREDICTION_PASS");
}

main().catch(error => {
  console.error("V1_PREDICT_ERROR", error);
  process.exitCode = 1;
});