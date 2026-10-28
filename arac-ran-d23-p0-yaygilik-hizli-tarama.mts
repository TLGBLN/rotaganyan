/**
 * RAN D23 — P0 lightweight prevalence scan: how often does the OLD lenient
 * "hist.length>0" gate disagree with the strict speedObservedAsOf() gate, across the
 * runners of the 115 frozen races? This is a fast, read-only, DB-light companion to the
 * full captureD23LiveVectors() impact report (arac-ran-d23-p0-rivalgap-etki-raporu.mts),
 * which also recomputes every other D23 signal and is much slower. This script only
 * touches: Runner (no/tjkAtId/breed for these 115 races) + HorseRaceHistoryCache +
 * breedToIrk/hizDerecesiHesaplaOrtak/speedObservedAsOf -- the exact inputs to the bug.
 */
import fs from "node:fs";
import { db } from "@/lib/db";
import { breedToIrk } from "@/lib/sire-stat-match";
import { hizDerecesiHesaplaOrtak } from "@/lib/methodology/hiz-derecesi-hesapla";
import { speedObservedAsOf } from "./src/lib/rotaganyan-analiz-motoru/feature-calculators/pit-sire-speed";
import { loadD23StableSpeed } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";

const OLD_JOURNAL = "C:/tmp/ran-d23-kaynak-fix-20261028-085335.journal-saklanan-115.ndjson";

async function main() {
  const lines = fs.readFileSync(OLD_JOURNAL, "utf8").trim().split(/\r?\n/);
  const races: { raceId: string; tarih: string }[] = lines.map((l) => JSON.parse(l));
  const raceIds = races.map((r) => r.raceId);
  console.log("[P0-SCAN] races=" + raceIds.length);

  const stable = await loadD23StableSpeed();
  const raceRows = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, breed: true, raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, tjkAtId: true } } },
  });
  if (raceRows.length !== raceIds.length) throw new Error("RACE_COUNT_MISMATCH " + raceRows.length);

  let totalRunners = 0, bothTrue = 0, bothFalse = 0, lenientTrueStrictFalse = 0, lenientFalseStrictTrue = 0;
  const flagged: { raceId: string; no: number; tjkAtId: number }[] = [];
  for (const race of raceRows) {
    const breed = breedToIrk(race.breed);
    for (const r of race.runners) {
      if (r.tjkAtId == null) continue;
      const ambiguous = stable.ambiguousIds.has(r.tjkAtId);
      if (ambiguous) continue; // both flags already force false identically; not part of the P0 divergence
      totalRunners++;
      const hist = stable.history.get(r.tjkAtId) ?? [];
      const lenient = hist.length > 0;
      const strict = speedObservedAsOf(hist, breed, race.raceDay.date, stable.index);
      if (lenient && strict) bothTrue++;
      else if (!lenient && !strict) bothFalse++;
      else if (lenient && !strict) {
        lenientTrueStrictFalse++;
        flagged.push({ raceId: race.id, no: r.no, tjkAtId: r.tjkAtId });
      } else lenientFalseStrictTrue++; // should be impossible: strict is a subset condition of lenient
    }
  }
  console.log("[P0-SCAN] totalRunners(non-ambiguous,tjkAtId!=null)=" + totalRunners);
  console.log("[P0-SCAN] bothObserved=" + bothTrue + " bothUnobserved=" + bothFalse);
  console.log("[P0-SCAN] BUG_PRONE lenient=observed,strict=unobserved=" + lenientTrueStrictFalse +
    " (" + ((100 * lenientTrueStrictFalse) / totalRunners).toFixed(1) + "% of runners)");
  console.log("[P0-SCAN] IMPOSSIBLE_CASE lenient=unobserved,strict=observed=" + lenientFalseStrictTrue +
    " (sanity check, must be 0)");
  const outPath = "C:/tmp/ran-d23-p0-prevalence-scan-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  fs.writeFileSync(outPath, JSON.stringify({
    totalRunners, bothTrue, bothFalse, lenientTrueStrictFalse, lenientFalseStrictTrue, flagged,
  }, null, 2), "utf8");
  console.log("[P0-SCAN] REPORT=" + outPath);
  await db.$disconnect();
}
main().catch(async (e) => {
  console.error("[P0-SCAN] ROOT_ERROR=" + (e instanceof Error ? e.stack ?? e.message : String(e)));
  try { await db.$disconnect(); } catch {}
  process.exitCode = 1;
});
