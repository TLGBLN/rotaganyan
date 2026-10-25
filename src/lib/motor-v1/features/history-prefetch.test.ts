import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { race: { findMany, findFirst } } }));

import { createFieldSizeResolver, prefetchRecentFieldSizes, resolveFieldSize, type HistoryRow } from "./history-source";

const row = { date: "24.10.2026", city: "Ankara", raceNo: "3", finishPos: "2" } as HistoryRow;
const cutoff = new Date("2026-10-25T00:00:00.000Z");

describe("RCA scoped prefetch", () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    findFirst.mockReset();
  });

  it("son 24 PIT-safe satır tek batch, gelecek ve bitişsiz satır dışarı", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...row, raceNo: String(i + 1) }));
    rows.push({ ...row, raceNo: "55", date: "26.10.2026" });
    rows.push({ ...row, raceNo: "56", finishPos: "" });
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    prefetchRecentFieldSizes(resolver, rows, cutoff);
    await resolver(rows[0]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0].where.OR;
    expect(args).toHaveLength(24);
    expect(args.some((x: { raceNo: number }) => x.raceNo === 55 || x.raceNo === 56)).toBe(false);
  });

  it("normal resolver ekstra sorgu üretmez", () => {
    prefetchRecentFieldSizes(createFieldSizeResolver(), [row], cutoff);
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("prefetch değeri tekli sorguyla aynı kalır", async () => {
    const race = {
      id: "r3", raceNo: 3,
      raceDay: { date: new Date("2026-10-24T10:00:00Z"), hippodrome: { name: "Ankara" } },
      result: { actualOrder: [1, 2] },
      runners: [{ id: "a" }, { id: "b" }, { id: "c" }],
    };
    findMany.mockResolvedValue([race]);
    findFirst.mockResolvedValue(race);
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    prefetchRecentFieldSizes(resolver, [row], cutoff);
    expect(await resolver(row)).toEqual(await resolveFieldSize(row));
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
