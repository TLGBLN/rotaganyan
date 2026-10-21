import { describe, expect, it } from "vitest";
import { computePistDurum01 } from "./pist-durum-score";

const target = {
  raceStart: "2026-10-17T15:00:00Z",
  surface: "CIM" as const,
  going: "Çok Ağır 5,4",
  goingCapturedAt: "2026-10-17T13:00:00Z",
  immutablePreRaceSnapshot: true,
};

const history = [
  { raceDate: "2026-09-01", surface: "CIM" as const,
    going: "Çok Ağır", finishPosition: 1, fieldSize: 8 },
  { raceDate: "2026-09-10", surface: "CIM" as const,
    going: "Çok Ağır", finishPosition: 2, fieldSize: 8 },
  { raceDate: "2026-09-15", surface: "CIM" as const,
    going: "Normal", finishPosition: 7, fieldSize: 8 },
  { raceDate: "2026-09-20", surface: "CIM" as const,
    going: "Normal", finishPosition: 8, fieldSize: 8 },
];

describe("PIST_DURUM_01 score", () => {
  it("calculates positive historical ground affinity", () => {
    const result = computePistDurum01(target, history);
    expect(result.reason).toBe("OBSERVED");
    expect(result.sameCount).toBe(2);
    expect(result.otherCount).toBe(2);
    expect(result.value).toBeGreaterThan(0);
    expect(result.value!).toBeLessThan(result.rawDelta!);
  });

  it("rejects unavailable pre-race snapshots", () => {
    const result = computePistDurum01({
      ...target,
      immutablePreRaceSnapshot: false,
    }, history);

    expect(result.value).toBeNull();
    expect(result.reason).toBe("TARGET_NOT_PIT_VERIFIED");
  });

  it("rejects conditions captured after race start", () => {
    const result = computePistDurum01({
      ...target,
      goingCapturedAt: "2026-10-17T16:00:00Z",
    }, history);

    expect(result.value).toBeNull();
    expect(result.reason).toBe("TARGET_NOT_PIT_VERIFIED");
  });

  it("does not use race-day or future results", () => {
    const extra = [
      ...history,
      { raceDate: "2026-10-17", surface: "CIM" as const,
        going: "Çok Ağır", finishPosition: 1, fieldSize: 8 },
      { raceDate: "2026-10-18", surface: "CIM" as const,
        going: "Çok Ağır", finishPosition: 1, fieldSize: 8 },
    ];

    const result = computePistDurum01(target, extra);

    expect(result.sameCount).toBe(2);
    expect(result.otherCount).toBe(2);
  });

  it("rejects insufficient comparison history", () => {
    const result = computePistDurum01(target, history.slice(0, 2));
    expect(result.value).toBeNull();
    expect(result.reason).toBe("INSUFFICIENT_COMPARISON");
  });

  it("does not treat missing going as normal", () => {
    const result = computePistDurum01({
      ...target,
      going: null,
    }, history);

    expect(result.value).toBeNull();
    expect(result.reason).toBe("TARGET_GOING_UNKNOWN");
  });
});