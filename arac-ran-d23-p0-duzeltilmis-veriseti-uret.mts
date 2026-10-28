/**
 * RAN D23 — P0: materialize the FULL 115-race, P0-fix-corrected dataset by patching the
 * frozen OLD journal with the exact per-(raceId,no,RIVAL_GAP) corrections already proven
 * by the targeted live recapture (arac-ran-d23-p0-hedefli-etki-raporu.mts's diffRows,
 * which also proved -- by throwing otherwise -- that NO other of the 23 signals drifted).
 * This avoids a second, slow 115-race live recapture: the 101 untouched races are
 * mathematically identical to the OLD journal; only the ~53 RIVAL_GAP entries in the 14
 * affected races need patching. Output feeds P1 (signal independence) and P3 (lambda
 * sweep) with genuinely P0-corrected data, as the user instructed.
 */
import fs from "node:fs";

const OLD_JOURNAL = "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";

function latestFastImpactReport(): any {
  const files = fs.readdirSync("C:/tmp").filter((f) => f.startsWith("ran-d23-p0-fast-impact-"));
  if (files.length === 0) throw new Error("NO_FAST_IMPACT_REPORT_FOUND");
  files.sort();
  return JSON.parse(fs.readFileSync("C:/tmp/" + files[files.length - 1], "utf8"));
}

const report = latestFastImpactReport();
const lines = fs.readFileSync(OLD_JOURNAL, "utf8").trim().split(/\r?\n/);
const races = lines.map((l) => JSON.parse(l));
if (races.length !== 115) throw new Error("EXPECTED_115_GOT_" + races.length);

type DiffRow = { raceId: string; no: number; code: string; newObserved: boolean; newValue: number | null };
const byKey = new Map<string, DiffRow>();
for (const d of report.diffRows as DiffRow[]) byKey.set(d.raceId + "|" + d.no + "|" + d.code, d);
if (byKey.size !== report.totalSpeedRivalGapDiffs) throw new Error("DIFF_KEY_COLLISION");

let patched = 0;
for (const r of races) {
  for (const v of r.vectors) {
    for (const s of v.signals) {
      const d = byKey.get(r.raceId + "|" + v.no + "|" + s.code);
      if (!d) continue;
      if (s.observed !== d.newObserved || s.rawValue !== d.newValue) {
        s.observed = d.newObserved; s.rawValue = d.newValue;
        if (!d.newObserved) { s.missingReason = s.missingReason ?? "P0_FIX_NO_USABLE_SPEED_POPULATION_MATCH"; }
        patched++;
      }
    }
  }
}
if (patched !== report.totalSpeedRivalGapDiffs)
  throw new Error("PATCH_COUNT_MISMATCH patched=" + patched + " expected=" + report.totalSpeedRivalGapDiffs);

const outPath = "C:/tmp/ran-d23-p0-corrected-115.journal.ndjson";
fs.writeFileSync(outPath, races.map((r: unknown) => JSON.stringify(r)).join("\n") + "\n", "utf8");
console.log("[P0-MATERIALIZE] patched=" + patched + " races=" + races.length + " OUTPUT=" + outPath);
