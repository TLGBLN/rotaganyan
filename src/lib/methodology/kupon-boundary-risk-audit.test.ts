import { describe, it, expect } from "vitest";
import type { LegProbability } from "./kupon-optimizer";
import { auditKuponBoundary } from "./kupon-boundary-risk-audit";

const legs:LegProbability[] = [
  {raceNo:1,runners:[
    {no:3,olasilik:.45},{no:6,olasilik:.33},{no:10,olasilik:.22},
  ]},
  {raceNo:2,runners:[
    {no:4,olasilik:.50},{no:3,olasilik:.30},{no:5,olasilik:.20},
  ]},
  ...[3,4,5,6].map(raceNo=>({
    raceNo,runners:[{no:1,olasilik:1}],
  })),
];
describe("Adana-style normal-only boundary audit (SHADOW, never winner-driven)",()=>{
  it("recognizes TWO immediately adjacent normal-only candidates in separate legs",()=>{
    const result=auditKuponBoundary(legs,4,9);
    expect(result.baseline.secimler[1]).toEqual([3,6]);
    expect(result.baseline.secimler[2]).toEqual([4,3]);
    expect(result.expanded.secimler[1]).toEqual([3,6,10]);
    expect(result.expanded.secimler[2]).toEqual([4,3,5]);
    expect(result.normalOnly).toEqual([{raceNo:1,no:10},{raceNo:2,no:5}]);
    expect(result.selectionGate).toBe("NOT_VERIFIED");
  });
  it("can force both near-boundary candidates ONLY by removing other choices at same budget",()=>{
    const result=auditKuponBoundary(legs,4,9);
    const insured=result.proposals.find(p=>p.forcedBoundary.length===2);
    expect(insured).toBeDefined();
    expect(insured!.result.secimler[1]).toContain(10);
    expect(insured!.result.secimler[2]).toContain(5);
    expect(insured!.result.toplamKombinasyon).toBeLessThanOrEqual(4);
    expect(insured!.changes.reduce((n,x)=>n+x.removed.length,0)).toBeGreaterThanOrEqual(1);
    expect(insured!.modeledCoverageDelta).toBeLessThanOrEqual(1e-10);
    expect(insured!.actuallyAddsAll).toBe(true);
  });
  it("never creates a proposal that exceeds budget, even with user force includes",()=>{
    const r=auditKuponBoundary(legs,1,9);
    for(const p of r.proposals)expect(p.result.toplamKombinasyon).toBeLessThanOrEqual(1);
  });
  it("rejects impossible budget and invalid probabilities",()=>{
    expect(()=>auditKuponBoundary(legs,9,4)).toThrow("INVALID_INPUT");
    expect(()=>auditKuponBoundary([{...legs[0],runners:[{no:1,olasilik:NaN}]},...legs.slice(1)],4,9))
      .toThrow("INVALID_LEG");
  });
  it("does not insert results/winnerNo or change production selections",()=>{
    const input=JSON.stringify(legs);
    const result=auditKuponBoundary(legs,4,9);
    expect(JSON.stringify(legs)).toBe(input);
    expect(JSON.stringify(result)).not.toContain("winnerNo");
    expect(result.diagnosticOnly).toBe(true);
    expect(result.warning).toContain("hindsight");
  });
});
