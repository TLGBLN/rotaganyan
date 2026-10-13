import { describe, expect, it } from "vitest";
import { familyOfSignal, rollupEvidenceFamilies } from "./evidence-families";

describe("evidence-families", () => {
  it("AGF trio belongs to one MARKET family", () => {
    expect(familyOfSignal("agfSirasi")).toBe("MARKET");
    expect(familyOfSignal("agfPayi")).toBe("MARKET");
    expect(familyOfSignal("agfPayi2")).toBe("MARKET");
    expect(familyOfSignal("agfTrend")).toBe("MARKET");
  });

  it("yakinsama2Plus is not an evidence family member", () => {
    expect(familyOfSignal("yakinsama2Plus")).toBeNull();
  });

  it("rolls correlated MARKET members into one family", () => {
    const r = rollupEvidenceFamilies([
      { ad: "agfSirasi", status: "USED", contribution: 0.2 },
      { ad: "agfPayi", status: "USED", contribution: 0.3 },
      { ad: "agfPayi2", status: "USED", contribution: -0.1 },
    ]);
    expect(r.filter(x => x.family === "MARKET")).toHaveLength(1);
  });
});