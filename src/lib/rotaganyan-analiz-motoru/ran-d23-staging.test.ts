import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import raw from "./artifacts/ran-d23-staging-candidate.json";
import { calculatePaceScenario, PACE_EXTENSION_CODES } from "./pace-scenario";

function fingerprint() {
  const a=raw.modelArtifact;
  const payload=JSON.stringify({
    codes:a.codes,names:a.names,beta:a.beta.map(b=>Number(b.toFixed(10))),
    muSigma:Object.fromEntries(Object.entries(a.muSigma).sort(([x],[y])=>x.localeCompare(y))
      .map(([k,v])=>[k,{mu:Number(v.mu.toFixed(10)),
        sigma:Number(v.sigma.toFixed(10)),nObserved:v.nObserved}]))
  });
  return createHash("sha256").update(payload).digest("hex");
}
describe("D23 research candidate integrity (NOT publication approval)",()=>{
  it("keeps exact 23-signal 46-column contract and uploaded model hash",()=>{
    const m=raw.modelArtifact;
    expect(m.codes).toHaveLength(23);
    expect(new Set(m.codes).size).toBe(23);
    expect(m.beta).toHaveLength(46);
    expect(m.nRacesTrain).toBe(115);
    expect(raw.source.frozenJournalSha256).toBe("311d2bdea8fded3ae08b0c4edb02dab5e5f3469d1b1ad5befaaa78c25437d50f");
    expect(m.names).toEqual(m.codes.flatMap(c=>[c+"_z",c+"_missing"]));
    expect(fingerprint()).toBe("fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c");
  });
  it("preserves explicit release blockade and absent independent holdout",()=>{
    expect(raw.releaseStatus).toBe("BLOCKED_PENDING_PIT_HOLDOUT_ROI_SNAPSHOT");
    expect(raw.independentHoldoutValidated).toBe(false);
    expect(raw.productionWired).toBe(false);
    expect(raw.modelArtifact.deploymentReady).toBe(false);
    expect(raw.modelArtifact.nRacesHoldout).toBe(0);
    expect(raw.blockers.length).toBeGreaterThan(0);
  });
  it("uses the exact uploaded pace calculator source bytes",()=>{
    const file=readFileSync("src/lib/rotaganyan-analiz-motoru/pace-scenario.ts");
    expect(createHash("sha256").update(file).digest("hex"))
      .toBe(raw.source.calculatorSha256);
  });
  it("retains all three tactical signals and separate scenarios",()=>{
    expect(PACE_EXTENSION_CODES).toEqual(["PACE_DUEL_SELF","PACE_STALK_DUEL","PACE_DRAW_LEAD_PRESS"]);
    const o=calculatePaceScenario([
      {no:1,name:"A",startNo:1,style:[.6,.2,.1,.1,0,0]},
      {no:2,name:"B",startNo:2,style:[.5,.2,.1,.2,0,0]},
      {no:3,name:"C",startNo:3,style:[.05,.1,.5,.2,.1,.05]},
    ]);
    expect(o.horses).toHaveLength(3);
    expect(o.horses.every(x=>x.signals.length===3)).toBe(true);
    expect(o.scenarioIndicators.uncontestedLead).not.toBeNull();
    expect(o.horses[0].signals[0].rawValue).toBeGreaterThan(0);
  });
});
