import {describe,it,expect} from "vitest";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {basketNeighbours,basketParetoFront,chooseBasketFromConfirmation,
  createDiverseBasketSeeds,canonicalBasket,DEFAULT_BASKET_SEARCH,sourceBlindWinnerSelection}
  from "./basket-search";
import {candidateObjective,selectionKey,type CombinationResult}
  from "./combinatorial-signal-selection";
const c=UNIFIED_MODEL_CODES;
function result(codes:string[],t1:number,t3:number,ll:number):CombinationResult{
  const n=145;
  return {id:selectionKey(codes),codes,n,
    top1Hits:t1,top3Hits:t3,top1:t1/n,top3:t3/n,
    logLoss:ll,foldResults:[],score:candidateObjective({n,top1Hits:t1,top3Hits:t3,logLoss:ll},codes.length)};
}
describe("RAN v1.0 global SIGNAL BASKETS, not singleton filtering",()=>{
  it("always includes full 36, 35 leave-one-out baskets and non-singleton random restarts",()=>{
    const opts={...DEFAULT_BASKET_SEARCH,restartCount:30};
    const a=createDiverseBasketSeeds(c,opts),b=createDiverseBasketSeeds(c,opts);
    expect(a).toEqual(b);
    expect(a.some(x=>x.length===36)).toBe(true);
    expect(a.filter(x=>x.length===35).length).toBeGreaterThanOrEqual(36);
    expect(a.some(x=>x.length>=12&&x.length<=24)).toBe(true);
    expect(new Set(a.map(selectionKey)).size).toBe(a.length);
  });
  it("neighbours include add, drop, swap and 2-feature bundle jumps, no pre-judgment on weak single",()=>{
    const opts={...DEFAULT_BASKET_SEARCH,maxNeighbours:160};
    const old=c.slice(0,8);
    const n=basketNeighbours(old,opts);
    expect(n.some(s=>s.length===7)).toBe(true);
    expect(n.some(s=>s.length===9)).toBe(true);
    expect(n.some(s=>s.length===8&&s.includes(c[12])&&!s.includes(c[2]))).toBe(true);
    expect(n.some(s=>s.length===10)).toBe(true);
    expect(n.some(s=>s.length===6)).toBe(true);
    expect(n.some(s=>s.length===8&&s.filter(x=>!old.includes(x)).length>=2)).toBe(true);
    expect(n.every(x=>x.every(code=>c.includes(code)))).toBe(true);
    expect(new Set(n.map(selectionKey)).size).toBe(n.length);
  });
  it("prioritizes jointly refitted global basket even when both its singletons appear weak",()=>{
    const singleA=result([c[0]],10,30,2.2);
    const singleB=result([c[1]],10,30,2.2);
    const synergy=result([c[0],c[1]],22,78,2.0);
    expect(sourceBlindWinnerSelection([singleA,singleB,synergy])).toBe(synergy);
  });
  it("uses Pareto TOP1, TOP3 and LogLoss, never deletes based on Pearson alone",()=>{
    const weaker=result(c.slice(0,3),23,69,2.05);
    const stronger=result(c.slice(0,4),26,74,1.99);
    const tradeoff=result(c.slice(0,2),30,68,2.15);
    const front=basketParetoFront([weaker,stronger,tradeoff]);
    expect(front).not.toContain(weaker);
    expect(front).toContain(stronger);
    expect(front).toContain(tradeoff);
  });
  it("does not promote a speed/form-only contender despite attractive TOP1/TOP3",()=>{
    const full=result([...c],20,65,2.14);
    const incomplete=result(["SPEED","ACC_SPEED","RIVAL_GAP",
      "JOCKEY_LONG_TERM","FORM_LEVEL","WEIGHT_DISTANCE"],24,69,2.10);
    const decision=chooseBasketFromConfirmation([full,incomplete],full);
    expect(decision.selected).toBe(full);
    expect(decision.status).toBe("RESEARCH_FULL36_RETAINED");
    expect(decision.front).not.toContain(incomplete);
  });
  it("returns original full basket if TOP1 gain requires TOP3 regression or bad LogLoss",()=>{
    const full=result([...c],20,65,2.1);
    const badTop3=result(c.slice(0,4),25,62,2.07);
    const badLogLoss=result(c.slice(0,5),25,67,2.2);
    const pick=chooseBasketFromConfirmation([full,badTop3,badLogLoss],full);
    expect(selectionKey(pick.selected.codes)).toBe(selectionKey(full.codes));
    expect(pick.status).toBe("RESEARCH_FULL36_RETAINED");
  });
  it("rejects duplicate codes and unknown sources, not forced lineage members",()=>{
    expect(canonicalBasket([c[0],c[3]])).toEqual([c[0],c[3]]);
    expect(()=>canonicalBasket([c[1],c[1]])).toThrow("INVALID_CODES");
    expect(()=>canonicalBasket(["NOT_A_FEATURE"])).toThrow("INVALID_CODES");
  });
});
