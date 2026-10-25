// RAN RCA: immutable, pinned Accurace source already consumed by V1 tempo.
// Do not silently fall back to the slow mutable remote archive on a bad/missing snapshot.
// This is a read-only, RCA-only loader. No production call sites are changed.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import type { AccuraceRun } from "@/lib/accurace/types";

export const RCA_ACCURACE_SNAPSHOT = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";

// Yalnız RCA komutu tarafından yenilenen, repoya/production dosyalarına yazılmayan
// yerel arşiv. Worktree yolu hashlenir: başka bir repo yanlışlıkla kullanamaz.
export function rcaAccuraceRefreshedPath(): string {
  const key = createHash("sha256").update(path.resolve(process.cwd())).digest("hex").slice(0, 12);
  return path.join(os.tmpdir(), `ran-rca-accurace-${key}.json`);
}

export function rcaAccuraceSnapshotPath(): string {
  if (process.env.RAN_RCA_SNAPSHOT_PATH) return path.resolve(process.env.RAN_RCA_SNAPSHOT_PATH);
  const refreshed = rcaAccuraceRefreshedPath();
  return fs.existsSync(refreshed) ? refreshed : path.resolve(process.cwd(), RCA_ACCURACE_SNAPSHOT);
}

/** Aynı takvim gününü yeniden çekerek sınırdaki yarışların çift sayılmasını önler. */
export function rcaAccuraceRefreshDay(builtAt: string): Date {
  const d = new Date(builtAt);
  if (!Number.isFinite(d.getTime())) throw new Error("RCA_ACCURACE_REFRESH_INVALID_BUILT_AT");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Eski, dondurulmuş kayıtlar korunur; overlap penceresi DB kaynağıyla yeniden üretilir.
 * Üretim loaderındaki tarih/PIT filtreleri bu fonksiyonla değişmez.
 */
export function mergeRcaAccuraceRuns(
  previous: readonly AccuraceRun[],
  refreshed: readonly AccuraceRun[],
  startDay: Date
): AccuraceRun[] {
  if (!Number.isFinite(startDay.getTime())) throw new Error("RCA_ACCURACE_INVALID_REFRESH_DAY");
  if (refreshed.some((r) => !Number.isFinite(r.date.getTime()) || r.date.getTime() < startDay.getTime())) {
    throw new Error("RCA_ACCURACE_REFRESH_WINDOW_VIOLATION");
  }
  return [...previous.filter((r) => r.date.getTime() < startDay.getTime()), ...refreshed];
}


export type RcaAccuraceSnapshot = {
  runs: AccuraceRun[];
  builtAt: string;
  sha256: string;
};

export function loadRcaAccuraceSnapshot(
  targetDates: readonly Date[],
  snapshotPath: string = rcaAccuraceSnapshotPath()
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
