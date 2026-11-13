import { describe, expect, it } from "vitest";
import { buildHorseAnalysisSummary, classifyHorseKategori } from "./horse-analysis-summary";
import type { AgfTrendItem } from "@/server/actions/agf-trend.actions";

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

describe("saha-sabit sinyaller (idman artefaktı)", () => {
  const sinyaller = [
    { ad: "hizDerecesi", status: "USED" as const, raw: 4, contribution: 0.3 },
    { ad: "idmJokey", status: "USED" as const, raw: 0, contribution: -0.0141 },
    { ad: "hpRel", status: "USED" as const, raw: 5, contribution: 0.2 },
  ];
  const ortak = { rank: 3, agfTrendItem: null, jokeySon30G: null, jokeySon30GMetni: null, jokeyDestekliSurpriz: false } as const;

  it("saha-sabit idmJokey verilmezse İDMAN ailesi negatif listede çıkar (eski hata)", () => {
    const r = buildHorseAnalysisSummary({ ...ortak, signals: sinyaller });
    expect(r.enGucluNegatif.some((l) => l.family === "IDMAN")).toBe(true);
  });
  it("saha-sabit olarak işaretlenince İDMAN negatif kanıt sayılmaz", () => {
    const r = buildHorseAnalysisSummary({ ...ortak, signals: sinyaller, sabitSinyaller: new Set(["idmJokey"]) });
    expect(r.enGucluNegatif.some((l) => l.family === "IDMAN")).toBe(false);
    expect(r.butunluk.negativeFamilies).not.toContain("IDMAN");
  });
  it("yeni sinyaller (hpRel) ailelere girer ve güçlü pozitifte görünür", () => {
    const r = buildHorseAnalysisSummary({ ...ortak, signals: sinyaller });
    expect(r.enGucluPozitif.map((l) => l.family)).toContain("HANDIKAP_KILO");
  });
});
