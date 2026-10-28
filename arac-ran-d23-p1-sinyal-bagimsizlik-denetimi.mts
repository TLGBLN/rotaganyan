/**
 * RAN D23 — P1 signal-independence audit (correlation + train-only ablation refit),
 * on the 115-race (86 train / 29 chronological-development) D23 cohort.
 *
 * Method mirrors the ALREADY-EXISTING, untouched old-model audit
 * (src/lib/rotaganyan-analiz-motoru/rca/signal-complementarity-audit.ts, built for the
 * preserved 36-signal/238-race PR#12 model): Pearson correlation on jointly-observed rows,
 * PLUS train-only refit ablation (DROP_ONE / DROP_FAMILY) scored on the SAME untouched
 * chronological development races, with rescued/harmed-race accounting. That file is NOT
 * modified or reused directly (different code registry); this is a standalone, D23-specific
 * analogue, operating ONLY on the 115-race cohort (no acceptance/holdout races touched).
 *
 * Per user instruction: correlation alone is NEVER sufficient justification to drop a signal.
 * This script reports correlation and ablation side by side and draws NO drop/keep verdict.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ran-d23-p1-sinyal-bagimsizlik-denetimi.mts <path-to-115-race-ndjson>
 */
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "./src/lib/motor-v1/engine/training";
import { smoothD23Pedigree } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";

const INPUT = process.argv[2] ?? "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";
const CUTOFF_DATE = "2026-08-21";
const opts: FitOptions = { lambda: 90, learningRate: 0.25, iterations: 2500 };

type Race = { raceId: string; tarih: string; winnerNo: number; vectors: RunnerFeatureVector[] };

const CLUSTERS: Record<string, readonly string[]> = {
  "SPEED_RIVAL": ["SPEED", "ACC_SPEED", "RIVAL_GAP"],
  "ACC_SURFACE": ["ACC_CLOSE_RES", "ACC_LATE", "SURFACE_FORM"],
  "PRESSURE": ["RIVAL_FRONT_PRESSURE", "SINGLE_LEADER", "CLOSER_PRESSURE_FIT"],
  "PACE": ["RACE_PACE_FIT", "PACE_DUEL_SELF", "PACE_STALK_DUEL", "PACE_DRAW_LEAD_PRESS"],
};

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 10) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; xx += a * a; yy += b * b; xy += a * b; }
  if (xx <= 1e-14 || yy <= 1e-14) return null;
  return xy / Math.sqrt(xx * yy);
}

