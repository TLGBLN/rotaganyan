import { describe,it,expect } from "vitest";
import { smoothD23Pedigree } from "./d23-feature-capture";
import type { RunnerFeatureVector, SignalEntry } from "@/lib/motor-v1/engine/feature-vector";
function make(code:string, rawValue:number|null, observed=true, sampleCount:number|null=10):SignalEntry {
  return {code, family:"GEN",rawValue,observed,asOfSafe:true,
    sampleCount,coverageState:null,missingReason:null};
}
function fv(signals:SignalEntry[]):RunnerFeatureVector {
  return {raceId:"race",no:1,name:"AT",jockey:null,tjkAtId:null,signals};
}
describe("D23 common feature-source parity contract",()=>{
  it("applies the SAME fixed dam/damsire n-smoothed transformation",()=>{
    const x=fv([make("DAM_HISTORY",20,true,10),
      make("DAMSIRE_HISTORY",40,true,5),make("SPEED",1.2)]);
    const out=smoothD23Pedigree(x);
    expect(out.signals[0].rawValue).toBeCloseTo((2+2.8)/30,12);
    expect(out.signals[1].rawValue).toBeCloseTo((2+2.8)/25,12);
    expect(out.signals[2].rawValue).toBe(1.2);
    expect(x.signals[0].rawValue).toBe(20); // no in-place mutation
  });
  it("does not invent pedigree values when missing",()=>{
    const out=smoothD23Pedigree(fv([make("DAM_HISTORY",null,false,null)]));
    expect(out.signals[0].rawValue).toBeNull();
    expect(out.signals[0].observed).toBe(false);
  });
  it("rejects pretending an observed pedigree has valid sample count",()=>{
    expect(()=>smoothD23Pedigree(fv([make("DAM_HISTORY",10,true,null)])))
      .toThrow("D23_PEDIGREE_PIT_SAMPLE_REQUIRED");
  });
  it("rejects invalid unbounded pedigree rate",()=>{
    expect(()=>smoothD23Pedigree(fv([make("DAMSIRE_HISTORY",101,true,12)])))
      .toThrow("D23_PEDIGREE_PIT_SAMPLE_REQUIRED");
  });
});
