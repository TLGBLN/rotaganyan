import { beforeEach, describe, expect, it, vi } from "vitest";

const { runnersMock, valuesMock, observedMock } = vi.hoisted(() => ({
  runnersMock: vi.fn(),
  valuesMock: vi.fn(),
  observedMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { runner: { findMany: runnersMock } },
}));
vi.mock("@/server/actions/hiz-derecesi.actions", () => ({
  getHizDerecesiForRace: valuesMock,
  getHizDerecesiGozlemliForRace: observedMock,
}));

import { computeRaceClassStrength, type RaceClassStrength } from "./sinif";

describe("SINIF: historical class-strength race inputs reuse", () => {
  beforeEach(() => {
    runnersMock.mockReset();
    valuesMock.mockReset();
    observedMock.mockReset();
    runnersMock.mockResolvedValue([
      { no: 1, tjkAtId: 11 }, { no: 2, tjkAtId: 22 }, { no: 3, tjkAtId: 33 },
    ]);
    valuesMock.mockResolvedValue(new Map([[1, 0.1], [2, 0.3], [3, 0.8]]));
    observedMock.mockResolvedValue(new Map([[1, true], [2, true], [3, true]]));
  });

  it("aynı context/farklı at: ham SQL bir kere, leave-one-out her at için bağımsız", async () => {
    const context = new Map<string, Promise<RaceClassStrength>>();
    const [horse1, horse2, horse3] = await Promise.all([
      computeRaceClassStrength("oldRace", 11, context),
      computeRaceClassStrength("oldRace", 22, context),
      computeRaceClassStrength("oldRace", 33, context),
    ]);
    expect(horse1).toEqual({ value: 0.55, fieldSize: 2 });
    expect(horse2).toEqual({ value: 0.45, fieldSize: 2 });
    expect(horse3).toEqual({ value: 0.2, fieldSize: 2 });
    expect(runnersMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(observedMock).toHaveBeenCalledTimes(1);
  });

  it("farklı hesaplama context'i taze DB okur", async () => {
    await computeRaceClassStrength("oldRace", 11, new Map());
    await computeRaceClassStrength("oldRace", 11, new Map());
    expect(runnersMock).toHaveBeenCalledTimes(2);
  });

  it("cache verilmezse önceki bağımsız hesaplama aynen çalışır", async () => {
    const direct1 = await computeRaceClassStrength("oldRace", 11);
    const direct2 = await computeRaceClassStrength("oldRace", 22);
    expect(direct1).toEqual({ value: 0.55, fieldSize: 2 });
    expect(direct2).toEqual({ value: 0.45, fieldSize: 2 });
    expect(runnersMock).toHaveBeenCalledTimes(2);
    expect(valuesMock).toHaveBeenCalledTimes(2);
  });

  it("boş gözlem ham değerini uydurmaz", async () => {
    observedMock.mockResolvedValue(new Map([[1, false], [2, false], [3, false]]));
    expect(await computeRaceClassStrength("oldRace", 11, new Map())).toEqual({ value: null, fieldSize: 0 });
  });
});
