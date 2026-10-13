// GEÇİCİ TEŞHİS SCRIPTİ — smoke test'in converged=false sonucunu teşhis etmek için.
// Plan/manifest dosyalarını DEĞİŞTİRMEZ, yalnız fold-1 + RB0 üzerinde farklı learningRate
// değerleriyle NLL trajectory'sini yazdırır.
import { readFileSync } from "node:fs";
import { fitConditionalLogit } from "../../src/lib/v5461/conditional-logit.js";
import { softmax } from "../../src/lib/v5461/math.js";
import { computeStandardization, buildRaces, type FeatureRow } from "./oos-fit-lib.mts";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const foldManifest = JSON.parse(readFileSync(`${MP}/oos-fold-manifest.json`, "utf8"));
const experimentMatrix = JSON.parse(readFileSync(`${MP}/oos-experiment-matrix.json`, "utf8"));
const featureRowsAll: FeatureRow[] = JSON.parse(readFileSync(`${MP}/challenger-features-v2.json`, "utf8"));
const runnerRows: { raceId: string; raceDate: string }[] = JSON.parse(readFileSync(`${MP}/runner-rows.json`, "utf8"));
const raceDateById = new Map(runnerRows.map((r) => [r.raceId, r.raceDate]));

const f1 = foldManifest.folds[0];
const RB0 = experimentMatrix.rb0.features as string[];
const trainRows = featureRowsAll.filter((r) => { const d = raceDateById.get(r.raceId); return d && d < f1.testStart; });
console.error(`train rows=${trainRows.length}`);

const muSigma = computeStandardization(trainRows, RB0);
for (const [name, ms] of muSigma) console.error(`  ${name}: mu=${ms.mu.toFixed(4)} sigma=${ms.sigma.toFixed(4)} degenerate=${ms.degenerate}`);

const { races, excludedRaces } = buildRaces(trainRows, RB0, muSigma);
console.error(`races=${races.length} excluded=${excludedRaces.length}`);

function dot(a: number[], b: number[]) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function nll(beta: number[]) {
  let s = 0;
  for (const race of races) {
    const probs = softmax(race.runners.map((r) => dot(r.features, beta)));
    const w = race.runners.findIndex((r) => r.winner);
    s += -Math.log(Math.max(probs[w], 1e-15));
  }
  return s / races.length;
}

const trainingRunners = races.map((r) => r.runners);
function gradNorm(beta: number[]): number {
  const g = Array(RB0.length).fill(0);
  for (const race of races) {
    const probs = softmax(race.runners.map((r) => dot(r.features, beta)));
    for (let i = 0; i < race.runners.length; i++) {
      const err = probs[i] - (race.runners[i].winner ? 1 : 0);
      for (let j = 0; j < RB0.length; j++) g[j] += err * race.runners[i].features[j];
    }
  }
  const scale = 1 / races.length;
  let s = 0;
  for (let j = 0; j < RB0.length; j++) { const gj = g[j] * scale + 2 * 0.1 * beta[j]; s += gj * gj; }
  return Math.sqrt(s);
}

// DÜZELTME: chunk'lar arası prior:beta geçirmek BUG'dı — fitConditionalLogit prior'ı
// ridge-shrinkage HEDEFİ olarak kullanıyor (2λ(β-prior)), warm-start DEĞİL. Her chunk
// ridge'i "o anki beta"ya çekip etkisiz hale getiriyordu. Doğru yöntem: TEK çağrı,
// prior'SUZ (sıfır-başlangıç, sıfır-hedef = standart ridge), farklı iterasyon sayılarıyla
// AYRI AYRI (fresh) çağırıp karşılaştırmak.
for (const iters of [500, 1000, 2000, 4000, 8000]) {
  const beta = fitConditionalLogit(trainingRunners, RB0.length, { lambda: 0.1, learningRate: 0.1, iterations: iters });
  console.error(`iters=${iters}: nll=${nll(beta).toFixed(6)} gradNorm=${gradNorm(beta).toFixed(6)}`);
}
