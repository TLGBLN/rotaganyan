import { describe, expect, it } from "vitest";
import { computeFeatureStats, explainRunner, fitModel, scoreRace, toModelVector, type FittedModel } from "./training";
import type { RunnerFeatureVector } from "./feature-vector";

const CODES = ["EQUIPMENT_CHANGE", "SPEED"] as const;
type State = 0 | 1 | 2 | 3;
function fv(no: number, state: State | null, speed = 0, v2 = true): RunnerFeatureVector {
  return {
    raceId: "test", no, name: "Horse "+no, tjkAtId: no, jockey: null,
    ...(v2 ? { d23FormulaVersion: "D23_FORMULAS_V2" as const } : {}),
    signals: [
      { code: "EQUIPMENT_CHANGE", family: "DAV",
        observed: state !== null, rawValue: state, coverageState: null,
        asOfSafe: true, missingReason: state === null ? "NO_HISTORY" : null,
        ...(state !== null ? { equipmentState: state } : {}) },
      { code: "SPEED", family: "HIZ",
        observed: true, rawValue: speed, coverageState: null, asOfSafe: true,
        missingReason: null },
    ],
  };
}
describe("D23 categorical equipment encoding — NOT V5", () => {
  const data = [fv(1,0),fv(2,1),fv(3,2),fv(4,3),fv(5,null)];
  const st = computeFeatureStats(data,CODES);
  it("preserves all four different observed equipment states and missingness", () => {
    const encoded = data.map(v=>toModelVector(v,st,"D23_EQUIPMENT_ONEHOT_V2").vector.slice(0,4));
    expect(encoded).toEqual([
      [0,0,0,0],  // unchanged
      [1,0,0,0],  // added only
      [0,1,0,0],  // removed only
      [0,0,1,0],  // both (the old difference 0 LOST this)
      [0,0,0,1],  // unknown, never interpreted as no change
    ]);
  });
  it("requires new version of feature source and matching encoder", () => {
    expect(()=>toModelVector(fv(1,3),st)).toThrow("D23_V2_REQUIRES_CATEGORICAL_ENCODER");
    expect(()=>toModelVector(fv(1,3,0,false),st,"D23_EQUIPMENT_ONEHOT_V2"))
      .toThrow("D23_V2_REQUIRES_RECAPTURED_SOURCE");
    const bad = fv(1,0);
    bad.signals[0].rawValue = 4;
    expect(()=>toModelVector(bad,st,"D23_EQUIPMENT_ONEHOT_V2"))
      .toThrow("D23_EQUIPMENT_STATE_OUT_OF_RANGE");
  });
  it("fits, scores and explains with matching 6-dimensional encoder", () => {
    const raceA = [fv(1,0,0.5),fv(2,3,0.2),fv(3,2,-0.1)];
    const raceB = [fv(1,1,-0.2),fv(2,0,0.6),fv(3,null,0.1)];
    const trainingSet = [
      {raceId:"a",date:new Date("2026-08-16T12:00:00Z"),vectors:raceA,winnerNo:2},
      {raceId:"b",date:new Date("2026-08-17T12:00:00Z"),vectors:raceB,winnerNo:2},
    ];
    const model=fitModel(trainingSet,computeFeatureStats([...raceA,...raceB],CODES),
      {lambda:1,learningRate:0.05,iterations:20},"D23_EQUIPMENT_ONEHOT_V2");
    expect(model.featureEncoding).toBe("D23_EQUIPMENT_ONEHOT_V2");
    expect(model.beta).toHaveLength(6);
    const scored=scoreRace(raceA,model);
    expect(scored.map(x=>x.probability).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
    const explanation=explainRunner(raceA[1],model);
    expect(explanation.rows).toHaveLength(2);
    expect(explanation.totalScore).toBeCloseTo(scored[1].score,12);
    const old = {...model,featureEncoding:undefined} as FittedModel<(typeof CODES)[number]>;
    expect(()=>scoreRace(raceA,old)).toThrow("D23_V2_REQUIRES_CATEGORICAL_ENCODER");
  });
});
