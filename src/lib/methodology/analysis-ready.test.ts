import { describe, expect, it } from "vitest";
import { evaluateAnalysisReady } from "./analysis-ready";

const race = {
  hippodromeName: "Adana",
  raceNo: 1,
  distance: 1400,
  surface: "Kum",
};

describe("analysis-ready", () => {
  it("supportive missing does not make READY=NO", () => {
    const r = evaluateAnalysisReady({
      race,
      runnerCount: 8,
      picksValid: true,
      perHorseUsedFamilies: [["HIZ"], []],
      agfTrendAnyUsed: false,
    });
    expect(r.status).toBe("YES");
  });

  it("MARKET alone is not horse performance history", () => {
    const r = evaluateAnalysisReady({
      race,
      runnerCount: 8,
      picksValid: true,
      perHorseUsedFamilies: [["MARKET"], ["MARKET"]],
      agfTrendAnyUsed: true,
    });
    expect(r.status).toBe("NO");
    expect(r.failedMandatoryLabels).toContain("At Performans Geçmişi");
  });

  it("invalid model picks make READY=NO", () => {
    const r = evaluateAnalysisReady({
      race,
      runnerCount: 8,
      picksValid: false,
      perHorseUsedFamilies: [["RACE_FORM"]],
      agfTrendAnyUsed: true,
    });
    expect(r.status).toBe("NO");
  });
});