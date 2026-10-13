// REDUCED-BASELINE WALK-FORWARD OOS FIT — ÇALIŞTIRICI (2026-10-11 kullanıcı onayı).
//
// Frozen challenger-features-v2.json + donmuş oos-fold-manifest.json/oos-experiment-
// matrix.json'ı OKUR, hiçbirini EZMEZ. DB YOK. Production write YOK. weights/engine
// DEĞİŞMEZ. RESCUE YOK. Yeni optimizer/regularization İCAT EDİLMEDİ (bkz. oos-fit-lib.mts
// — src/lib/v5461/conditional-logit.ts'in DEĞİŞTİRİLMEMİŞ fitConditionalLogit'i).
//
// Kullanım (PowerShell):
//   npx tsx scripts/v5461-audit/run-oos-fit.mts --smoke      (tek fold, tek deney — PILOT)
//   npx tsx scripts/v5461-audit/run-oos-fit.mts              (TAM run, 7 fold × 32 fit)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  computeStandardization, buildRaces, fitWithConvergenceCheck, evaluateRaces,
  pairedBootstrapCI, classify, type FeatureRow, type PairedDelta,
} from "./oos-fit-lib.mts";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const SMOKE = process.argv.includes("--smoke");
const t0 = Date.now();
const log = (s: string) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

log(`BAŞLIYOR — mode=${SMOKE ? "SMOKE" : "FULL"}`);

type Experiment = { id: string; family: string; type: string; rb0FeatureOut: string[]; rb0FeatureIn: string[]; description: string };
type Fold = { foldId: string; trainStart: string; testStart: string; testEnd: string; trainRaceCount: number; testRaceCount: number };

const foldManifest = JSON.parse(readFileSync(`${MP}/oos-fold-manifest.json`, "utf8")) as { folds: Fold[] };
const experimentMatrix = JSON.parse(readFileSync(`${MP}/oos-experiment-matrix.json`, "utf8")) as {
  baselineName: string; rb0: { features: string[] }; experiments: Experiment[];
};
const featureRowsAll: FeatureRow[] = JSON.parse(readFileSync(`${MP}/challenger-features-v2.json`, "utf8"));
type RunnerRow = { raceId: string; raceDate: string };
const runnerRows: RunnerRow[] = JSON.parse(readFileSync(`${MP}/runner-rows.json`, "utf8"));
const raceDateById = new Map<string, string>();
for (const r of runnerRows) raceDateById.set(r.raceId, r.raceDate);

const BASELINE_NAME = experimentMatrix.baselineName;
const RB0_FEATURES = experimentMatrix.rb0.features;
log(`baseline=${BASELINE_NAME} (${RB0_FEATURES.length} feature), ${experimentMatrix.experiments.length} deney, ${foldManifest.folds.length} fold`);

const folds = SMOKE ? foldManifest.folds.slice(0, 1) : foldManifest.folds;
const experiments = SMOKE ? experimentMatrix.experiments.slice(0, 1) : experimentMatrix.experiments;
log(`çalıştırılacak: ${folds.length} fold × (${BASELINE_NAME} + ${experiments.length} deney)`);

function featureListFor(exp: Experiment): string[] {
  const out = new Set(exp.rb0FeatureOut);
  const list = RB0_FEATURES.filter((f) => !out.has(f));
  return [...list, ...exp.rb0FeatureIn];
}

type FoldFitArtifact = {
  foldId: string;
  trainRows: FeatureRow[]; testRows: FeatureRow[];
  trainExcluded: { raceId: string; reason: string }[]; testExcluded: { raceId: string; reason: string }[];
};

log("Fold'lar için TRAIN/TEST satırları ayrılıyor (gerçek raceDate ile)...");
const foldSplits: FoldFitArtifact[] = folds.map((f) => {
  const trainRows: FeatureRow[] = [];
  const testRows: FeatureRow[] = [];
  for (const row of featureRowsAll) {
    const d = raceDateById.get(row.raceId);
    if (!d) continue;
    if (d < f.testStart) trainRows.push(row);
    else if (d >= f.testStart && d < f.testEnd) testRows.push(row);
  }
  return { foldId: f.foldId, trainRows, testRows, trainExcluded: [], testExcluded: [] };
});

