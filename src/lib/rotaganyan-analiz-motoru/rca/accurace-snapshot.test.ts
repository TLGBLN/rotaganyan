import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadRcaAccuraceSnapshot } from "./accurace-snapshot";

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
