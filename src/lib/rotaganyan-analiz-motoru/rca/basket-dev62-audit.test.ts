import {describe,it,expect} from "vitest";
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import path from "node:path";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {PEDIGREE_V3_VERSION} from "../pedigree-v3/lineage-weighted";
import {fitModel,computeFeatureStats} from "@/lib/motor-v1/engine/training";
import {auditFrozenBasketDev62,type FrozenBasketArtifact} from "./basket-dev62-audit";
import type {FeatureRace} from "./combinatorial-signal-selection";
function data():FeatureRace[]{
  return Array.from({length:300},(_,i)=>{
    const raceId="DEV62-test-"+i;
    const day=i<238?16+Math.floor(i*10/238):26+Math.floor((i-238)*3/62);
    return {raceId,tarih:"2026-08-"+String(day).padStart(2,"0"),
      winnerNo:1+i%4,vectors:[1,2,3,4].map(no=>({
        raceId,no,name:"R"+no,tjkAtId:1000+i*4+no,jockey:null,
        pedigreeScoringVersion:PEDIGREE_V3_VERSION,
        signals:UNIFIED_MODEL_CODES.map((code,k)=>({
          code,family:"DIAGNOSTIC",rawValue:((i*7+no*3+k*11)%21)/21,
          observed:true,asOfSafe:true,coverageState:null,
          missingReason:null,sampleCount:5,
        })),
      })),
    };
  });
}
function fixture(){
  const rows=data(),sha=createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const train=rows.slice(0,238),dev=rows.slice(238);
  const codes=UNIFIED_MODEL_CODES.slice(0,6);
  const stats=computeFeatureStats(train.flatMap(x=>x.vectors),codes);
  const opts={lambda:90,learningRate:0.25,iterations:2500};
  const model=fitModel(train.map(r=>({
    raceId:r.raceId,date:new Date(r.tarih+"T00:00:00Z"),
    vectors:r.vectors,winnerNo:r.winnerNo,
  })),stats,opts);
  const artifact:FrozenBasketArtifact={
    artifactType:"RAN_BASKET_SHADOW_UNPUBLISHED",
    modelVersion:"RAN_SIGNAL_BASKET_DISCOVERY_V1",
    publicationGate:"BLOCKED",engineInputVersion:PEDIGREE_V3_VERSION,
    sourceSHA256:sha,codes:[...codes],
    model:{...model,stats:[...model.stats.entries()]},
  };
  return {rows,train,dev,sha,artifact};
}
describe("RAN basket already-inspected DEV62 — frozen paired audit",()=>{
  it("compares exact same races without touching candidate coefficients and accounts all rescued/lost winners",()=>{
    const a=fixture(),before=JSON.stringify(a.artifact);
    const report=auditFrozenBasketDev62(a.train,a.dev,a.artifact,a.sha);
    expect(report.status).toBe("DIAGNOSTIC_ONLY_ALREADY_INSPECTED_DEV62");
    expect(report.publicationGate).toBe("BLOCKED");
    expect(report.candidateCodes).toEqual(a.artifact.codes);
    expect(report.developmentRaces).toBe(62);
    expect(report.baseline.n).toBe(62);
    expect(report.candidate.n).toBe(62);
    expect(report.races).toHaveLength(62);
    expect(report.baseline.top3Hits).toBeGreaterThanOrEqual(report.baseline.top1Hits);
    expect(report.candidate.top3Hits).toBeGreaterThanOrEqual(report.candidate.top1Hits);
    expect(report.paired.netTop1).toBe(report.paired.rescuedTop1-report.paired.newlyMissedTop1);
    expect(report.paired.netTop3).toBe(report.paired.rescuedTop3-report.paired.newlyMissedTop3);
    expect(report.baseline.favoriteEce5).toBeGreaterThanOrEqual(0);
    expect(report.candidate.favoriteEce5).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(a.artifact)).toEqual(before);
  });
  it("refuses V2 weights and source-hash mismatch, wrong years, broken beta order",()=>{
    const a=fixture();
    expect(()=>auditFrozenBasketDev62(a.train,a.dev,
      {...a.artifact,engineInputVersion:"V2"},"incorrect")).toThrow("INVALID_FROZEN");
    expect(()=>auditFrozenBasketDev62(a.train,a.dev,a.artifact,"wrong"))
      .toThrow("INVALID_FROZEN");
    const broken={...a.artifact,model:{...a.artifact.model,
      names:["NONCANONICAL",...a.artifact.model.names.slice(1)]}};
    expect(()=>auditFrozenBasketDev62(a.train,a.dev,broken,a.sha))
      .toThrow("FEATURE_STATS_OR_ORDER");
    a.dev[0].tarih="2026-08-25";
    expect(()=>auditFrozenBasketDev62(a.train,a.dev,a.artifact,a.sha))
      .toThrow("ORIGINAL_238_62");
  });
  it("runs actual no-DB CLI with SHA-locked frozen shortlist, produces 62 paired race rows",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-basket-dev62-"));
    try{
      const a=fixture();
      const source=path.join(dir,"v3.json"),prefix=path.join(dir,"sepet"),
        out=path.join(dir,"dev");
      const json=JSON.stringify(a.rows);
      writeFileSync(source,json);
      writeFileSync(source+".manifest.json",JSON.stringify({
        version:PEDIGREE_V3_VERSION,
        outputSha:createHash("sha256").update(json).digest("hex"),
        trainingRaces:238,developmentRaces:62,everyHorseHasThreeLineages:true,
      }));
      writeFileSync(prefix+".candidate-model.json",JSON.stringify(a.artifact));
      writeFileSync(prefix+".report.json",JSON.stringify({
        publicationGate:"BLOCKED",sourceSHA256:a.sha,
        engineInputVersion:PEDIGREE_V3_VERSION,
        devUsedForSelection:0,trainingRaces:238,
        chosen:{codes:a.artifact.codes},
        confirmedBaskets:[{codes:a.artifact.codes}],
      }));
      const env: NodeJS.ProcessEnv={...process.env,NODE_ENV:"test",
        RAN_DEV_AUDIT_IN:source,RAN_DEV_AUDIT_BASKET_PREFIX:prefix,
        RAN_DEV_AUDIT_OUT:out};
      delete env.DATABASE_URL;
      const run=spawnSync(process.execPath,
        ["node_modules/tsx/dist/cli.mjs","arac-ran-sepet-dev62-denetimi.mts"],{
          cwd:process.cwd(),env,encoding:"utf8",timeout:50000,maxBuffer:1000000,
        });
      expect(run.error).toBeUndefined();
      expect(run.status,String(run.stderr)+"\n"+String(run.stdout).slice(-2000)).toBe(0);
      expect(run.stdout).toContain("Publication=BLOCKED");
      const report=JSON.parse(readFileSync(out+".json","utf8"));
      expect(report.races).toHaveLength(62);
      expect(report.candidateSource).toBe("FROZEN_6000_BASKET_SEARCH");
      expect(report.baseline.n).toBe(62);
      expect(report.candidate.n).toBe(62);
      expect(readFileSync(out+".md","utf8")).toContain("Yayın: BLOCKED");
    }finally{rmSync(dir,{recursive:true,force:true});}
  },55000);
});
