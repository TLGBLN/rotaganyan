import {describe,it,expect} from "vitest";
import {LINEAGES,adjustLineage} from "../pedigree-v2/lineage-score";
import {adjustWeightedLineage,replaceWeightedThreeLineages,
  assertWeightedPedigreeVectors,PEDIGREE_V3_VERSION}
  from "./lineage-weighted";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
const source=()=>({
  code:"SIRE_HISTORY" as const,
  ancestorName:"SIRE A",targetId:100,
  progeny:[
    {tjkAtId:101,starts:50,wins:45},
    {tjkAtId:102,starts:2,wins:0},
    {tjkAtId:103,starts:2,wins:0},
  ],
});
describe("RAN V3 balanced 3-lineage evidence (not individual-signal predictor)",()=>{
  it("limits prolific foal BOTH in mean success and reliability; V2 allowed excessive domination",()=>{
    const old=adjustLineage(source()),corrected=adjustWeightedLineage(source());
    expect(corrected.starts).toBe(54);
    expect(corrected.wins).toBe(45);
    expect(corrected.distinctFoals).toBe(3);
    expect(corrected.effectiveStarts).toBe(7);
    expect(corrected.rawWinPct).toBeCloseTo(100*45/54,8);
    expect(corrected.balancedWinPct).toBeCloseTo(100*(3*45/50)/7,8);
    expect(corrected.adjustedPct!).toBeLessThan(old.adjustedPct!);
  });
  it("requires all three lines and explicit V3 source stamp, keeps non-pedigree fixed",()=>{
    const base:RunnerFeatureVector={
      raceId:"X",no:1,name:"AT",tjkAtId:100,jockey:null,
      signals:[
        ...LINEAGES.map(l=>({code:l.code,family:"GEN",observed:true,
          rawValue:100,coverageState:null,asOfSafe:true as const,missingReason:null})),
        {code:"SPEED",family:"HIZ",rawValue:0.56,observed:true,
          coverageState:null,asOfSafe:true,missingReason:null},
      ],
    };
    const l=LINEAGES.map(x=>adjustWeightedLineage({
      ...source(),code:x.code,ancestorName:x.code,
    }));
    const v=replaceWeightedThreeLineages(base,l);
    expect(v.pedigreeScoringVersion).toBe(PEDIGREE_V3_VERSION);
    expect(v.signals.find(s=>s.code==="SPEED")).toEqual(base.signals.find(s=>s.code==="SPEED"));
    expect(v.signals.every((s,i)=>s.code===base.signals[i].code)).toBe(true);
    expect(()=>assertWeightedPedigreeVectors([v])).not.toThrow();
    const old=LINEAGES.map(x=>adjustLineage({...source(),code:x.code}));
    expect(()=>replaceWeightedThreeLineages(base,old)).toThrow("UNWEIGHTED");
    expect(()=>assertWeightedPedigreeVectors([base])).toThrow("INVALID_LINEAGES");
  });
  it("never derives a strong negative or positive pedigree from an unknown ancestor",()=>{
    const v=adjustWeightedLineage({code:"DAM_HISTORY",ancestorName:null,
      targetId:100,progeny:[]});
    expect(v.observed).toBe(false);
    expect(v.adjustedPct).toBeNull();
    expect(v.balancedWinPct).toBeNull();
  });
});
