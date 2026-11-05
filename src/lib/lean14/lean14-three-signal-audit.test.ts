import { test } from "node:test";
import { strict as assert } from "node:assert";
import { aggregateJockeyOE30 } from "./formulas/jockey-oe30-math";

test("JOCKEY_OE30: observed n and shrunk residual, no AGF", () => {
  const x = aggregateJockeyOE30([
    { fieldSize: 10, position: 1 }, { fieldSize: 10, position: 3 }, { fieldSize: 12, position: null },
  ]);
  assert.equal(x.observed, true);
  assert.equal(x.sampleCount, 2);
  assert.equal(x.wins, 1);
  assert.ok(Math.abs(x.rawValue! - 0.08) < 1e-10); // (1-.2)/(2+8)
});
test("JOCKEY_OE30: empty is missing, not a fabricated zero", () => {
  const x = aggregateJockeyOE30([]);
  assert.equal(x.observed, false);
  assert.equal(x.rawValue, null);
});
