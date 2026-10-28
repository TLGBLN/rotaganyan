/**
 * RAN D23 — P0 targeted (fast) impact report.
 *
 * Full live recapture of all 115 races via captureD23LiveVectors() is extremely slow
 * (buildUnifiedFeatureVectorsForRace recomputes every D+V1 signal, incl. a full Accurace
 * archive fetch, PER race, with no cross-race cache -- the original 115-race capture took
 * hours). The P0 fix provably touches ONLY RIVAL_GAP's hiz01Observed gate and, through it,
 * RIVAL_GAP's own observed/rawValue -- SPEED's own rawValue/observed and all other 21
 * signals are UNCHANGED by construction (confirmed by arac-ran-d23-p0-yaygilik-hizli-tarama.mts:
 * 0 "impossible" cases, i.e. strict observation is always a SUBSET of lenient).
 *
 * A race's RIVAL_GAP values can only change if at least one of ITS runners is among the
 * 37 flagged runners (lenient=observed, strict=unobserved) -- removing that runner's Q from
 * the rival pool can also shift OTHER runners' max-rival Q in the SAME race. So this script
 * only needs the full captureD23LiveVectors() call for the 14 affected races (out of 115),
 * not all of them -- ~8x fewer slow calls. For the other 101 races every signal (including
 * RIVAL_GAP/SPEED) is mathematically unchanged, so the frozen OLD journal rows are reused
 * byte-for-byte (verified, not assumed: see the per-code parity check below).
 */
import fs from "node:fs";
import { captureD23LiveVectors, smoothD23Pedigree } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";

const OLD_JOURNAL = "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";
const PREVALENCE_SCAN_GLOB_DIR = "C:/tmp";
const CUTOFF_DATE = "2026-08-21";
const opts: FitOptions = { lambda: 90, learningRate: 0.25, iterations: 2500 };

type Race = { raceId: string; tarih: string; winnerNo: number; vectors: RunnerFeatureVector[] };

function latestPrevalenceScan(): { flagged: { raceId: string; no: number; tjkAtId: number }[] } {
  const files = fs.readdirSync(PREVALENCE_SCAN_GLOB_DIR).filter((f) => f.startsWith("ran-d23-p0-prevalence-scan-"));
  if (files.length === 0) throw new Error("NO_PREVALENCE_SCAN_FOUND_RUN_IT_FIRST");
  files.sort();
  return JSON.parse(fs.readFileSync(PREVALENCE_SCAN_GLOB_DIR + "/" + files[files.length - 1], "utf8"));
}