type ExperimentFoldResult = {
  foldId: string;
  featureCount: number;
  degenerateFeatures: string[];
  trainRaceCount: number; testRaceCount: number;
  trainExcludedRaces: number; testExcludedRaces: number;
  converged: boolean; convergedBy: string; finalGradNorm: number; nllDelta: number; iterations: number;
  beta: number[]; features: string[];
  meanLogLoss: number; meanBrier: number; top1: number; top3: number; top6: number; mrr: number; meanRank: number;
};

type Deltas = { race: PairedDelta[]; };

function runFoldFit(foldArtifact: FoldFitArtifact, features: string[]): { result: ExperimentFoldResult; perRaceEval: Map<string, { logLoss: number; brier: number; winnerRank: number; reciprocalRank: number; top1: boolean; top3: boolean; top6: boolean }> } {
  const muSigma = computeStandardization(foldArtifact.trainRows, features);
  const degenerateFeatures = [...muSigma.entries()].filter(([, v]) => v.degenerate).map(([k]) => k);
  const trainBuild = buildRaces(foldArtifact.trainRows, features, muSigma);
  const testBuild = buildRaces(foldArtifact.testRows, features, muSigma);
  const fit = fitWithConvergenceCheck(trainBuild.races, features.length);
  const evals = evaluateRaces(testBuild.races, fit.beta);
  const n = evals.length || 1;
  const perRaceEval = new Map(evals.map((e) => [e.raceId, { logLoss: e.logLoss, brier: e.brier, winnerRank: e.winnerRank, reciprocalRank: e.reciprocalRank, top1: e.winnerInTop1, top3: e.winnerInTop3, top6: e.winnerInTop6 }]));
  const result: ExperimentFoldResult = {
    foldId: foldArtifact.foldId,
    featureCount: features.length,
    degenerateFeatures,
    trainRaceCount: trainBuild.races.length, testRaceCount: testBuild.races.length,
    trainExcludedRaces: trainBuild.excludedRaces.length, testExcludedRaces: testBuild.excludedRaces.length,
    converged: fit.converged, convergedBy: fit.convergedBy, finalGradNorm: fit.finalGradNorm, nllDelta: fit.nllDelta, iterations: fit.iterations,
    beta: fit.beta, features,
    meanLogLoss: evals.reduce((s, e) => s + e.logLoss, 0) / n,
    meanBrier: evals.reduce((s, e) => s + e.brier, 0) / n,
    top1: evals.filter((e) => e.winnerInTop1).length / n,
    top3: evals.filter((e) => e.winnerInTop3).length / n,
    top6: evals.filter((e) => e.winnerInTop6).length / n,
    mrr: evals.reduce((s, e) => s + e.reciprocalRank, 0) / n,
    meanRank: evals.reduce((s, e) => s + e.winnerRank, 0) / n,
  };
  return { result, perRaceEval };
}

log(`1) ${BASELINE_NAME} her fold için fit ediliyor...`);
const rb0PerFold = new Map<string, ReturnType<typeof runFoldFit>>();
for (const fa of foldSplits) {
  log(`   ${fa.foldId}: train=${fa.trainRows.length} satır, test=${fa.testRows.length} satır...`);
  rb0PerFold.set(fa.foldId, runFoldFit(fa, RB0_FEATURES));
  const r = rb0PerFold.get(fa.foldId)!.result;
  log(`   ${fa.foldId} ${BASELINE_NAME}: trainRaces=${r.trainRaceCount} testRaces=${r.testRaceCount} converged=${r.converged} meanLogLoss=${r.meanLogLoss.toFixed(4)}`);
}

log(`2) ${experiments.length} deney fit ediliyor...`);
const experimentResults: Record<string, { experiment: Experiment; foldResults: ExperimentFoldResult[]; raceDeltas: PairedDelta[]; dayDeltas: PairedDelta[] }> = {};

