import {describe,it,expect} from "vitest";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {validateTrainingOnly,type FeatureRace} from "./combinatorial-signal-selection";
import {PEDIGREE_CODES,PEDIGREE_SUBSETS,PEDIGREE_CONTEXTS,
  pedigreeCoverage,auditPedigreeLineages} from "./pedigree-lineage-audit";

function train():FeatureRace[]{
  return Array.from({length:238},(_,i)=>{
    const raceId="pedigree-"+i;
    const tarih="2026-08-"+String(16+Math.floor(i*10/238)).padStart(2,"0");
    return {raceId,tarih,winnerNo:1+(i%4),vectors:Array.from({length:4},(_,j):RunnerFeatureVector=>({
      raceId,no:j+1,name:"horse-"+j,tjkAtId:i*4+j,jockey:null,
      signals:UNIFIED_MODEL_CODES.map((code,k)=>({
        code,family:"TEST",
        observed:!(code==="DAM_HISTORY"&&i%3!==0),
        rawValue:code==="DAM_HISTORY"?
          (i%3===0?(j%2===0?100:0):null):
          ((i*3+j+k)%13)/13,
        asOfSafe:true,coverageState:null,missingReason:null,
      })),
    }))};
  });
}
describe("RAN separate SIRE + DAM + DAMSIRE PIT lineage ablation",()=>{
  it("enumerates all 2^3 = 8 pedigree combinations without merging lineage identity",()=>{
    expect(PEDIGREE_CODES).toEqual(["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"]);
    expect(PEDIGREE_SUBSETS).toHaveLength(8);
    expect(new Set(PEDIGREE_SUBSETS.map(x=>x.join("+"))).size).toBe(8);
    expect(Object.keys(PEDIGREE_CONTEXTS)).toHaveLength(4);
    expect(PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE).toHaveLength(33);
  });
  it("treats raw 100% dam as unsupported by count, NOT automatically a reliable genetic win",()=>{
    const source=train();
    validateTrainingOnly(source);
    const coverage=pedigreeCoverage(source);
    const dam=coverage.find(x=>x.code==="DAM_HISTORY")!;
    expect(dam.rawHundredCount).toBeGreaterThan(0);
    expect(dam.rawZeroCount).toBeGreaterThan(0);
    expect(dam.observedFraction).toBeLessThan(0.35);
    expect(dam.countOfHistoricalStartsAvailableInVector).toBe(false);
    expect(dam.caveat).toContain("one start");
  });
  it("separates raw 100% lineage evidence from sparse-one-start reliability once PIT start-count metadata exists",()=>{
    const a=train();
    const dam=a[0].vectors[0].signals.find(s=>s.code==="DAM_HISTORY")!;
    expect(dam.rawValue).toBe(100);
    dam.sampleCount=1;
    const sire=a[0].vectors[0].signals.find(s=>s.code==="SIRE_HISTORY")!;
    sire.sampleCount=30;
    const c=pedigreeCoverage(a);
    const damC=c.find(x=>x.code==="DAM_HISTORY")!;
    const sireC=c.find(x=>x.code==="SIRE_HISTORY")!;
    expect(damC.documentedStartSamples).toBe(1);
    expect(damC.observedWithAtMost2Starts).toBe(1);
    expect(damC.minHistoricalStarts).toBe(1);
    expect(damC.countOfHistoricalStartsAvailableInVector).toBe(false);
    expect(sireC.documentedStartSamples).toBe(1);
    expect(sireC.minHistoricalStarts).toBe(30);
    expect(sireC.observedWithAtMost2Starts).toBe(0);
  });
  it("fits 8 hereditary subsets across 4 contexts on chronological folds, no known future dev",()=>{
    const report=auditPedigreeLineages(train(),5);
    expect(report.publicationGate).toBe("BLOCKED");
    expect(report.experiments).toHaveLength(32);
    expect(report.grouped).toHaveLength(4);
    expect(report.confidenceHasSampleCounts).toBe(false);
    for(const g of report.grouped){
      expect(g.noPedigree.n).toBe(g.allThree.n);
      expect(g.allThree.codes).toEqual(expect.arrayContaining([...PEDIGREE_CODES]));
      expect(g.noPedigree.codes.some(x=>PEDIGREE_CODES.includes(x as (typeof PEDIGREE_CODES)[number]))).toBe(false);
    }
    expect(report.warnings.join(" ")).toContain("sample");
  });
});
