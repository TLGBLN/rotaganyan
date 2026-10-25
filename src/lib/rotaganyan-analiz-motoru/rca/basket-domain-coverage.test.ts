import {describe,it,expect} from "vitest";
import {UNIFIED_MODEL_CODES as c} from "../unified-model-codes";
import {BASKET_DOMAIN_RULES,basketDomainCheck,assertBasketDomainCoverage,
  completeBasketDomains} from "./basket-domain-coverage";

const OLD_SIX=["SPEED","ACC_SPEED","RIVAL_GAP","JOCKEY_LONG_TERM",
  "FORM_LEVEL","WEIGHT_DISTANCE"];

describe("RAN baskets require racing evidence, not a fast 6-feature speed shortcut",()=>{
  it("rejects previously chosen six-feature source because pedigree, pace and track are absent",()=>{
    const result=basketDomainCheck(OLD_SIX);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("SIRE");
    expect(result.missing).toContain("DAM");
    expect(result.missing).toContain("DAMSIRE");
    expect(result.missing).toContain("OWN_PACE");
    expect(result.missing).toContain("FIELD_PACE");
    expect(result.missing).toContain("TRACK_DISTANCE");
    expect(()=>assertBasketDomainCoverage(OLD_SIX)).toThrow("MISSING_RACING_DOMAINS");
  });
  it("accepts all 36 canonical model inputs without forcing positive coefficients",()=>{
    expect(BASKET_DOMAIN_RULES).toHaveLength(14);
    expect(basketDomainCheck(c).complete).toBe(true);
    expect(()=>assertBasketDomainCoverage(c)).not.toThrow();
  });
  it("completes 6-feature speed source to DIFFERENT coverage-complete candidate inputs deterministically",()=>{
    const a=completeBasketDomains(OLD_SIX,1);
    const b=completeBasketDomains(OLD_SIX,2);
    expect(basketDomainCheck(a).complete).toBe(true);
    expect(basketDomainCheck(b).complete).toBe(true);
    expect(a).not.toEqual(b);
    expect(a).toEqual(completeBasketDomains(OLD_SIX,1));
    expect(a).toEqual(expect.arrayContaining(OLD_SIX));
    expect(a).toEqual(expect.arrayContaining(["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"]));
  });
  it("never disables three distinct pedigree lines even if a compact basket scores well",()=>{
    for(const dropped of ["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"]){
      const incomplete=c.filter(x=>x!==dropped);
      expect(basketDomainCheck(incomplete).complete).toBe(false);
    }
  });
});