for (const exp of experiments) {
  const features = featureListFor(exp);
  log(`   ${exp.id} [${exp.type}] ${exp.family}: ${features.length} feature...`);
  const foldResults: ExperimentFoldResult[] = [];
  const raceDeltas: PairedDelta[] = [];
  for (const fa of foldSplits) {
    const { result, perRaceEval } = runFoldFit(fa, features);
    foldResults.push(result);
    const rb0Eval = rb0PerFold.get(fa.foldId)!.perRaceEval;
    for (const [raceId, challEval] of perRaceEval) {
      const base = rb0Eval.get(raceId);
      if (!base) continue; // RB0 bu race'i exclude etmiş (farklı değerlendirme kümesi) — paired karşılaştırmaya girmez
      const dateKey = (raceDateById.get(raceId) ?? "").slice(0, 10);
      raceDeltas.push({
        raceId, dateKey,
        deltaLogLoss: challEval.logLoss - base.logLoss,
        deltaBrier: challEval.brier - base.brier,
        challengerLogLoss: challEval.logLoss, baselineLogLoss: base.logLoss,
      });
    }
  }
  experimentResults[exp.id] = { experiment: exp, foldResults, raceDeltas, dayDeltas: raceDeltas };
  log(`   ${exp.id}: ${raceDeltas.length} paired test-race karşılaştırması toplandı.`);
}

log("3) Paired bootstrap CI + sınıflandırma...");
type ExperimentSummary = {
  experimentId: string; family: string; type: string;
  baselineFeatureList: string[]; challengerFeatureList: string[];
  foldCounts: { foldId: string; trainRaceCount: number; testRaceCount: number; converged: boolean; degenerateFeatures: string[] }[];
  pairedN: number;
  deltaLogLoss: { mean: number; raceCI: { lower: number; upper: number }; dayCI: { lower: number; upper: number } };
  deltaBrier: number;
  top1Delta: number; top3Delta: number; top6Delta: number; mrrDelta: number; meanRankDelta: number;
  betaSignStability: { feature: string; signs: (1 | -1 | 0)[]; stable: boolean }[];
  coverage: number; // pairedN / toplam test race sayısı
  foldFavoringChallenger: number; foldTotal: number;
  classification: "PASS" | "WORSE" | "INCONCLUSIVE";
};

const allExperimentSummaries: ExperimentSummary[] = [];
for (const exp of experiments) {
  const er = experimentResults[exp.id];
  const raceCI = pairedBootstrapCI(er.raceDeltas, "race", SMOKE ? 200 : 2000, 42);
  const dayCI = pairedBootstrapCI(er.raceDeltas, "day", SMOKE ? 200 : 2000, 43);
  const classification = classify(raceCI, dayCI);

  const totalTestRaces = er.foldResults.reduce((s, f) => s + f.testRaceCount, 0);
  const challFeatures = featureListFor(exp);
  const addedOrChanged = [...exp.rb0FeatureIn];
  const betaSignStability = addedOrChanged.map((feat) => {
    const signs = er.foldResults.map((fr) => {
      const idx = fr.features.indexOf(feat);
      if (idx < 0) return 0 as const;
      const b = fr.beta[idx];
      return b > 1e-9 ? 1 as const : b < -1e-9 ? -1 as const : 0 as const;
    });
    const nonZero = signs.filter((s) => s !== 0);
    const stable = nonZero.length > 0 && nonZero.every((s) => s === nonZero[0]);
    return { feature: feat, signs, stable };
  });

  const meanBrierDelta = er.raceDeltas.length ? er.raceDeltas.reduce((s, d) => s + d.deltaBrier, 0) / er.raceDeltas.length : 0;

  // Top1/3/6/MRR/MeanRank delta — fold ağırlıklı (testRaceCount ile) ortalama fark.
  function weightedMetricDelta(getter: (r: ExperimentFoldResult) => number): number {
    let sw = 0, sv = 0;
    for (let i = 0; i < er.foldResults.length; i++) {
      const base = rb0PerFold.get(er.foldResults[i].foldId)!.result;
      const w = er.foldResults[i].testRaceCount;
      sw += w; sv += w * (getter(er.foldResults[i]) - getter(base));
    }
    return sw > 0 ? sv / sw : 0;
  }

  const foldFavoringChallenger = er.foldResults.filter((fr, i) => {
    const base = rb0PerFold.get(fr.foldId)!.result;
    void i;
    return fr.meanLogLoss < base.meanLogLoss;
  }).length;

  allExperimentSummaries.push({
    experimentId: exp.id, family: exp.family, type: exp.type,
    baselineFeatureList: RB0_FEATURES, challengerFeatureList: challFeatures,
    foldCounts: er.foldResults.map((fr) => ({ foldId: fr.foldId, trainRaceCount: fr.trainRaceCount, testRaceCount: fr.testRaceCount, converged: fr.converged, degenerateFeatures: fr.degenerateFeatures })),
    pairedN: er.raceDeltas.length,
    deltaLogLoss: { mean: raceCI.mean, raceCI: { lower: raceCI.lower, upper: raceCI.upper }, dayCI: { lower: dayCI.lower, upper: dayCI.upper } },
    deltaBrier: meanBrierDelta,
    top1Delta: weightedMetricDelta((r) => r.top1), top3Delta: weightedMetricDelta((r) => r.top3), top6Delta: weightedMetricDelta((r) => r.top6),
    mrrDelta: weightedMetricDelta((r) => r.mrr), meanRankDelta: weightedMetricDelta((r) => r.meanRank),
    betaSignStability,
    coverage: totalTestRaces > 0 ? er.raceDeltas.length / totalTestRaces : 0,
    foldFavoringChallenger, foldTotal: er.foldResults.length,
    classification,
  });
  log(`   ${exp.id}: ΔLogLoss=${raceCI.mean.toFixed(5)} raceCI=[${raceCI.lower.toFixed(5)},${raceCI.upper.toFixed(5)}] dayCI=[${dayCI.lower.toFixed(5)},${dayCI.upper.toFixed(5)}] → ${classification}`);
}

