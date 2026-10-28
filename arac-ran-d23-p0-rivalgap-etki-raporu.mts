/**
 * RAN D23 — P0 RIVAL_GAP data-integrity fix: race-based impact report.
 *
 * Context: d23-feature-capture.ts fed RAK_GAP_01 (RIVAL_GAP) a "hiz01Observed" flag
 * gated on bare history existence (hist.length>0), while SPEED's OWN "observed" flag
 * requires speedObservedAsOf() -- a real, population-comparable pace within the last
 * 365 days with a >=20-sample bucket. hizDerecesiHesaplaOrtak() silently returns 0
 * (not null) when there is no usable comparison, so RIVAL_GAP could treat a horse with
 * NO real speed evidence as an "observed, exactly-average-pace" horse. Fixed by making
 * RIVAL_GAP share SPEED's exact observation gate (git diff: d23-feature-capture.ts).
 *
 * This script does NOT touch the frozen 115-race (86 train / 29 dev) original journal.
 * It re-reads the SAME 115 raceIds from the live (mutable, PIT-not-proven) DB using the
 * FIXED captureD23LiveVectors(), diffs SPEED/RIVAL_GAP against the original frozen
 * capture, and separately refits+rescales using the SAME chronological 86/29 split and
 * SAME lambda=90 default used for the original 0.2759/0.5862/1.0/1.979 baseline, so the
 * net effect of the fix alone (not a dataset change) can be read off directly.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ran-d23-p0-rivalgap-etki-raporu.mts
 */
import fs from "node:fs";
import { captureD23LiveVectors, smoothD23Pedigree } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";

const OLD_JOURNAL = "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";
const OUT_PREFIX = "C:/tmp/ran-d23-p0-rivalgap-fix-impact-" + new Date().toISOString().replace(/[:.]/g, "-");
const CUTOFF_DATE = "2026-08-21"; // same chronological development cutoff as the 86/29 baseline
const opts: FitOptions = { lambda: 90, learningRate: 0.25, iterations: 2500 };

type OldRace = { raceId: string; tarih: string; winnerNo: number; vectors: RunnerFeatureVector[] };

function selectCodes(signals: RunnerFeatureVector["signals"], codes: readonly string[]) {
  const byCode = new Map(signals.map((s) => [s.code, s]));
  return codes.map((c) => {
    const s = byCode.get(c);
    if (!s) throw new Error("MISSING_CODE_" + c);
    return s;
  });
}

