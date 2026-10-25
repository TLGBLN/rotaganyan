// RAN RCA: immutable, pinned Accurace source already consumed by V1 tempo.
// Do not silently fall back to the slow mutable remote archive on a bad/missing snapshot.
// This is a read-only, RCA-only loader. No production call sites are changed.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AccuraceRun } from "@/lib/accurace/types";

export const RCA_ACCURACE_SNAPSHOT = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";

export type RcaAccuraceSnapshot = {
  runs: AccuraceRun[];
  builtAt: string;
  sha256: string;
};

export function loadRcaAccuraceSnapshot(
  targetDates: readonly Date[],
  snapshotPath: string = path.resolve(process.cwd(), RCA_ACCURACE_SNAPSHOT)
): RcaAccuraceSnapshot {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`RCA_ACCURACE_SNAPSHOT_MISSING: ${snapshotPath}; database fallback disabled`);
  }
  const bytes = fs.readFileSync(snapshotPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch { throw new Error("RCA_ACCURACE_SNAPSHOT_INVALID_JSON: database fallback disabled"); }

  if (parsed == null || typeof parsed !== "object") {
    throw new Error("RCA_ACCURACE_SNAPSHOT_INVALID: root object required");
  }
  const snapshot = parsed as { builtAt?: unknown; runs?: unknown };
  const builtAt = typeof snapshot.builtAt === "string" ? snapshot.builtAt : "";
  const builtMillis = Date.parse(builtAt);
  if (!Number.isFinite(builtMillis) || !Array.isArray(snapshot.runs) || snapshot.runs.length === 0) {
    throw new Error("RCA_ACCURACE_SNAPSHOT_INVALID: builtAt and nonempty runs required");
  }

  // An already-stale snapshot must not silently stand in for future backtests.
  for (const date of targetDates) {
    if (!Number.isFinite(date.getTime())) {
      throw new Error("RCA_ACCURACE_TARGET_DATE_INVALID");
    }
    if (date.getTime() > builtMillis) {
      throw new Error(`RCA_ACCURACE_SNAPSHOT_TOO_OLD: builtAt=${builtAt}; target=${date.toISOString()}; refresh snapshot explicitly before RCA`);
    }
  }

  const runs: AccuraceRun[] = [];
  for (const raw of snapshot.runs) {
    if (raw == null || typeof raw !== "object") throw new Error("RCA_ACCURACE_SNAPSHOT_INVALID_RUN");
    const item = raw as Omit<AccuraceRun, "date"> & { date: string };
    const date = new Date(item.date);
    if (!Number.isFinite(date.getTime()) || !Number.isInteger(item.tjk) || !Array.isArray(item.checkpoints)) {
      throw new Error("RCA_ACCURACE_SNAPSHOT_INVALID_RUN: date/tjk/checkpoints");
    }
    runs.push({ ...item, date });
  }
  return { runs, builtAt, sha256 };
}