async function main() {
  const lines = fs.readFileSync(INPUT, "utf8").trim().split(/\r?\n/);
  const races: Race[] = lines.map((l) => JSON.parse(l));
  if (races.length !== 115) throw new Error("EXPECTED_115_GOT_" + races.length);
  const codes = races[0].vectors[0].signals.map((s) => s.code);
  const processed = races.map((r) => ({ ...r, vectors: r.vectors.map(smoothD23Pedigree) }));
  const train = processed.filter((r) => r.tarih < CUTOFF_DATE);
  const dev = processed.filter((r) => r.tarih >= CUTOFF_DATE);
  console.log("[P1] input=" + INPUT + " races=" + races.length + " train=" + train.length + " dev=" + dev.length);

  // ---- Correlation matrix over ALL 115 races, jointly-observed rows only ----
  const allVectors = processed.flatMap((r) => r.vectors);
  type Pair = { a: string; b: string; n: number; r: number | null; highOverlap: boolean; cluster: string | null };
  const pairs: Pair[] = [];
  for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) {
    const a = codes[i], b = codes[j];
    const xs: number[] = [], ys: number[] = [];
    for (const v of allVectors) {
      const x = v.signals.find((s) => s.code === a), y = v.signals.find((s) => s.code === b);
      if (x?.observed && y?.observed && x.rawValue != null && y.rawValue != null) { xs.push(x.rawValue); ys.push(y.rawValue); }
    }
    const r = pearson(xs, ys);
    const cluster = Object.entries(CLUSTERS).find(([, items]) => items.includes(a) && items.includes(b))?.[0] ?? null;
    pairs.push({ a, b, n: xs.length, r, highOverlap: r != null && Math.abs(r) >= 0.8, cluster });
  }
  pairs.sort((x, y) => Number(y.highOverlap) - Number(x.highOverlap) || Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0));

  // ---- Train-only ablation refit, scored on the SAME untouched dev races ----
  function fitAndEval(trainCodes: readonly string[]) {
    const stats = computeFeatureStats(train.flatMap((r) => r.vectors), trainCodes as any);
    const model = fitModel(train.map((r) => ({ raceId: r.raceId, date: new Date(r.tarih + "T00:00:00.000Z"),
      winnerNo: r.winnerNo, vectors: r.vectors })), stats, opts);
    let top1 = 0, top3 = 0, top6 = 0, logLoss = 0;
    const perRace: { raceId: string; rank: number }[] = [];
    for (const r of dev) {
      const ranked = scoreRace(r.vectors, model).sort((x, y) => y.probability - x.probability || x.no - y.no);
      const rank = ranked.findIndex((x) => x.no === r.winnerNo) + 1;
      top1 += Number(rank === 1); top3 += Number(rank <= 3 && rank > 0); top6 += Number(rank <= 6 && rank > 0);
      logLoss -= Math.log(Math.max(ranked[rank - 1]?.probability ?? 1e-9, 1e-9));
      perRace.push({ raceId: r.raceId, rank });
    }
    return { top1, top3, top6, logLoss: logLoss / dev.length, perRace };
  }

  const baseline = fitAndEval(codes);
  console.log("[P1] BASELINE top1=" + baseline.top1 + "/" + dev.length + " top3=" + baseline.top3 + "/" + dev.length +
    " top6=" + baseline.top6 + "/" + dev.length + " logLoss=" + baseline.logLoss.toFixed(4));

  function compare(name: string, trainCodes: readonly string[]) {
    const cand = fitAndEval(trainCodes);
    const baseByRace = new Map(baseline.perRace.map((r) => [r.raceId, r.rank]));
    let rescue1 = 0, rescue3 = 0, harm1 = 0, harm3 = 0;
    const changed: { raceId: string; baselineRank: number; candidateRank: number }[] = [];
    for (const c of cand.perRace) {
      const b = baseByRace.get(c.raceId)!;
      if (b > 1 && c.rank === 1) rescue1++;
      if (b > 3 && c.rank <= 3) rescue3++;
      if (b === 1 && c.rank > 1) harm1++;
      if (b <= 3 && c.rank > 3) harm3++;
      if (b !== c.rank) changed.push({ raceId: c.raceId, baselineRank: b, candidateRank: c.rank });
    }
    return { name, codes: trainCodes.length, top1: cand.top1, top3: cand.top3, top6: cand.top6,
      logLoss: cand.logLoss, deltaTop1: cand.top1 - baseline.top1, deltaTop3: cand.top3 - baseline.top3,
      deltaLogLoss: cand.logLoss - baseline.logLoss, rescue: { top1: rescue1, top3: rescue3 },
      harm: { top1: harm1, top3: harm3 }, changed };
  }

  const dropOne = codes.map((c) => compare("DROP_ONE:" + c, codes.filter((x) => x !== c)));
  const dropFamily = Object.entries(CLUSTERS).map(([name, items]) =>
    compare("DROP_FAMILY:" + name, codes.filter((c) => !items.includes(c))));

  const outPrefix = "C:/tmp/ran-d23-p1-independence-" + new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    status: "P1_SIGNAL_INDEPENDENCE_RESEARCH_ONLY",
    input: INPUT, trainN: train.length, devN: dev.length,
    baseline: { top1: baseline.top1, top3: baseline.top3, top6: baseline.top6, logLoss: baseline.logLoss },
    correlations: pairs,
    highOverlapPairs: pairs.filter((p) => p.highOverlap),
    clusterPairs: pairs.filter((p) => p.cluster),
    dropOne, dropFamily,
    note: "Correlation alone is NEVER used to drop a signal (user instruction). This report pairs correlation with train-only ablation so independence AND incremental value are visible together.",
  };
  fs.writeFileSync(outPrefix + ".report.json", JSON.stringify(report, null, 2), "utf8");
  console.log("[P1] CLUSTER_PAIRS=" + JSON.stringify(report.clusterPairs, null, 2));
  console.log("[P1] DROP_FAMILY=" + JSON.stringify(dropFamily.map((d) => ({ name: d.name, top1: d.top1, top3: d.top3,
    deltaTop1: d.deltaTop1, deltaTop3: d.deltaTop3, deltaLogLoss: d.deltaLogLoss })), null, 2));
  console.log("[P1] REPORT=" + outPrefix + ".report.json");
}

main().catch((e) => {
  console.error("[P1] ROOT_ERROR=" + (e instanceof Error ? e.stack ?? e.message : String(e)));
  process.exitCode = 1;
});
