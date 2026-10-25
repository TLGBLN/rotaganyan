import {describe,it,expect} from "vitest";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {buildWalkFolds,type FeatureRace} from "./combinatorial-signal-selection";
import {pairedPedigreeRca,RCA_SETUPS} from "./pedigree-paired-rca";

function races():FeatureRace[]{
  return Array.from({length:238},(_,i)=>{
    const raceId="rca-"+i;
    const tarih="2026-08-"+String(16+Math.floor(i*10/238)).padStart(2,"0");
    return {
      raceId,tarih,winnerNo:(i%4)+1,
      vectors:Array.from({length:4},(_,j):RunnerFeatureVector=>({
        raceId,no:j+1,name:"horse-"+j,tjkAtId:i*4+j,jockey:null,
        signals:UNIFIED_MODEL_CODES.map((code,k)=>({
          code,family:"RCA_TEST",rawValue:((i*5+j*3+k)%19)/19,
          observed:true,coverageState:null,asOfSafe:true,missingReason:null,
        })),
      })),
    };
  });
}
describe("RAN paired pedigree RCA — rescue + new misses without winner-based fitting",()=>{
  it("compares identical chronological races across all lineage variants, exactly accounts net TOP1 and TOP3",()=>{
    const folds=buildWalkFolds(races());
    const report=pairedPedigreeRca(folds,{lambda:90,learningRate:.25,iterations:5});
    expect(Object.keys(RCA_SETUPS)).toHaveLength(9);
    expect(report.comparisons).toHaveLength(8);
    expect(report.publicationGate).toBe("BLOCKED");
    expect(report.validationRaces).toBe(folds.reduce((n,f)=>n+f.validation.length,0));
    for(const comparison of report.comparisons){
      expect(comparison.n).toBe(report.validationRaces);
      expect(comparison.netTop1).toBe(comparison.rescuedTop1-comparison.newlyMissedTop1);
      expect(comparison.netTop3).toBe(comparison.rescuedTop3-comparison.newlyMissedTop3);
      expect(comparison.afterTop3).toBeGreaterThanOrEqual(comparison.afterTop1);
      expect(comparison.beforeTop3).toBeGreaterThanOrEqual(comparison.beforeTop1);
      for(const changed of comparison.cases){
        expect(changed.winnerNo).toBeGreaterThan(0);
        expect(changed.afterProbability).toBeGreaterThanOrEqual(0);
        expect(changed.afterProbability).toBeLessThanOrEqual(1);
      }
    }
  });
  it("rejects reuse of a validation race across folds",()=>{
    const f=buildWalkFolds(races());
    f[1].validation.push(f[1].validation[0]);
    expect(()=>pairedPedigreeRca(f,{lambda:90,learningRate:.25,iterations:5}))
      .toThrow("REPEATED_RACE");
  });
});
