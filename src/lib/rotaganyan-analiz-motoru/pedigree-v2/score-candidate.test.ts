import {describe,it,expect} from "vitest";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {PEDIGREE_V2_VERSION,LINEAGES} from "./lineage-score";
import {scorePedigreeV2Candidates,type PedigreeV2Artifact} from "./score-candidate";
const artifact=():PedigreeV2Artifact=>({
  engineVersion:PEDIGREE_V2_VERSION,publicationGate:"BLOCKED",
  sourceDatasetSHA256:"a".repeat(64),nTrainRaces:238,nHoldoutRaces:62,
  opts:{lambda:90,learningRate:0.25,iterations:2500},
  model:{beta:Array(72).fill(0),names:Array.from({length:72},(_,i)=>"feature"+i),
    stats:UNIFIED_MODEL_CODES.map(c=>[c,{mu:0,sigma:1,nObserved:238}]),
    nRacesUsed:238,nRacesSkipped:0},
});
const vectors=():RunnerFeatureVector[]=>[1,2,3].map(no=>({
  raceId:"RACE",no,name:"horse "+no,tjkAtId:no,jockey:null,
  pedigreeScoringVersion:PEDIGREE_V2_VERSION,
  signals:UNIFIED_MODEL_CODES.map(code=>({
    code,family:"PIT",rawValue:14,observed:true,coverageState:null,
    asOfSafe:true,missingReason:null,
    sampleCount:LINEAGES.some(x=>x.code===code)?5:null,
  })),
}));
describe("RAN-PED-v2 scorer: fail-closed model/source version matching",()=>{
  it("scores only matching 72-beta separately trained candidate, probabilities sum 1",()=>{
    const result=scorePedigreeV2Candidates(vectors(),artifact());
    expect(result.engineVersion).toBe(PEDIGREE_V2_VERSION);
    expect(result.publicationGate).toBe("BLOCKED");
    expect(result.ranked).toHaveLength(3);
    expect(result.ranked.reduce((a,b)=>a+b.probability,0)).toBeCloseTo(1);
    expect(result.ranked.every(x=>Number.isFinite(x.score))).toBe(true);
  });
  it("rejects canonical old weights despite same 36 signal names",()=>{
    const old=artifact();old.engineVersion="RAN_36_LEGACY";
    expect(()=>scorePedigreeV2Candidates(vectors(),old)).toThrow("INVALID_VERSIONED_MODEL");
  });
  it("rejects legacy vectors with original three raw percentages, even if they have sample metadata",()=>{
    const legacy=vectors();delete legacy[0].pedigreeScoringVersion;
    expect(()=>scorePedigreeV2Candidates(legacy,artifact())).toThrow("INPUT_VERSION_MISMATCH");
  });
  it("rejects 1, 2, or 3 lines without PIT count and missing input evidence",()=>{
    const v=vectors();delete v[0].signals.find(s=>s.code==="DAM_HISTORY")!.sampleCount;
    expect(()=>scorePedigreeV2Candidates(v,artifact())).toThrow("UNTRUSTED_LINEAGE");
  });
});
