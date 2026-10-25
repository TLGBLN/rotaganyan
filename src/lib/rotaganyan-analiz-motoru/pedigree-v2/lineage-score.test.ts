import {describe,it,expect} from "vitest";
import {
  PEDIGREE_V2_VERSION,LINEAGES,adjustLineage,replaceThreeLineages,
  assertPedigreeVersionAndProvenance,
} from "./lineage-score";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
function example():RunnerFeatureVector {
  return {raceId:"race1",no:4,name:"H1",tjkAtId:10,jockey:null,
    signals:LINEAGES.map(l=>({code:l.code,family:"GEN",rawValue:99,
      observed:true,coverageState:null,asOfSafe:true as const,missingReason:null}))};
}
function lineage(code:(typeof LINEAGES)[number]["code"],targetId=10,foals=1,starts=20,wins=10){
  return adjustLineage({code,targetId,ancestorName:"SAMPLE",
    progeny:Array.from({length:foals},(_,j)=>({tjkAtId:11+j,starts,wins}))});
}
describe("RAN pedigree v2 — every horse, every sire/dam/damsire",()=>{
  it("counts DISTINCT foals and limits evidence of one foal with 50 races",()=>{
    const few=adjustLineage({code:"SIRE_HISTORY",ancestorName:"A",targetId:10,
      progeny:[{tjkAtId:11,starts:50,wins:25}]});
    const many=adjustLineage({code:"SIRE_HISTORY",ancestorName:"A",targetId:10,
      progeny:Array.from({length:10},(_,i)=>({tjkAtId:i+11,starts:5,wins:2+i%2}))});
    expect(few.distinctFoals).toBe(1);
    expect(few.effectiveStarts).toBe(3);
    expect(many.distinctFoals).toBe(10);
    expect(many.effectiveStarts).toBe(30);
    expect(many.confidence).toBeGreaterThan(few.confidence!);
  });
  it("a one-start 100% dam does NOT carry 100 score or 100% win chance",()=>{
    const a=adjustLineage({code:"DAM_HISTORY",ancestorName:"D",targetId:10,
      progeny:[{tjkAtId:18,starts:1,wins:1}]});
    expect(a.rawWinPct).toBe(100);
    expect(a.adjustedPct).toBeGreaterThan(14);
    expect(a.adjustedPct).toBeLessThan(19);
    expect(a.confidence).toBeCloseTo(1/21);
  });
  it("no fabricated genetic score without ancestry name, result evidence, or known target horse ID",()=>{
    const empty=adjustLineage({code:"SIRE_HISTORY",ancestorName:null,targetId:10,progeny:[]});
    const unknown=adjustLineage({code:"DAM_HISTORY",ancestorName:"M",targetId:null,
      progeny:[{tjkAtId:90,starts:5,wins:5}]});
    const noSiblings=adjustLineage({code:"DAMSIRE_HISTORY",ancestorName:"MS",targetId:10,
      progeny:[{tjkAtId:10,starts:100,wins:100}]});
    for(const x of [empty,unknown,noSiblings]){
      expect(x.adjustedPct).toBeNull();
      expect(x.observed).toBe(false);
      expect(x.confidence).toBeNull();
    }
    expect(unknown.missingReason).toContain("CANNOT_EXCLUDE");
  });
  it("changes only the THREE distinct lineage inputs and retains other model evidence intact",()=>{
    const v=example();
    v.signals.push({code:"SPEED",family:"HIZ",rawValue:0.52,observed:true,
      coverageState:null,asOfSafe:true,missingReason:null});
    const lines=LINEAGES.map(l=>lineage(l.code));
    const updated=replaceThreeLineages(v,lines);
    expect(updated.signals.map(x=>x.code)).toEqual(v.signals.map(x=>x.code));
    expect(updated.signals.find(x=>x.code==="SPEED"))
      .toEqual(v.signals.find(x=>x.code==="SPEED"));
    expect(updated.signals.slice(0,3).every(s=>s.sampleCount===20)).toBe(true);
    expect(updated.signals.slice(0,3).every(s=>s.rawValue!<99)).toBe(true);
    expect(v.signals[0].rawValue).toBe(99);
    expect(()=>assertPedigreeVersionAndProvenance("RAN_36_LEGACY",[updated]))
      .toThrow("FINGERPRINT_MISMATCH");
    expect(()=>assertPedigreeVersionAndProvenance(PEDIGREE_V2_VERSION,[updated]))
      .not.toThrow();
  });
  it("rejects duplicated or absent lines, preventing one pedigree from being silently forgotten",()=>{
    const v=example();
    expect(()=>replaceThreeLineages(v,LINEAGES.slice(0,2).map(l=>lineage(l.code))))
      .toThrow("MUST_EXAMINE_EVERY_HORSE");
    const duplicate={...v,signals:v.signals.slice(1)};
    expect(()=>replaceThreeLineages(duplicate,LINEAGES.map(l=>lineage(l.code))))
      .toThrow("MUST_EXAMINE_EVERY_HORSE");
  });
});
