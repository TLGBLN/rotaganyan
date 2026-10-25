import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildGoingHistoryMock } = vi.hoisted(() => ({ buildGoingHistoryMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { race: { findUnique: vi.fn() } } }));
vi.mock("./pist-durum-history", () => ({ buildGoingHistory: buildGoingHistoryMock }));

import { computePistDurumForRunner, type PistDurumContext } from "./pist-durum-wiring";

const target = {
  raceStart: "2026-10-24T14:00:00.000Z",
  surface: "CIM" as const,
  going: "Çok Ağır",
  goingCapturedAt: null,
  immutablePreRaceSnapshot: false,
};

describe("RAN RCA PIST_DURUM_01 early PIT rejection", () => {
  const resolver = vi.fn().mockResolvedValue(null);
  const ctx: PistDurumContext = { target, resolver };

  beforeEach(() => {
    resolver.mockClear();
    buildGoingHistoryMock.mockReset().mockResolvedValue({ history: [] });
  });

  it("sonuçlanmış yarışda PIT kanıtı yoksa ağır geçmiş çağrısını ATLAYIP aynı neden döner", async () => {
    const result = await computePistDurumForRunner(ctx, 123, [{ date: "01.10.2026" }], new Date("2026-10-24"));
    expect(result.value).toBeNull();
    expect(result.reason).toBe("TARGET_NOT_PIT_VERIFIED");
    expect(result.regime).not.toBeNull();
    expect(buildGoingHistoryMock).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("canlı ve PIT-geçerli koşuda geçmiş hesaplaması AYNEN korunur", async () => {
    const liveCtx: PistDurumContext = {
      ...ctx, target: {
        ...target, immutablePreRaceSnapshot: true, goingCapturedAt: "2026-10-24T13:00:00.000Z",
      }
    };
    const json = [{ date: "01.10.2026" }];
    const cutoff = new Date("2026-10-24");
    const actual = await computePistDurumForRunner(liveCtx, 123, json, cutoff);
    expect(buildGoingHistoryMock).toHaveBeenCalledOnce();
    expect(buildGoingHistoryMock).toHaveBeenCalledWith(json, cutoff, resolver);
    expect(actual.reason).toBe("INSUFFICIENT_COMPARISON");
  });

  it("going bilinmiyorsa PIT-geçerli olsa bile geçmişi okumaz", async () => {
    const liveCtx: PistDurumContext = {
      ...ctx, target: {
        ...target, going: null, immutablePreRaceSnapshot: true, goingCapturedAt: "2026-10-24T13:00:00.000Z",
      }
    };
    const actual = await computePistDurumForRunner(liveCtx, 123, [], new Date("2026-10-24"));
    expect(actual.reason).toBe("TARGET_GOING_UNKNOWN");
    expect(buildGoingHistoryMock).not.toHaveBeenCalled();
  });

  it("kimlik çözülmezse mevcut IDENTITY_UNRESOLVED davranışı korunur", async () => {
    const result = await computePistDurumForRunner(ctx, null, [], new Date("2026-10-24"));
    expect(result.reason).toBe("IDENTITY_UNRESOLVED");
    expect(buildGoingHistoryMock).not.toHaveBeenCalled();
  });
});