log("4) Family-level winner seçimi...");
const familyGroups = new Map<string, ExperimentSummary[]>();
for (const s of allExperimentSummaries) { const a = familyGroups.get(s.family) ?? []; a.push(s); familyGroups.set(s.family, a); }
type FamilySummary = { family: string; experimentCount: number; winner: string | null; winnerReason: string; allPass: string[]; allWorse: string[]; allInconclusive: string[] };
const familySummaries: FamilySummary[] = [...familyGroups.entries()].map(([family, exps]) => {
  const passing = exps.filter((e) => e.classification === "PASS");
  let winner: ExperimentSummary | null = null;
  let winnerReason = "Aile içinde PASS sınıfında deney yok — kazanan SEÇİLMEDİ.";
  if (passing.length > 0) {
    // En negatif (en iyi) paired ΔLogLoss mean'i olan, CI'si de PASS olan aday — fold consistency ikincil kıyas.
    winner = [...passing].sort((a, b) => a.deltaLogLoss.mean - b.deltaLogLoss.mean)[0];
    winnerReason = `En düşük (en iyi) paired ΔLogLoss mean'i (${winner.deltaLogLoss.mean.toFixed(5)}) + PASS sınıfı + ${winner.foldFavoringChallenger}/${winner.foldTotal} fold tutarlılığı.`;
  }
  return {
    family, experimentCount: exps.length,
    winner: winner?.experimentId ?? null, winnerReason,
    allPass: exps.filter((e) => e.classification === "PASS").map((e) => e.experimentId),
    allWorse: exps.filter((e) => e.classification === "WORSE").map((e) => e.experimentId),
    allInconclusive: exps.filter((e) => e.classification === "INCONCLUSIVE").map((e) => e.experimentId),
  };
});

log("5) Çıktılar yazılıyor...");
const excludedInvalidRaces = { train: foldSplits.reduce((s, f) => s + f.trainExcluded.length, 0), test: foldSplits.reduce((s, f) => s + f.testExcluded.length, 0) };

const resultsOut = { generatedAt: new Date().toISOString(), mode: SMOKE ? "SMOKE" : "FULL", baselineName: BASELINE_NAME, experiments: allExperimentSummaries };
writeFileSync(`${MP}/oos-results${SMOKE ? "-smoke" : ""}.json`, JSON.stringify(resultsOut, null, 2));

const familyOut = { generatedAt: new Date().toISOString(), mode: SMOKE ? "SMOKE" : "FULL", families: familySummaries, selectionBiasWarning: "Bu family winner'lar SCREENING/MODEL-SELECTION OOS sonucudur — birleştirilmiş performansları 'final unbiased OOS' diye SUNULAMAZ, dokunulmamış holdout gerekir." };
writeFileSync(`${MP}/oos-family-summary${SMOKE ? "-smoke" : ""}.json`, JSON.stringify(familyOut, null, 2));

