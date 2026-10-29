import {describe,it,expect} from "vitest";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {
  D23_CODES,fitD23Market,scoreD23Market,prepareD23MarketRace,
  assertD23MarketModel,evaluateD23Market,d23ModelFingerprint,
  validateD23MarketArtifact,explainD23MarketRunner,type D23MarketRace,
} from "./d23-market-model";

const TS="2026-08-21T11:00:00+03:00";
const CUT="2026-08-21T11:30:00+03:00";
const START="2026-08-21T12:00:00+03:00";
function vector(raceId:string,no:number,speed:number,state:0|1|2|3):RunnerFeatureVector{
  return {raceId,no,name:"Horse "+no,tjkAtId:no,jockey:null,
    d23FormulaVersion:"D23_FORMULAS_V2",
    signals:D23_CODES.map(c=>({
      code:c,family:"TEST",observed:true,asOfSafe:true,coverageState:null,
      missingReason:null,rawValue:c==="EQUIPMENT_CHANGE"?state:c==="SPEED"?speed:0,
      ...(c==="EQUIPMENT_CHANGE"?{equipmentState:state}:{}),
    })),
  };
}
function race(id:string,day:string="2026-08-21",winner:number=3):D23MarketRace{
  const mapDate=(str:string)=>day+str.slice(10);
  return {raceId:id,tarih:day,winnerNo:winner,
    vectors:[vector(id,1,-1,0),vector(id,2,0,1),vector(id,3,2,3)],
    market:{pool:"AGF1",raceStartAt:mapDate(START),cutoffAt:mapDate(CUT),
      observations:[
        {no:1,agfPercent:60,capturedAt:mapDate(TS)},
        {no:2,agfPercent:30,capturedAt:mapDate(TS)},
        {no:3,agfPercent:10,capturedAt:mapDate(TS)},
      ]},
  };
}
describe("D23: 23 strength signals × time-frozen AGF, no hard favorite logic",()=>{
  it("requires atomic as-of market snapshot and rejects post-cutoff leakage",()=>{
    expect(prepareD23MarketRace(race("a")).logMarket).toHaveLength(3);
    const late=race("a");
    late.market.observations[1].capturedAt="2026-08-21T11:50:00+03:00";
    expect(()=>prepareD23MarketRace(late)).toThrow("D23_MARKET_POST_CUTOFF_LEAKAGE");
    const mixed=race("a");
    mixed.market.observations[1].capturedAt="2026-08-21T10:50:00+03:00";
    expect(()=>prepareD23MarketRace(mixed)).toThrow("D23_MARKET_NONATOMIC_SNAPSHOT");
    const missing=race("a"); missing.market.observations.pop();
    expect(()=>prepareD23MarketRace(missing)).toThrow("D23_MARKET_MISSING_SNAPSHOT_RUNNER");
  });
  it("learns 23 signals/48 encoder terms plus unconstrained AGF coefficient; no meta-layer",()=>{
    const r=[race("a"),race("b","2026-08-22"),race("c","2026-08-23")];
    const model=fitD23Market(r,{lambda:0.2,learningRate:0.02,iterations:120});
    expect(model.codes).toHaveLength(23);
    expect(model.names).toHaveLength(48);
    expect(model.strengthBeta).toHaveLength(48);
    expect(model.combinedBeta).toHaveLength(49);
    expect(model.version).toBe("D23_AGF_INTERSECTION_V1");
    expect(model.sourceStatus).toBe("RESEARCH_ONLY_PIT_UNVERIFIED");
    expect(()=>assertD23MarketModel(model)).not.toThrow();
    const pred=scoreD23Market(r[0],model);
    expect(pred.map(x=>x.winProbability).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
    expect(new Set(pred.map(x=>x.regime)).size).toBeGreaterThan(0);
    expect(pred.filter(x=>x.leadingCandidate)).toHaveLength(1);
    expect(evaluateD23Market(r,model).n).toBe(3);
    const explanation=explainD23MarketRunner(r[0],model,3);
    const avgLog=r[0].market.observations.map(x=>Math.log(x.agfPercent));
    const centered=avgLog[2]-avgLog.reduce((a,b)=>a+b,0)/3;
    const score=explanation.totalScore;
    expect(explanation.signalContributions).toHaveLength(23);
    expect(score).toBeCloseTo(explanation.marketContribution+
      explanation.signalContributions.reduce((a,b)=>a+b.contribution,0),12);
    expect(explanation.marketContribution).toBeCloseTo(centered*model.combinedBeta[0],10);
    const bundle={
      releaseStatus:"RESEARCH_ONLY_PIT_AND_INDEPENDENT_HOLDOUT_NOT_VERIFIED",
      model,modelFingerprint:d23ModelFingerprint(model)
    };
    expect(validateD23MarketArtifact(bundle)).toBe(model);
    expect(()=>validateD23MarketArtifact({...bundle,
      model:{...model,marketAlpha:model.marketAlpha+0.01}}))
      .toThrow("D23_MARKET_ARTIFACT_FINGERPRINT_MISMATCH");

    expect(()=>scoreD23Market(r[0],{...model,combinedBeta:[...model.combinedBeta.slice(1)]}))
      .toThrow("D23_MARKET_MODEL_DIMENSION_OR_VALUE_INVALID");
  });
  it("lets a strong low-AGF horse win Top1; surprise label does not promote its rank",()=>{
    const r=race("a");
    const model=fitD23Market([r,race("b","2026-08-22")],
      {lambda:0.2,learningRate:0.03,iterations:80});
    const speedIndex=model.names.indexOf("SPEED_z");
    expect(speedIndex).toBeGreaterThan(0);
    const combined=Array(49).fill(0);
    combined[0]=0; // Market provides NO hard favorite protection
    combined[1+speedIndex]=3;
    const strength=Array(48).fill(0);
    strength[speedIndex]=3;
    const candidate={...model,marketAlpha:1,combinedBeta:combined,strengthBeta:strength};
    const scored=scoreD23Market(r,candidate);
    expect(scored[0].no).toBe(3); // 10% AGF beats the 60% AGF favorite
    expect(scored[0].agfPercent).toBe(10);
    expect(scored[0].leadingCandidate).toBe(true);
    expect(scored[0].regime).toBe("SURPRIZ_ADAYI");
    expect(scored[0].winProbability).toBeGreaterThan(scored[0].marketProbability);
    // Changing only explanation (market-only alpha) cannot force final ranks to change.
    const noMarketFit=scoreD23Market(r,{...candidate,marketAlpha:0});
    expect(noMarketFit.map(x=>x.no)).toEqual(scored.map(x=>x.no));
    // Every horse remains ranked solely by the learned combined score.
    expect(scored.map(x=>x.rank)).toEqual([1,2,3]);
  });
  it("blocks stale 46-coefficient source and mismatched model encoding",()=>{
    const r=race("a");
    delete r.vectors[0].d23FormulaVersion;
    expect(()=>prepareD23MarketRace(r)).toThrow("D23_MARKET_VECTOR_SOURCE_MISMATCH");
    const r2=race("b");
    const model=fitD23Market([r2,race("c","2026-08-22")],
      {lambda:0.1,learningRate:0.03,iterations:10});
    expect(()=>assertD23MarketModel({...model,encoding:"LEGACY_Z_MISSING" as never}))
      .toThrow("D23_MARKET_MODEL_VERSION_INVALID");
  });
  it("expresses all four regimes without changing learned probability order",()=>{
    const r=race("four");
    r.vectors=[
      vector("four",1,2,0),vector("four",2,1,0),
      vector("four",3,0,0),vector("four",4,-2,0),
    ];
    r.market.observations=[
      {no:1,agfPercent:35,capturedAt:TS},
      {no:2,agfPercent:10,capturedAt:TS},
      {no:3,agfPercent:40,capturedAt:TS},
      {no:4,agfPercent:15,capturedAt:TS},
    ];
    const r2={...r,raceId:"four-two",vectors:r.vectors.map(v=>({...v,raceId:"four-two"}))};
    const model=fitD23Market([r,r2],
      {lambda:0.2,learningRate:0.02,iterations:10});
    const idx=model.names.indexOf("SPEED_z");
    const beta=Array(48).fill(0);
    beta[idx]=0.6;
    const final=Array(49).fill(0);
    final[1+idx]=0.6;
    const m={...model,strengthBeta:beta,marketAlpha:1,combinedBeta:final};
    const rows=scoreD23Market(r,m);
    const byNo=new Map(rows.map(x=>[x.no,x]));
    expect(byNo.get(1)?.regime).toBe("BANKO_POTANSIYELI");
    expect(byNo.get(2)?.regime).toBe("SURPRIZ_ADAYI");
    expect(byNo.get(3)?.regime).toBe("PIYASA_FAZLA_DESTEKLIYOR");
    expect(byNo.get(4)?.regime).toBe("NORMAL");
    const adjusted=scoreD23Market(r,{...m,combinedBeta:[10,...Array(48).fill(0)]});
    expect(new Map(adjusted.map(x=>[x.no,x.regime]))).toEqual(
      new Map(rows.map(x=>[x.no,x.regime])));
    expect(adjusted.find(x=>x.rank===1)?.no).toBe(3); // final score changes legitimately
  });
});
