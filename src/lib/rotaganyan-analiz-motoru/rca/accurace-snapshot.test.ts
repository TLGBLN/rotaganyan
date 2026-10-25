import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadRcaAccuraceSnapshot, mergeRcaAccuraceRuns, rcaAccuraceRefreshDay } from "./accurace-snapshot";
import type { AccuraceRun } from "@/lib/accurace/types";

const dirs: string[] = [];
function fixture(text: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ran-rca-snap-"));
  dirs.push(dir);
  const file = path.join(dir, "snapshot.json");
  fs.writeFileSync(file, text);
  return file;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
describe("RCA deterministic Accurace snapshot", () => {
  const sample = JSON.stringify({
    builtAt: "2026-10-24T20:00:00.000Z",
    runs: [{
      tjk: 234, date: "2026-10-20T00:00:00.000Z", length: 1400,
      surface: "KUM", breed: "ARAP", hippodrome: "Ankara", going: null,
      place: 2, fieldSize: 10, finishMs: 89000, checkpoints: [],
      lateSegMs: null, lateSegScore: null, lateSegReason: null, earlyBin: null,
    }],
  });
  it("local snapshot returns typed Date and stable content fingerprint", () => {
    const f = fixture(sample);
    const one = loadRcaAccuraceSnapshot([new Date("2026-10-23")], f);
    const two = loadRcaAccuraceSnapshot([new Date("2026-10-23")], f);
    expect(one.runs).toHaveLength(1);
    expect(one.runs[0].date).toBeInstanceOf(Date);
    expect(one.runs[0].date.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(one.sha256).toBe(two.sha256);
    expect(one.sha256).toHaveLength(64);
  });
  it("rejects snapshots built before the target PIT window", () => {
    expect(() => loadRcaAccuraceSnapshot([new Date("2026-10-25")], fixture(sample))).toThrow("RCA_ACCURACE_SNAPSHOT_TOO_OLD");
  });
  it("rejects missing source; never goes to remote DB", () => {
    expect(() => loadRcaAccuraceSnapshot([], "/nonexistent/ran-rca-test-snapshot.json")).toThrow("RCA_ACCURACE_SNAPSHOT_MISSING");
  });
  it("rejects corrupt JSON and unexpected run values", () => {
    expect(() => loadRcaAccuraceSnapshot([], fixture("{"))).toThrow("INVALID_JSON");
    expect(() => loadRcaAccuraceSnapshot([], fixture(JSON.stringify({ builtAt: "2026-10-24", runs: [{ tjk: 1, date: "not a date", checkpoints: [] }] })))).toThrow("INVALID_RUN");
  });
});

describe("RCA Accurace refresh window", () => {
  const run = (date: string, tjk: number) => ({
    tjk, date: new Date(date), length: 1200, surface: "KUM", breed: "ARAP",
    hippodrome: "Ankara", going: null, place: 1, fieldSize: 8,
    finishMs: 84000, checkpoints: [], lateSegMs: null, lateSegScore: null,
    lateSegReason: null, earlyBin: null,
  }) as AccuraceRun;

  it("builtAt gününü UTC gece yarısına indirir; yarış günü overlap yenilenir", () => {
    expect(rcaAccuraceRefreshDay("2026-10-19T14:19:54.168Z").toISOString())
      .toBe("2026-10-19T00:00:00.000Z");
  });

  it("19 Ekim overlap silinir, daha eski korunur ve güncel kayıt yalnız bir kez eklenir", () => {
    const old = [run("2026-10-18", 1), run("2026-10-19", 2)];
    const recent = [run("2026-10-19", 2), run("2026-10-24", 3)];
    const merged = mergeRcaAccuraceRuns(old, recent, rcaAccuraceRefreshDay("2026-10-19T14:19:54Z"));
    expect(merged.map((r) => r.tjk)).toEqual([1, 2, 3]);
    expect(merged[0]).toBe(old[0]);
    expect(merged[1]).toBe(recent[0]);
    expect(merged[2].date.toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });

  it("kısmi veri yanlışlıkla eski dönemden dönerse sessizce birleştirmez", () => {
    expect(() => mergeRcaAccuraceRuns(
      [run("2026-10-18", 1)], [run("2026-10-18", 1)], new Date("2026-10-19")
    )).toThrow("RCA_ACCURACE_REFRESH_WINDOW_VIOLATION");
  });
});
