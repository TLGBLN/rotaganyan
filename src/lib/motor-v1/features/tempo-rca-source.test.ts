import { describe, expect, it } from "vitest";
import { tempoContextFromRuns, computeTempoLiderlikEgilimi } from "./tempo";
import type { AccuraceRun } from "@/lib/accurace/types";

const historical = (date: string, tjk: number): AccuraceRun => ({
  tjk, date: new Date(date), length: 1200, surface: "KUM", breed: "ARAP",
  hippodrome: "Ankara", going: null, place: 2, fieldSize: 8,
  finishMs: 84000, checkpoints: [], lateSegMs: null, lateSegScore: null,
  lateSegReason: null, earlyBin: 0,
});

describe("RCA explicit shared Accurace tempo input", () => {
  it("same preloaded source identity reuses tempo context, different snapshots remain isolated", () => {
    const oldRuns = [historical("2026-10-16", 123)];
    const refreshedRuns = [...oldRuns, historical("2026-10-24", 123)];
    const oldCtx = tempoContextFromRuns(oldRuns);
    const newCtx = tempoContextFromRuns(refreshedRuns);
    expect(tempoContextFromRuns(oldRuns)).toBe(oldCtx);
    expect(newCtx).not.toBe(oldCtx);
    expect(oldCtx.byTjk.get(123)).toHaveLength(1);
    expect(newCtx.byTjk.get(123)).toHaveLength(2);
  });

  it("future runs must not change pre-race signal; styleVector still uses date cutoff", () => {
    const runs = [historical("2026-10-16", 123), historical("2026-10-24", 123)];
    const target = { date: new Date("2026-10-20"), length: 1200, surface: "KUM" as const };
    const before = computeTempoLiderlikEgilimi(123, target, tempoContextFromRuns(runs.slice(0, 1)));
    const after = computeTempoLiderlikEgilimi(123, target, tempoContextFromRuns(runs));
    expect(after).toEqual(before);
  });
});
