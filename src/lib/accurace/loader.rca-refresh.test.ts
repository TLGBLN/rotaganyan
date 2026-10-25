import { beforeEach, describe, expect, it, vi } from "vitest";

const { findAccurace } = vi.hoisted(() => ({ findAccurace: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    accuraceRace: { findMany: findAccurace },
    runner: { findMany: vi.fn() },
    tjkDereceKaydi: { findMany: vi.fn() },
  },
}));
import { accuraceKosulari } from "./loader";

describe("RAN RCA Accurace date-scoped snapshot repair", () => {
  beforeEach(() => findAccurace.mockReset().mockResolvedValue([]));

  it("normal production loader remains unfiltered", async () => {
    expect(await accuraceKosulari()).toEqual([]);
    expect(findAccurace).toHaveBeenCalledOnce();
    expect(findAccurace.mock.calls[0][0]).not.toHaveProperty("where");
  });

  it("explicit refresh fetches only race dates after snapshot day", async () => {
    const fromDate = new Date("2026-10-19T00:00:00.000Z");
    expect(await accuraceKosulari({ fromDate })).toEqual([]);
    expect(findAccurace).toHaveBeenCalledOnce();
    expect(findAccurace.mock.calls[0][0].where).toEqual({
      date: { gte: fromDate },
    });
  });
});