async function main() {
  const lines = fs.readFileSync(OLD_JOURNAL, "utf8").trim().split(/\r?\n/);
  const oldRaces: OldRace[] = lines.map((l) => JSON.parse(l));
  if (oldRaces.length !== 115) throw new Error("EXPECTED_115_RACES_GOT_" + oldRaces.length);
  const codes = oldRaces[0].vectors[0].signals.map((s) => s.code);
  console.log("[P0-IMPACT] races=" + oldRaces.length + " codes=" + codes.length);

  type DiffRow = { raceId: string; date: string; no: number; code: string; reason: string;
    oldObserved: boolean; newObserved: boolean; oldValue: number | null; newValue: number | null };
  const diffRows: DiffRow[] = [];
  const newRaces: OldRace[] = [];
  let i = 0;
  for (const r of oldRaces) {
    i++;
    console.log("[P0-IMPACT] capturing " + i + "/" + oldRaces.length + " raceId=" + r.raceId);
    const fresh = await captureD23LiveVectors(r.raceId);
    if (fresh.date !== r.tarih) throw new Error("DATE_CHANGED_" + r.raceId);
    const byNo = new Map(fresh.vectors.map((v) => [v.no, v]));
    const newVectors: RunnerFeatureVector[] = r.vectors.map((old) => {
      const nv = byNo.get(old.no);
      if (!nv) throw new Error("RUNNER_MISSING_" + r.raceId + "/" + old.no);
      const picked = selectCodes(nv.signals, codes);
      for (const code of ["SPEED", "RIVAL_GAP"]) {
        const o = old.signals.find((s) => s.code === code)!;
        const n = picked.find((s) => s.code === code)!;
        if (o.observed !== n.observed || o.rawValue !== n.rawValue) {
          diffRows.push({
            raceId: r.raceId, date: r.tarih, no: old.no, code,
            reason: o.observed !== n.observed ? "OBSERVED_FLAG_CHANGED" : "RAW_VALUE_CHANGED",
            oldObserved: o.observed, newObserved: n.observed,
            oldValue: o.rawValue, newValue: n.rawValue,
          });
        }
      }
      return { ...old, signals: picked };
    });
    newRaces.push({ ...r, vectors: newVectors });
  }

  console.log("[P0-IMPACT] total SPEED/RIVAL_GAP diffs=" + diffRows.length);
  const byCode = { SPEED: diffRows.filter((d) => d.code === "SPEED").length,
    RIVAL_GAP: diffRows.filter((d) => d.code === "RIVAL_GAP").length };
  console.log("[P0-IMPACT] byCode=" + JSON.stringify(byCode));
  const flaggedFalsePositives = diffRows.filter((d) => d.code === "RIVAL_GAP" &&
    d.oldObserved === true && d.newObserved === false);
  console.log("[P0-IMPACT] RIVAL_GAP false-observed runners corrected to unobserved=" + flaggedFalsePositives.length);

  function fitAndScore(races: OldRace[]) {
    const processed = races.map((r) => ({ ...r, vectors: r.vectors.map(smoothD23Pedigree) }));
    const train = processed.filter((r) => r.tarih < CUTOFF_DATE);
    const dev = processed.filter((r) => r.tarih >= CUTOFF_DATE);
    const stats = computeFeatureStats(train.flatMap((r) => r.vectors), codes as any);
    const model = fitModel(train.map((r) => ({ raceId: r.raceId, date: new Date(r.tarih + "T00:00:00.000Z"),
      winnerNo: r.winnerNo, vectors: r.vectors })), stats, opts);
    let top1 = 0, top3 = 0, top6 = 0, logLoss = 0;
    const perRace: { raceId: string; date: string; oldRank?: number; newRank?: number }[] = [];
    for (const r of dev) {
      const ranked = scoreRace(r.vectors, model).sort((x, y) => y.probability - x.probability || x.no - y.no);
      const idx = ranked.findIndex((x) => x.no === r.winnerNo);
      top1 += Number(idx === 0); top3 += Number(idx >= 0 && idx < 3); top6 += Number(idx >= 0 && idx < 6);
      logLoss -= Math.log(Math.max(ranked[idx]?.probability ?? 1e-9, 1e-9));
      perRace.push({ raceId: r.raceId, date: r.tarih, newRank: idx + 1 });
    }
    return { trainN: train.length, devN: dev.length, top1, top3, top6,
      logLoss: logLoss / dev.length, perRace };
  }

  const before = fitAndScore(oldRaces);
  const after = fitAndScore(newRaces);
  const rankChanges = before.perRace.map((b, idx) => {
    const a = after.perRace[idx];
    return { raceId: b.raceId, date: b.date, oldRank: b.newRank, newRank: a.newRank,
      changed: b.newRank !== a.newRank };
  }).filter((x) => x.changed);

  const report = {
    status: "P0_RIVAL_GAP_FIX_IMPACT_RESEARCH_ONLY_NOT_RELEASE",
    source: "SAME_115_RACE_IDS_RECAPTURED_FROM_CURRENT_MUTABLE_DB_PIT_NOT_PROVEN",
    originalFrozenJournal: OLD_JOURNAL,
    totalSpeedRivalGapDiffs: diffRows.length,
    diffsByCode: byCode,
    rivalGapFalseObservedCorrected: flaggedFalsePositives.length,
    before: { top1: before.top1, top3: before.top3, top6: before.top6, logLoss: before.logLoss,
      devN: before.devN, top1Rate: before.top1 / before.devN, top3Rate: before.top3 / before.devN,
      top6Rate: before.top6 / before.devN },
    after: { top1: after.top1, top3: after.top3, top6: after.top6, logLoss: after.logLoss,
      devN: after.devN, top1Rate: after.top1 / after.devN, top3Rate: after.top3 / after.devN,
      top6Rate: after.top6 / after.devN },
    devRankChanges: rankChanges,
    releaseAllowed: false,
  };
  fs.writeFileSync(OUT_PREFIX + ".report.json", JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(OUT_PREFIX + ".diffs.csv",
    "\ufeff" + "raceId;date;no;code;reason;oldObserved;newObserved;oldValue;newValue\n" +
    diffRows.map((d) => [d.raceId, d.date, d.no, d.code, d.reason, d.oldObserved, d.newObserved, d.oldValue, d.newValue].join(";")).join("\n") + "\n",
    "utf8");
  console.log("[P0-IMPACT] BEFORE=" + JSON.stringify(report.before));
  console.log("[P0-IMPACT] AFTER=" + JSON.stringify(report.after));
  console.log("[P0-IMPACT] REPORT=" + OUT_PREFIX + ".report.json");
  console.log("[P0-IMPACT] DIFFS_CSV=" + OUT_PREFIX + ".diffs.csv");
}

main().then(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
}).catch(async (e) => {
  console.error("[P0-IMPACT] ROOT_ERROR=" + (e instanceof Error ? e.stack ?? e.message : String(e)));
  try { const { db } = await import("@/lib/db"); await db.$disconnect(); } catch {}
  process.exitCode = 1;
});