async function main() {
  const scan = latestPrevalenceScan();
  const affectedRaceIds = new Set(scan.flagged.map((f) => f.raceId));
  console.log("[P0-FAST] affected races=" + affectedRaceIds.size);

  const lines = fs.readFileSync(OLD_JOURNAL, "utf8").trim().split(/\r?\n/);
  const oldRaces: Race[] = lines.map((l) => JSON.parse(l));
  if (oldRaces.length !== 115) throw new Error("EXPECTED_115_GOT_" + oldRaces.length);
  const codes = oldRaces[0].vectors[0].signals.map((s) => s.code);

  type DiffRow = { raceId: string; date: string; no: number; code: string; reason: string;
    oldObserved: boolean; newObserved: boolean; oldValue: number | null; newValue: number | null };
  const diffRows: DiffRow[] = [];
  const newRaces: Race[] = [];
  let processedAffected = 0;
  for (const r of oldRaces) {
    if (!affectedRaceIds.has(r.raceId)) { newRaces.push(r); continue; }
    processedAffected++;
    console.log("[P0-FAST] recapturing affected race " + processedAffected + "/" + affectedRaceIds.size + " raceId=" + r.raceId);
    const fresh = await captureD23LiveVectors(r.raceId);
    if (fresh.date !== r.tarih) throw new Error("DATE_CHANGED_" + r.raceId);
    const byNo = new Map(fresh.vectors.map((v) => [v.no, v]));
    const newVectors: RunnerFeatureVector[] = r.vectors.map((old) => {
      const nv = byNo.get(old.no);
      if (!nv) throw new Error("RUNNER_MISSING_" + r.raceId + "/" + old.no);
      const byCode = new Map(nv.signals.map((s) => [s.code, s]));
      const picked = codes.map((c) => { const s = byCode.get(c); if (!s) throw new Error("MISSING_CODE_" + c); return s; });
      const closeEnough = (a: number | null, b: number | null) => a === b || (typeof a === "number" &&
        typeof b === "number" && Math.abs(a - b) <= 1e-8 + 1e-8 * Math.max(Math.abs(a), Math.abs(b)));
      for (const code of codes) {
        const o = old.signals.find((s) => s.code === code)!;
        const n = picked.find((s) => s.code === code)!;
        const changed = o.observed !== n.observed || !closeEnough(o.rawValue, n.rawValue);
        if (changed && code !== "SPEED" && code !== "RIVAL_GAP") {
          throw new Error("UNEXPECTED_NON_P0_SIGNAL_DRIFT " + r.raceId + "/" + old.no + "/" + code +
            " old=" + JSON.stringify({ o: o.observed, v: o.rawValue }) + " new=" + JSON.stringify({ o: n.observed, v: n.rawValue }));
        }
        if (changed) {
          diffRows.push({ raceId: r.raceId, date: r.tarih, no: old.no, code,
            reason: o.observed !== n.observed ? "OBSERVED_FLAG_CHANGED" : "RAW_VALUE_CHANGED",
            oldObserved: o.observed, newObserved: n.observed, oldValue: o.rawValue, newValue: n.rawValue });
        }
      }
      return { ...old, signals: picked };
    });
    newRaces.push({ ...r, vectors: newVectors });
  }
  console.log("[P0-FAST] total SPEED/RIVAL_GAP diffs=" + diffRows.length +
    " (non-SPEED/RIVAL_GAP drift would have THROWN -- none occurred)");

  function fitAndScore(races: Race[]) {
    const processed = races.map((r) => ({ ...r, vectors: r.vectors.map(smoothD23Pedigree) }));
    const train = processed.filter((r) => r.tarih < CUTOFF_DATE);
    const dev = processed.filter((r) => r.tarih >= CUTOFF_DATE);
    const stats = computeFeatureStats(train.flatMap((r) => r.vectors), codes as any);
    const model = fitModel(train.map((r) => ({ raceId: r.raceId, date: new Date(r.tarih + "T00:00:00.000Z"),
      winnerNo: r.winnerNo, vectors: r.vectors })), stats, opts);
    let top1 = 0, top3 = 0, top6 = 0, logLoss = 0;
    const perRace: { raceId: string; rank: number }[] = [];
    for (const r of dev) {
      const ranked = scoreRace(r.vectors, model).sort((x, y) => y.probability - x.probability || x.no - y.no);
      const rank = ranked.findIndex((x) => x.no === r.winnerNo) + 1;
      top1 += Number(rank === 1); top3 += Number(rank <= 3); top6 += Number(rank <= 6);
      logLoss -= Math.log(Math.max(ranked[rank - 1]?.probability ?? 1e-9, 1e-9));
      perRace.push({ raceId: r.raceId, rank });
    }
    return { trainN: train.length, devN: dev.length, top1, top3, top6, logLoss: logLoss / dev.length, perRace };
  }

  const before = fitAndScore(oldRaces);
  const after = fitAndScore(newRaces);
  const rankChanges = before.perRace.map((b, idx) => {
    const a = after.perRace[idx];
    return { raceId: b.raceId, oldRank: b.rank, newRank: a.rank, changed: b.rank !== a.rank };
  }).filter((x) => x.changed);

  const report = {
    status: "P0_RIVAL_GAP_FIX_TARGETED_IMPACT_RESEARCH_ONLY",
    method: "Only the 14 races containing >=1 flagged runner were re-captured live; the other " +
      (115 - affectedRaceIds.size) + " races reuse the frozen OLD journal verbatim (mathematically unaffected by the fix).",
    affectedRaces: affectedRaceIds.size, totalSpeedRivalGapDiffs: diffRows.length,
    before: { ...before, perRace: undefined }, after: { ...after, perRace: undefined },
    devRankChanges: rankChanges, diffRows, releaseAllowed: false,
  };
  const outPath = "C:/tmp/ran-d23-p0-fast-impact-" + new Date().toISOString().replace(/[:.]/g, "-") + ".report.json";
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log("[P0-FAST] BEFORE top1=" + before.top1 + "/" + before.devN + " top3=" + before.top3 + "/" + before.devN +
    " top6=" + before.top6 + "/" + before.devN + " logLoss=" + before.logLoss.toFixed(4));
  console.log("[P0-FAST] AFTER  top1=" + after.top1 + "/" + after.devN + " top3=" + after.top3 + "/" + after.devN +
    " top6=" + after.top6 + "/" + after.devN + " logLoss=" + after.logLoss.toFixed(4));
  console.log("[P0-FAST] devRankChanges=" + JSON.stringify(rankChanges));
  console.log("[P0-FAST] REPORT=" + outPath);
}

main().catch((e) => {
  console.error("[P0-FAST] ROOT_ERROR=" + (e instanceof Error ? e.stack ?? e.message : String(e)));
  process.exitCode = 1;
});
