import { describe, expect, it } from "vitest";
import type {
  EvidenceFamily,
  EvidenceFamilyLine,
} from "./evidence-families";
import { evaluateSignalIntegrity } from "./signal-integrity";

const CODE_BY_FAMILY: Partial<Record<EvidenceFamily, string>> = {
  MARKET: "agfPayi",
  HIZ: "hizDerecesi",
  H2H: "h2hNetSkor",
  PIST_MESAFE_ZEMIN: "zeminMesafeDeneyim",
  TEMPO_STYLE: "yarisGidisatiSkoru",
  RACE_FORM: "ACC_LATE",
  IDMAN: "idmJokey",
  JOKEY: "jokeySon30G",
};

function line(
  family: EvidenceFamily,
  contribution: number
): EvidenceFamilyLine {
  const code = CODE_BY_FAMILY[family];
  if (!code) throw new Error(`Test code missing for ${family}`);

  return {
    family,
    label: family,
    status: "USED",
    contributionSum: contribution,
    members: [
      {
        ad: code,
        status: "USED",
        contribution,
      },
    ],
  };
}

describe("signal integrity policy", () => {
  it("rank 1 + strong independent integrity => BANKO", () => {
    const r = evaluateSignalIntegrity({
      rank: 1,
      familyLines: [
        line("MARKET", 0.4),
        line("HIZ", 0.3),
        line("RACE_FORM", 0.2),
        line("PIST_MESAFE_ZEMIN", 0.2),
        line("TEMPO_STYLE", 0.1),
        line("H2H", 0.1),
      ],
      marketMovementClass: "STABLE",
      jokeyEtkinFormPp: null,
    });

    expect(r.level).toBe("BANKO_UYUMLU");
    expect(r.recommendedBand).toBe("BANKO");
  });

  it("meaningful market drop vetoes BANKO", () => {
    const r = evaluateSignalIntegrity({
      rank: 1,
      familyLines: [
        line("MARKET", 0.4),
        line("HIZ", 0.3),
        line("RACE_FORM", 0.2),
        line("PIST_MESAFE_ZEMIN", 0.2),
        line("TEMPO_STYLE", 0.1),
        line("H2H", 0.1),
      ],
      marketMovementClass: "MEANINGFUL_DOWN",
      jokeyEtkinFormPp: null,
    });

    expect(r.recommendedBand).not.toBe("BANKO");
    expect(r.marketDownVeto).toBe(true);
  });

  it("rank 4-6 only reaches ILK3 with BANKO-level integrity", () => {
    const r = evaluateSignalIntegrity({
      rank: 5,
      familyLines: [
        line("MARKET", 0.4),
        line("HIZ", 0.3),
        line("RACE_FORM", 0.2),
        line("PIST_MESAFE_ZEMIN", 0.2),
        line("TEMPO_STYLE", 0.1),
        line("H2H", 0.1),
      ],
      marketMovementClass: "STABLE",
      jokeyEtkinFormPp: null,
    });

    expect(r.level).toBe("BANKO_UYUMLU");
    expect(r.recommendedBand).toBe("ILK3");
  });

  it("rank 7-10 reaches ILK6 only with ILK3-level integrity", () => {
    const r = evaluateSignalIntegrity({
      rank: 8,
      familyLines: [
        line("MARKET", 0.3),
        line("HIZ", 0.2),
        line("RACE_FORM", 0.2),
        line("PIST_MESAFE_ZEMIN", 0.1),
        line("H2H", -0.1),
      ],
      marketMovementClass: "STABLE",
      jokeyEtkinFormPp: null,
    });

    expect(r.level).toBe("ILK3_UYUMLU");
    expect(r.recommendedBand).toBe("ILK6");
  });

  it("market alone never creates placement integrity", () => {
    const r = evaluateSignalIntegrity({
      rank: 1,
      familyLines: [line("MARKET", 2)],
      marketMovementClass: "MEANINGFUL_UP",
      jokeyEtkinFormPp: null,
    });

    expect(r.level).toBe("YETERSIZ_BUTUNLUK");
    expect(r.recommendedBand).toBe("MODEL_SIRASI");
  });
});