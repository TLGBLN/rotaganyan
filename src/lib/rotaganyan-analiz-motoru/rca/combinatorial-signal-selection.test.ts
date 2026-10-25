import {describe,it,expect} from "vitest";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";
import {
  allPairs,buildWalkFolds,validateTrainingOnly,evaluateCombination,evaluatePairInteraction,
  classifyPair,sourceAlternativeLimitations,selectionKey,candidateObjective,
  type FeatureRace,type CombinationResult,
} from "./combinatorial-signal-selection";

function data(n=238):FeatureRace[] {
  return Array.from({length:n},(_,i)=>{
    const d=16+Math.floor(i*10/n);
    const date="2026-08-"+String(d).padStart(2,"0");
    const raceId="ran-"+i;
    const winnerNo=1+(i%4);
    return {
      raceId,tarih:date,winnerNo,
      vectors:Array.from({length:4},(_,j):RunnerFeatureVector=>({
        raceId,no:j+1,name:"At"+j,tjkAtId:null,jockey:null,
        signals:UNIFIED_MODEL_CODES.map((code,k)=>({
          code,family:"TEST",rawValue:((i+j*3+k*7)%13)/13,
          observed:true,coverageState:null,asOfSafe:true,missingReason:null,
        })),
      })),
    };
  });
}
function result(codes:string[],t1:number,t3:number,loss:number):CombinationResult {
  const n=90;
  const foldResults=[0,1,2].map(i=>({
    fold:"F"+i,n:30,top1Hits:Math.floor(t1/3)+(i<t1%3?1:0),
    top3Hits:Math.floor(t3/3)+(i<t3%3?1:0),logLossSum:loss*30,
  }));
  return {id:selectionKey(codes),codes,foldResults,
    n,top1Hits:t1,top3Hits:t3,top1:t1/n,top3:t3/n,logLoss:loss,
    score:candidateObjective({n,top1Hits:t1,top3Hits:t3,logLoss:loss},codes.length)};
}
describe("RAN v1.0 ALL signal combinations — chronological research only",()=>{
  it("enumerates ALL 630 unordered pairs of the same 36 code registry, no duplicates",()=>{
    const pairs=allPairs(UNIFIED_MODEL_CODES);
    expect(UNIFIED_MODEL_CODES).toHaveLength(36);
    expect(pairs).toHaveLength(630);
    expect(new Set(pairs.map(p=>selectionKey(p)) ).size).toBe(630);
  });
  it("strictly guards exactly 238 original Aug 16..25 training races",()=>{
    const a=data();
    expect(()=>validateTrainingOnly(a)).not.toThrow();
    expect(()=>validateTrainingOnly(a.concat(data(1)))).toThrow("238");
    a[0].tarih="2026-08-26";
    expect(()=>validateTrainingOnly(a)).toThrow("INVALID_TRAIN_RACE");
  });
  it("makes exactly three expanding chronological folds and no validation race can enter its preceding train",()=>{
    const r=data();
    const folds=buildWalkFolds(r);
    expect(folds).toHaveLength(3);
    for(const fold of folds){
      expect(fold.train.length).toBeGreaterThan(35);
      expect(fold.validation.length).toBeGreaterThanOrEqual(8);
      expect(Math.max(...fold.train.map(x=>Date.parse(x.tarih)))).toBeLessThan(
        Math.min(...fold.validation.map(x=>Date.parse(x.tarih))));
      const trainIds=new Set(fold.train.map(x=>x.raceId));
      expect(fold.validation.every(x=>!trainIds.has(x.raceId))).toBe(true);
    }
  });
  it("trains and evaluates both singleton and pair only within chronological train folds, without DATABASE_URL",()=>{
    const f=buildWalkFolds(data());
    const a=evaluateCombination(f,[UNIFIED_MODEL_CODES[0]],{lambda:90,learningRate:0.25,iterations:5});
    const b=evaluateCombination(f,[UNIFIED_MODEL_CODES[0],UNIFIED_MODEL_CODES[1]],{lambda:90,learningRate:0.25,iterations:5});
    expect(a.n).toBe(b.n);
    expect(a.n).toBeGreaterThan(25);
    expect(a.foldResults).toHaveLength(3);
    expect(b.foldResults.map(x=>x.fold)).toEqual(a.foldResults.map(x=>x.fold));
    expect(a.top3Hits).toBeGreaterThanOrEqual(a.top1Hits);
    expect(b.logLoss).toBeGreaterThan(0);
    expect(b.codes).toHaveLength(2);
  });
  it("measures an actual multiplicative interaction separately from the additive two-feature fit",()=>{
    const folds=buildWalkFolds(data());
    const a=UNIFIED_MODEL_CODES[0],b=UNIFIED_MODEL_CODES[1];
    const opts={lambda:90,learningRate:.25,iterations:5};
    const regular=evaluateCombination(folds,[a,b],opts);
    const interaction=evaluatePairInteraction(folds,a,b,opts);
    expect(interaction.id).toBe("INT:"+selectionKey([a,b]));
    expect(interaction.codes).toHaveLength(3);
    expect(interaction.codes[2]).toContain("INTERACTION__");
    expect(interaction.n).toBe(regular.n);
    expect(interaction.foldResults.map(x=>x.fold))
      .toEqual(regular.foldResults.map(x=>x.fold));
    expect(interaction.logLoss).toBeGreaterThan(0);
  });
  it("marks a weaker overlapping signal redundant ONLY after joint vs stronger alone",()=>{
    const a=UNIFIED_MODEL_CODES[0],b=UNIFIED_MODEL_CODES[1];
    const first=result([a],23,52,1.85),second=result([b],19,45,2.04);
    const joint=result([a,b],23,52,1.851);
    const pair=classifyPair(joint,first,second,true,"shared underlying field");
    expect(pair.stronger).toBe(a);
    expect(pair.weaker).toBe(b);
    expect(pair.status).toBe("REDUNDANT_CANDIDATE");
    expect(pair.bothVersusBest.top3Hits).toBe(0);
    expect(pair.sourceAlternativeNote).toBeTruthy();
  });
  it("recognizes complementary signal pairs EVEN when correlated, but refuses trade-offs",()=>{
    const a=UNIFIED_MODEL_CODES[0],b=UNIFIED_MODEL_CODES[1];
    const first=result([a],20,48,1.9),second=result([b],18,44,1.95);
    const both=result([a,b],23,51,1.87);
    expect(classifyPair(both,first,second,true).status).toBe("COMPLEMENTARY_CANDIDATE");
    const bad=result([a,b],24,40,1.7);
    expect(classifyPair(bad,first,second,true).status).toBe("TRADEOFF_REVIEW");
  });
  it("does not falsely claim BLOCKED or ALTERNATIVE source formulas tested from 36-column JSON",()=>{
    const s=sourceAlternativeLimitations();
    expect(s.testedCanonicalCount).toBe(36);
    expect(s.unavailable.some(x=>x.sourceCode==="GEN_SIRE_01")).toBe(true);
    expect(s.unavailable.some(x=>x.sourceCode==="GEN_SIRE_PMZ_01")).toBe(true);
    expect(s.unavailable.every(x=>!x.availableInPITDataset)).toBe(true);
  });
});
