import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import {
  MODEL_VERSION,
  SIGNAL_CODES,
  scoreRace,
  explainRunner,
  type FittedModel,
} from "./src/lib/motor-v1/engine/training";

async function main() {
  const raceId = process.argv[2];
  if (!raceId) throw new Error("Race ID gerekli");

  const path = resolve(
    process.cwd(),
    "src/lib/motor-v1/artifacts/model-v1-pilot.json"
  );

  const saved = JSON.parse(readFileSync(path, "utf8"));

  if (saved.modelVersion !== MODEL_VERSION) {
    throw new Error("Model version mismatch");
  }

  const expectedNames = SIGNAL_CODES.flatMap(code => [
    `${code}_z`,
    `${code}_missing`,
  ]);

  if (
    saved.model.beta.length !== expectedNames.length ||
    !expectedNames.every(
      (name, i) => saved.model.names[i] === name
    )
  ) {
    throw new Error("Feature order mismatch");
  }

  const model: FittedModel = {
    ...saved.model,
    stats: new Map(saved.model.stats),
  };

  const zIndex = model.names.indexOf("JOKEY_02_z");
  const missingIndex =
    model.names.indexOf("JOKEY_02_missing");

  if (zIndex < 0 || missingIndex < 0) {
    throw new Error("JOKEY_02 bulunamadi");
  }

  const withoutJ02: FittedModel = {
    ...model,
    beta: model.beta.map((b, i) =>
      i === zIndex || i === missingIndex ? 0 : b
    ),
  };

  const vectors = await buildFeatureVectorsForRace(raceId);

  if (vectors.length < 2) {
    throw new Error("Yeterli at bulunamadi");
  }

  const original = scoreRace(vectors, model)
    .sort((a, b) => b.probability - a.probability);

  const ablated = scoreRace(vectors, withoutJ02)
    .sort((a, b) => b.probability - a.probability);

  const originalByNo = new Map(
    original.map((r, i) => [r.no, { ...r, rank: i + 1 }])
  );

  const ablatedByNo = new Map(
    ablated.map((r, i) => [r.no, { ...r, rank: i + 1 }])
  );

  console.log("V1_J02_AUDIT_START", JSON.stringify({
    raceId,
    horses: vectors.length,
    coefficient: model.beta[zIndex],
    note: "Inference-only ablation; not retrained OOS",
  }));

  for (const v of vectors) {
    const before = originalByNo.get(v.no)!;
    const after = ablatedByNo.get(v.no)!;

    const effect = explainRunner(v, model)
      .rows.find(r => r.code === "JOKEY_02");

    const signal = v.signals.find(
      s => s.code === "JOKEY_02"
    );

    const contribution = effect
      ? effect.scoreContribution +
        effect.missingIndicatorContribution
      : null;

    console.log("V1_J02_COMPARE", JSON.stringify({
      no: v.no,
      name: v.name,
      observed: signal?.observed ?? false,
      rawValue: signal?.rawValue ?? null,
      contribution,
      originalRank: before.rank,
      withoutJ02Rank: after.rank,
      originalProbabilityPct: Number(
        (before.probability * 100).toFixed(3)
      ),
      withoutJ02ProbabilityPct: Number(
        (after.probability * 100).toFixed(3)
      ),
      changePctPoints: Number(
        ((after.probability - before.probability) * 100)
          .toFixed(3)
      ),
    }));
  }

  console.log("V1_J02_ABLATION_PASS");
}

main().catch(error => {
  console.error("V1_J02_ERROR", error);
  process.exitCode = 1;
});