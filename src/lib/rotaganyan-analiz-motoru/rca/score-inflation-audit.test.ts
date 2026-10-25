import {describe,it,expect} from "vitest";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {buildWalkFolds, type FeatureRace} from "./combinatorial-signal-selection";
import {auditScoreInflation} from "./score-inflation-audit";
function races(extreme=false):FeatureRace[]{
  return Array.from({length:238},(_,i)=>{
    const raceId="score-check-"+i;
    const d="2026-08-"+String(16+Math.floor(i*10/238)).padStart(2,"0");
    return {raceId,tarih:d,winnerNo:(i%4)+1,vectors:Array.from({length:4},(_,j):RunnerFeatureVector=>({
      raceId,no:j+1,name:"horse-"+j,tjkAtId:null,jockey:null,
      signals:UNIFIED_MODEL_CODES.map((code,k)=>({
        code,family:"TEST",observed:true,
        rawValue:extreme&&i===237&&k===0&&j===0?1e5:(i+j+k)%5,
        asOfSafe:true,coverageState:null,missingReason:null,
      })),
    }))};
  });
}
describe("RAN score inflation diagnostics — no artificial high scores",()=>{
  it("reports normalized odds but ALSO top1 calibration gaps, false confidence and Brier",()=>{
    const folds=buildWalkFolds(races());
    const report=auditScoreInflation(folds,[UNIFIED_MODEL_CODES[0]],{lambda:90,learningRate:.25,iterations:5});
    expect(report.status).toBe("RESEARCH_DIAGNOSTIC_ONLY");
    expect(report.publicationGate).toBe("BLOCKED");
    expect(report.nRaces).toBeGreaterThanOrEqual(50);
    expect(report.bins.reduce((n,b)=>n+b.n,0)).toBe(report.nRaces);
    expect(report.meanFavouriteProbability).toBeGreaterThanOrEqual(0.25);
    expect(report.meanFavouriteProbability).toBeLessThanOrEqual(1);
    expect(report.ece).toBeGreaterThanOrEqual(0);
    expect(report.ece).toBeLessThanOrEqual(1);
    expect(report.multiClassBrierMean).toBeGreaterThanOrEqual(0);
    expect(report.highConfidence90.incorrect).toBeLessThanOrEqual(report.highConfidence90.races);
    expect(report.extremeRawZ.observed).toBe(report.nRaces*4);
  });
  it("detects extreme out-of-training-distribution values instead of mistaking softmax 100% for evidence",()=>{
    const report=auditScoreInflation(buildWalkFolds(races(true)),[UNIFIED_MODEL_CODES[0]],
      {lambda:90,learningRate:.25,iterations:5});
    expect(report.extremeRawZ.absZAbove4).toBeGreaterThanOrEqual(1);
    expect(report.extremeRawZ.maxAbsZ).toBeGreaterThan(1000);
    expect(report.warnings.some(x=>x.includes("UNBOUNDED_MAIN_Z"))).toBe(true);
  });
});
