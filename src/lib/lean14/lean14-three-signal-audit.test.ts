import { describe, expect, it } from "vitest";
import { aggregateJockeyOE30 } from "./formulas/jockey-oe30-math";

describe("JOCKEY_OE30", () => {
  it("counts observed starts and applies shrinkage without AGF", () => {
    const x = aggregateJockeyOE30([
      { fieldSize: 10, position: 1 },
      { fieldSize: 10, position: 3 },
      { fieldSize: 12, position: null },
    ]);
    expect(x.observed).toBe(true);
    expect(x.sampleCount).toBe(2);
    expect(x.wins).toBe(1);
    expect(x.rawValue).not.toBeNull();
    expect(x.rawValue!).toBeCloseTo(0.08, 12); // (1 - 0.2) / (2 + 8)
  });

  it("preserves missingness rather than inventing a zero", () => {
    const x = aggregateJockeyOE30([]);
    expect(x.observed).toBe(false);
    expect(x.rawValue).toBeNull();
  });
});
