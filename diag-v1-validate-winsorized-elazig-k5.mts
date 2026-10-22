// DOĞRULAMA — deneysel (kırpılmış) modelin VALENTINE GIRL/Elazığ K5 vakasında NE YAPACAĞINI
// gösterir. v1-trained-model.json'a DOKUNULMAZ; bu yalnız deneysel artefaktın test edilmesidir.
import fs from "node:fs";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { buildScorableVector } from "./src/lib/motor-v1/engine/predict-v1";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const RACE_ID = "cmvg7uuhj00ci08jp4q8yo35m"; // Elazığ 2026-10-21 K5

async function main() {
  const currentModel = loadTrainedV1Model();
  const exp = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/experimental-winsorized-v1.json", "utf8"));

  const clipBounds = new Map<string, { p1: number; p99: number }>();
  for (const c of exp.clippedCodes) clipBounds.set(c.code, { p1: c.p1, p99: c.p99 });

  const expModel: FittedModel = {
    beta: exp.beta,
    names: exp.names,
    stats: new Map(Object.entries(exp.muSigma).map(([k, v]) => [k, v as { mu: number; sigma: number; nObserved: number }])),
    nRacesUsed: exp.nTrainRaces,
    nRacesSkipped: exp.nRacesSkipped,
    opts: exp.fitOpts,
  };

  const unified = await computeUnifiedFamiliesForRace(RACE_ID, currentModel);
  const vectorsRaw = unified.map((r) => buildScorableVector(RACE_ID, r));

  // Tahmin zamanında da AYNI (TRAIN'den türetilmiş) sınırlar uygulanır — eğitim/tahmin tutarlılığı.
  const vectorsClipped = vectorsRaw.map((v) => ({
    ...v,
    signals: v.signals.map((s) => {
      if (!s.observed || s.rawValue == null) return s;
      const b = clipBounds.get(s.code);
      if (!b) return s;
      const clipped = Math.min(Math.max(s.rawValue, b.p1), b.p99);
      return clipped === s.rawValue ? s : { ...s, rawValue: clipped };
    }),
  }));

  const currentScored = scoreRace(vectorsRaw, currentModel);
  const expScored = scoreRace(vectorsClipped, expModel);

  const currentRanked = [...currentScored].sort((a, b) => b.probability - a.probability);
  const expRanked = [...expScored].sort((a, b) => b.probability - a.probability);

  console.log("=== MEVCUT V1.0 (üretim, kırpmasız) ===");
  currentRanked.forEach((s, i) => console.log(`  ${i + 1}. #${s.no} ${s.name.padEnd(20)} P=${(s.probability * 100).toFixed(1)}%`));

  console.log("\n=== DENEYSEL (kırpılmış, aynı TRAIN sınırlarıyla tahmin) ===");
  expRanked.forEach((s, i) => console.log(`  ${i + 1}. #${s.no} ${s.name.padEnd(20)} P=${(s.probability * 100).toFixed(1)}%`));

  const vgRaw = vectorsRaw.find((v) => v.name === "VALENTINE GIRL")!;
  const genPmzSig = vgRaw.signals.find((s) => s.code === "GEN_PMZ_YET_01")!;
  const bound = clipBounds.get("GEN_PMZ_YET_01")!;
  console.log(`\nGEN_PMZ_YET_01 — VALENTINE GIRL ham değeri: ${genPmzSig.rawValue} | TRAIN sınırı: [${bound.p1.toFixed(2)}, ${bound.p99.toFixed(2)}] | kırpılmış: ${Math.min(Math.max(genPmzSig.rawValue!, bound.p1), bound.p99).toFixed(2)}`);

  console.log(`\nGerçek sonuç: #6 LOVESICK GRILS kazandı.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
