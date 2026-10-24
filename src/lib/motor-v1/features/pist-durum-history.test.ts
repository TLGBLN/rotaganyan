import { describe, expect, it } from "vitest";
import {
  parseHistoryGoing,
  buildGoingHistory,
} from "./pist-durum-history";

import type { FieldSizeResolverFn } from "./history-source";

describe("PIST_DURUM_01 historical source", () => {
  it("reads native horse-history ground codes", () => {
    expect(parseHistoryGoing("K:Islak")).toEqual({
      surface: "KUM",
      going: "Islak",
    });

    expect(parseHistoryGoing("Ç:Çok Ağır 5.5")).toEqual({
      surface: "CIM",
      going: "Çok Ağır 5.5",
    });

    expect(parseHistoryGoing("S:Normal")).toEqual({
      surface: "SENTETIK",
      going: "Normal",
    });
  });

  it("does not invent unknown ground conditions", () => {
    expect(parseHistoryGoing("K:Bilinmeyen")).toBeNull();
    expect(parseHistoryGoing("")).toBeNull();
  });

  it("uses only historical rows before cutoff", async () => {
    const rows = [
      {
        date: "01.09.2026",
        surface: "Ç:Çok Ağır 5.5",
        finishPos: "1",
      },
      {
        date: "10.10.2026",
        surface: "Ç:Normal 3.3",
        finishPos: "4",
      },
      {
        date: "17.10.2026",
        surface: "Ç:Çok Ağır 5.5",
        finishPos: "1",
      },
      {
        date: "18.10.2026",
        surface: "Ç:Normal",
        finishPos: "1",
      },
    ];

    const resolver: FieldSizeResolverFn = async () => ({
      fieldSize: 8,
      raceId: "historical-race",
      confidence: "high",
    });

    const result = await buildGoingHistory(
      rows,
      new Date("2026-10-17T00:00:00Z"),
      resolver
    );

    expect(result.history).toHaveLength(2);
    expect(result.diagnostics.accepted).toBe(2);
    expect(result.history[0].surface).toBe("CIM");
    expect(result.history[0].finishPosition).toBe(1);
    expect(result.history[0].fieldSize).toBe(8);
  });

  it("does not invent field size", async () => {
    const rows = [{
      date: "01.09.2026",
      surface: "K:Nemli",
      finishPos: "2",
    }];

    const resolver: FieldSizeResolverFn =
      async () => null;

    const result = await buildGoingHistory(
      rows,
      new Date("2026-10-17T00:00:00Z"),
      resolver
    );

    expect(result.history).toHaveLength(0);
    expect(result.diagnostics.skippedResolver).toBe(1);
  });
});