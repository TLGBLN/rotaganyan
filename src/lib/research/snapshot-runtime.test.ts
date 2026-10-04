import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbSpy = vi.hoisted(() => {
  const fn = () => vi.fn(async () => []);
  return {
    prediction: { findUnique: vi.fn(async () => null) },
    horseRaceHistoryCache: { findMany: fn() },
    accuraceHorseSplit: { findMany: fn() },
    $executeRaw: vi.fn(async () => 0),
  };
});

vi.mock("@/lib/db", () => ({ db: dbSpy }));

import { runResearchSnapshotHook } from "./snapshot-runtime";

const ALL_DB_FNS = () => [
  dbSpy.prediction.findUnique,
  dbSpy.horseRaceHistoryCache.findMany,
  dbSpy.accuraceHorseSplit.findMany,
  dbSpy.$executeRaw,
];

function totalDbCalls() {
  return ALL_DB_FNS().reduce((s, f) => s + f.mock.calls.length, 0);
}

describe("runResearchSnapshotHook", () => {
  beforeEach(() => {
    for (const f of ALL_DB_FNS()) f.mockClear();
  });
  afterEach(() => {
    delete process.env.RESEARCH_SNAPSHOT_ENABLED;
    vi.restoreAllMocks();
  });

  it("flag kapalı (varsayılan): hiçbir DB çağrısı yapılmaz (parity)", async () => {
    delete process.env.RESEARCH_SNAPSHOT_ENABLED;
    await runResearchSnapshotHook("pred1", "race1");
    expect(totalDbCalls()).toBe(0);
  });

  it("flag 'false': hiçbir DB çağrısı yapılmaz", async () => {
    process.env.RESEARCH_SNAPSHOT_ENABLED = "false";
    await runResearchSnapshotHook("pred1", "race1");
    expect(totalDbCalls()).toBe(0);
  });

  it("flag açık ama DB hatası: throw etmez (tahmin akışı devam eder)", async () => {
    process.env.RESEARCH_SNAPSHOT_ENABLED = "true";
    dbSpy.prediction.findUnique.mockRejectedValueOnce(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(runResearchSnapshotHook("pred1", "race1")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("RESEARCH_SNAPSHOT_HOOK_FAILED", expect.anything());
  });

  it("flag açık, prediction yok: throw etmez, hiçbir yazım yapılmaz", async () => {
    process.env.RESEARCH_SNAPSHOT_ENABLED = "true";
    dbSpy.prediction.findUnique.mockResolvedValueOnce(null);
    await expect(runResearchSnapshotHook("pred1", "race1")).resolves.toBeUndefined();
    expect(dbSpy.$executeRaw).not.toHaveBeenCalled();
  });
});
