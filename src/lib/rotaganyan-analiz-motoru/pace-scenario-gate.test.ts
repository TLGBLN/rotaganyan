import { describe, expect, it } from "vitest";
import { calculatePaceScenario } from "./pace-scenario";

const leader = [0.6,0.1,0.1,0.1,0.05,0.05];
const closer = [0.1,0.1,0.1,0.1,0.2,0.4];
describe("D23 tactical tempo — gate gaps / coverage / as-of inputs", () => {
  it("does not treat a valid gate above active field count as missing", () => {
    const result=calculatePaceScenario([
      {no:1,name:"A",startNo:1,style:leader},
      {no:2,name:"B",startNo:3,style:closer},
    ]);
    expect(result.observedDraws).toBe(2);
    expect(result.horses.map(x=>x.drawFraction)).toEqual([0,1]);
    expect(result.horses[1].signals.find(s=>s.code==="PACE_DRAW_LEAD_PRESS")?.observed).toBe(true);
  });
  it("keeps insufficient observed gate evidence as missing (not fabricated zero)", () => {
    const result=calculatePaceScenario([
      {no:1,name:"A",startNo:4,style:leader},
      {no:2,name:"B",startNo:null,style:closer},
    ]);
    expect(result.observedDraws).toBe(1);
    const s=result.horses[0].signals.find(s=>s.code==="PACE_DRAW_LEAD_PRESS");
    expect(s?.observed).toBe(false);
    expect(s?.rawValue).toBeNull();
  });
  it("rejects duplicated gates instead of inventing distinct draw positions", () => {
    expect(()=>calculatePaceScenario([
      {no:1,name:"A",startNo:2,style:leader},
      {no:2,name:"B",startNo:2,style:closer},
    ])).toThrow("PACE_DUPLICATE_START_GATE");
  });
  it("does not infer unobserved rivals as if they were known", () => {
    const r=calculatePaceScenario([
      {no:1,name:"A",startNo:1,style:leader},
      {no:2,name:"B",startNo:3,style:null},
      {no:3,name:"C",startNo:4,style:closer},
    ]);
    expect(r.observedStyles).toBe(2);
    expect(r.horses[0].rivalsObserved).toBe(1);
    expect(r.limitations.some(x=>x.includes("Missing style information"))).toBe(true);
  });
});