const inputHashes = {
  challengerFeaturesV2: sha256(readFileSync(`${MP}/challenger-features-v2.json`)),
  foldManifest: sha256(readFileSync(`${MP}/oos-fold-manifest.json`)),
  experimentMatrix: sha256(readFileSync(`${MP}/oos-experiment-matrix.json`)),
  fitterSource: sha256(readFileSync("C:/Users/tlgbi/OneDrive/Belgeler/Rota/rotaganyan/src/lib/v5461/conditional-logit.ts")),
};
const runManifest = {
  generatedAt: new Date().toISOString(), mode: SMOKE ? "SMOKE" : "FULL",
  runtimeMs: Date.now() - t0,
  inputHashes,
  foldCount: folds.length, experimentCount: experiments.length,
  rowRaceCounts: { totalFeatureRows: featureRowsAll.length },
  excludedInvalidRaces,
  fitHyperparameters: {
    lambda: 0.1, learningRate: 0.1, maxIterations: 4000,
    convergenceCriterion: "NLL_STABILITY (|NLL@iterations/2 - NLL@iterations| < 1e-3, iki bağımsız prior'suz çağrı)",
    note: "learningRate 2.0→0.1 düzeltildi (2.0 ile smoke test'te diverge ediyordu, bkz. scripts/v5461-audit/diag-lr.mts). Yakınsama kriteri ||gradyan|| yerine NLL-stabilitesine dayandırıldı (AGF üçlüsünün kolinearliği ||gradyan||'ı güvenilmez sinyal yapıyor, bkz. oos-fit-lib.mts yorumu) — optimizer'ın kendisi (fitConditionalLogit) DEĞİŞMEDİ.",
  },
  productionChanged: false, betaFit: true, oosRun: true, rescueRun: false,
};
writeFileSync(`${MP}/oos-run-manifest${SMOKE ? "-smoke" : ""}.json`, JSON.stringify(runManifest, null, 2));

const familyMd = [...familyGroups.keys()].map((fam) => {
  const fs = familySummaries.find((f) => f.family === fam)!;
  const rows = familyGroups.get(fam)!.map((e) =>
    `| ${e.experimentId} | ${e.type} | ${e.deltaLogLoss.mean.toFixed(5)} | [${e.deltaLogLoss.raceCI.lower.toFixed(5)},${e.deltaLogLoss.raceCI.upper.toFixed(5)}] | [${e.deltaLogLoss.dayCI.lower.toFixed(5)},${e.deltaLogLoss.dayCI.upper.toFixed(5)}] | ${e.foldFavoringChallenger}/${e.foldTotal} | ${e.classification} |`
  ).join("\n");
  return `### ${fam}\n\n| Deney | Tip | ΔLogLoss | Race CI | Day CI | Fold | Sınıf |\n|---|---|---|---|---|---|---|\n${rows}\n\n**Winner:** ${fs.winner ?? "YOK"} — ${fs.winnerReason}`;
}).join("\n\n");

const summaryMd = `# Reduced-Baseline Walk-Forward OOS — Sonuçlar (${SMOKE ? "SMOKE/PILOT" : "FULL"})

${new Date().toISOString()}. Baseline: **${BASELINE_NAME}**. ${folds.length} fold, ${experiments.length} deney.
productionChanged=false, betaFit=true, oosRun=true, rescueRun=false.

## Family Sonuçları

${familyMd}

## Not

Bu tur SCREENING/MODEL-SELECTION OOS'dur. Aynı fold'larda seçilen family winner'ların
birleştirilmiş performansı final/unbiased OOS olarak SUNULAMAZ.
`;
writeFileSync(`${MP}/oos-summary${SMOKE ? "-smoke" : ""}.md`, summaryMd);

log("6) TAMAMLANDI.");
console.log(JSON.stringify({
  mode: SMOKE ? "SMOKE" : "FULL",
  runtimeMs: Date.now() - t0,
  foldCount: folds.length,
  experimentCount: experiments.length,
  excludedInvalidRaces,
  classificationCounts: {
    PASS: allExperimentSummaries.filter((e) => e.classification === "PASS").length,
    WORSE: allExperimentSummaries.filter((e) => e.classification === "WORSE").length,
    INCONCLUSIVE: allExperimentSummaries.filter((e) => e.classification === "INCONCLUSIVE").length,
  },
  allConverged: allExperimentSummaries.every((e) => e.foldCounts.every((f) => f.converged)) && [...rb0PerFold.values()].every((r) => r.result.converged),
  productionChanged: false, betaFit: true, oosRun: true, rescueRun: false,
}, null, 2));
