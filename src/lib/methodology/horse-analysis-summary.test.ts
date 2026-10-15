import { describe, expect, it } from "vitest";
import { buildHorseAnalysisSummary, classifyHorseKategori } from "./horse-analysis-summary";
import type { AgfTrendItem } from "@/server/actions/agf-trend.actions";
import type { JokeyPiyasa30 } from "@/lib/jokey-piyasa30";

describe("horse-analysis-summary", () => {
  it("uses four approved classes", () => {
    expect(classifyHorseKategori(1, false)).toBe("ANA ADAY");
    expect(classifyHorseKategori(2, false)).toBe("CIDDI RAKIP");
    expect(classifyHorseKategori(6, false)).toBe("RAKIP");
    expect(classifyHorseKategori(11, true)).toBe("SÜRPRİZ");
  });

  it("AGF trend with 2 snapshots and +0.2pp is USED/STABLE", () => {
    const r = buildHorseAnalysisSummary({
      rank: 1,
      signals: [],
      agfTrendItem: {
        runnerNo: 1,
        ilkAgf: 10,
        sonAgf: 10.2,
        fark: 0.2,
        kayitSayisi: 2,
      } as unknown as AgfTrendItem,
      jokeySon30G: null,
      jokeySon30GMetni: null,
      jokeyDestekliSurpriz: false,
    });

    expect(r.marketOzet.status).toBe("USED");
    expect(r.marketOzet.movementClass).toBe("STABLE");
  });

  it("AGF trend with 1 snapshot is insufficient", () => {
    const r = buildHorseAnalysisSummary({
      rank: 1,
      signals: [],
      agfTrendItem: {
        runnerNo: 1,
        ilkAgf: 10,
        sonAgf: 10,
        fark: 0,
        kayitSayisi: 1,
      } as unknown as AgfTrendItem,
      jokeySon30G: null,
      jokeySon30GMetni: null,
      jokeyDestekliSurpriz: false,
    });

    expect(r.marketOzet.status).toBe("INSUFFICIENT_DATA");
  });

  it("Tier-1 JOKEY is a visible analysis signal but ALL pre-existing integrity results remain identical", () => {
    const input = {
      rank: 8,
      signals: [
        { ad: "hizDerecesi", status: "USED" as const, raw: 2, contribution: 0.9 },
        { ad: "yarisGidisatiSkoru", status: "USED" as const, raw: 1, contribution: 0.5 },
        { ad: "h2hNetSkor", status: "USED" as const, raw: 2, contribution: 0.3 },
        { ad: "ACC_LATE", status: "USED" as const, raw: 1, contribution: 0.2 },
      ],
      agfTrendItem: null,
      jokeySon30G: null,
      jokeySon30GMetni: null,
      jokeyDestekliSurpriz: false,
    };
    const tier: JokeyPiyasa30 = {
      jokey: "VEDAT ABİŞ", n: 214, olculen: 206, olculemeyen: 8,
      w: 56, e: 47.89, r: 8.11, se: 5.67, z: 1.43, kapsam: 206 / 214, durum: "NORMAL",
    };
    const before = buildHorseAnalysisSummary(input);
    const after = buildHorseAnalysisSummary({...input, jokeyPiyasa30: tier});
    const { jokeyPiyasa30Sinyal: ignoredBefore, ...stableBefore } = before;
    const { jokeyPiyasa30Sinyal: signal, ...stableAfter } = after;
    expect(stableAfter).toEqual(stableBefore);
    expect(signal).toEqual({
      kod: "jokeyPiyasa30G", family: "JOKEY", lifecycle: "ANALYSIS_ONLY",
      integrityEligible: false, scoreContribution: 0, veri: tier,
    });
    expect(signal.veri?.r).toBe(8.11);
    expect(after.kanitAileleri.some(f => f.family === "JOKEY")).toBe(false);
    expect(ignoredBefore.veri).toBeNull();
  });

  it("LEGACY yakinsama never becomes positive/negative evidence", () => {
    const r = buildHorseAnalysisSummary({
      rank: 4,
      signals: [
        {
          ad: "yakinsama2Plus",
          status: "LEGACY",
          raw: 1,
          contribution: 999,
        },
      ],
      agfTrendItem: null,
      jokeySon30G: null,
      jokeySon30GMetni: null,
      jokeyDestekliSurpriz: false,
    });

    expect(r.enGucluPozitif).toHaveLength(0);
    expect(r.enGucluNegatif).toHaveLength(0);
  });
});