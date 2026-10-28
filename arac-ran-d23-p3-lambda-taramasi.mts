/**
 * RAN D23 — P3 probability-calibration lambda sweep (90, 30, 10, 3, 1), on the SAME
 * 23-signal, 115-race (86 train / 29 chronological-development) cohort used to produce
 * the 8/29 Top1 / 17/29 Top3 / logLoss=1.979 reference. Hyperparameter selection uses ONLY
 * train/dev (never the separate out-of-training holdout). Per user instruction, this sweep
 * is NOT a substitute for the separate JOCKEY_OE30 robustness research (P2).
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ran-d23-p3-lambda-taramasi.mts <115-race-ndjson>
 */
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "./src/lib/motor-v1/engine/training";
import { smoothD23Pedigree } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";

const INPUT = process.argv[2] ?? "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";
const CUTOFF_DATE = "2026-08-21";
const LAMBDAS = [90, 30, 10, 3, 1];

type Race = { raceId: string; tarih: string; winnerNo: number; vectors: RunnerFeatureVector[] };

function brier(p: number, won: boolean) { return (p - (won ? 1 : 0)) ** 2; }

function main() {
  const lines = fs.readFileSync(INPUT, "utf8").trim().split(/\r?\n/);
  const races: Race[] = lines.map((l) => JSON.parse(l));
  if (races.length !== 115) throw new Error("EXPECTED_115_GOT_" + races.length);
  const codes = races[0].vectors[0].signals.map((s) => s.code);
  const processed = races.map((r) => ({ ...r, vectors: r.vectors.map(smoothD23Pedigree) }));
  const train = processed.filter((r) => r.tarih < CUTOFF_DATE);
  const dev = processed.filter((r) => r.tarih >= CUTOFF_DATE);
  console.log("[P3] input=" + INPUT + " train=" + train.length + " dev=" + dev.length);

  const results = LAMBDAS.map((lambda) => {
    const opts: FitOptions = { lambda, learningRate: 0.25, iterations: 2500 };
    const stats = computeFeatureStats(train.flatMap((r) => r.vectors), codes as any);
    const model = fitModel(train.map((r) => ({ raceId: r.raceId, date: new Date(r.tarih + "T00:00:00.000Z"),
      winnerNo: r.winnerNo, vectors: r.vectors })), stats, opts);

    function evalSet(rows: typeof train, label: string) {
      let top1 = 0, top3 = 0, top6 = 0, logLoss = 0, briers = 0, gap12 = 0;
      const byFieldSize: Record<string, { n: number; top1: number }> = {};
      const calib: { bucket: string; n: number; predSum: number; wins: number }[] =
        ["0-0.1", "0.1-0.2", "0.2-0.35", "0.35-0.5", "0.5-1.0"].map((b) => ({ bucket: b, n: 0, predSum: 0, wins: 0 }));
      for (const r of rows) {
        const ranked = scoreRace(r.vectors, model).sort((x, y) => y.probability - x.probability || x.no - y.no);
        const rank = ranked.findIndex((x) => x.no === r.winnerNo) + 1;
        const pWinner = ranked[rank - 1]?.probability ?? 1e-9;
        top1 += Number(rank === 1); top3 += Number(rank <= 3); top6 += Number(rank <= 6);
        logLoss -= Math.log(Math.max(pWinner, 1e-9));
        gap12 += (ranked[0]?.probability ?? 0) - (ranked[1]?.probability ?? 0);
        const fs_ = String(r.vectors.length);
        byFieldSize[fs_] ??= { n: 0, top1: 0 };
        byFieldSize[fs_].n++; byFieldSize[fs_].top1 += Number(rank === 1);
        for (const runner of ranked) {
          briers += brier(runner.probability, runner.no === r.winnerNo) / ranked.length;
          const idx = runner.probability < 0.1 ? 0 : runner.probability < 0.2 ? 1 : runner.probability < 0.35 ? 2 :
            runner.probability < 0.5 ? 3 : 4;
          calib[idx].n++; calib[idx].predSum += runner.probability; calib[idx].wins += Number(runner.no === r.winnerNo);
        }
      }
      const n = rows.length;
      return {
        label, n, top1, top3, top6, top1Rate: top1 / n, top3Rate: top3 / n, top6Rate: top6 / n,
        logLoss: logLoss / n, brierPerRace: briers / n, meanGap12: gap12 / n,
        byFieldSize,
        calibration: calib.map((c) => ({ bucket: c.bucket, n: c.n,
          avgPredicted: c.n ? c.predSum / c.n : null, empiricalRate: c.n ? c.wins / c.n : null })),
      };
    }

    return { lambda, betaMaxAbs: Math.max(...model.beta.map(Math.abs)), train: evalSet(train, "train"), dev: evalSet(dev, "dev") };
  });

  const outPath = "C:/tmp/ran-d23-p3-lambda-sweep-" + new Date().toISOString().replace(/[:.]/g, "-") + ".report.json";
  fs.writeFileSync(outPath, JSON.stringify({ status: "P3_LAMBDA_SWEEP_TRAIN_DEV_ONLY_NOT_FINAL_ACCEPTANCE",
    input: INPUT, lambdas: LAMBDAS, results }, null, 2), "utf8");
  for (const r of results) {
    console.log("[P3] lambda=" + r.lambda + " DEV top1=" + r.dev.top1 + "/" + r.dev.n + " top3=" + r.dev.top3 + "/" + r.dev.n +
      " top6=" + r.dev.top6 + "/" + r.dev.n + " logLoss=" + r.dev.logLoss.toFixed(4) +
      " brier=" + r.dev.brierPerRace.toFixed(4) + " meanGap12=" + r.dev.meanGap12.toFixed(4) +
      " maxBeta=" + r.betaMaxAbs.toFixed(3));
  }
  console.log("[P3] REPORT=" + outPath);
}

main();
