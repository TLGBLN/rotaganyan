import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AcceptanceRaceRow } from "./final-acceptance-report";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { computeFeatureStats, fitModel } from "@/lib/motor-v1/engine/training";
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";
import {
  auditCorrelations, auditSignalComplementarity, compareAuditRaces,
  evaluateAuditRows, KNOWN_SOURCE_BLOCKERS, validateAuditRows,
  type RaceEval, type ScoreMetrics,
} from "./signal-complementarity-audit";
const trainDays=["2026-08-16","2026-08-17","2026-08-18"];
function race(id:string,date:string): AcceptanceRaceRow {
  return {raceId:id,tarih:date,winnerNo:1,vectors:[1,2,3].map((no):RunnerFeatureVector=>({
    raceId:id,no,name:"Horse "+no,tjkAtId:null,jockey:null,
    signals:UNIFIED_MODEL_CODES.map((code,i)=>({
      code,family:"TEST",rawValue:i===0?no:i===1?no*2:i===2?no*3:i%4,
      observed:true,coverageState:null,asOfSafe:true,missingReason:null,
    })),
  }))};
}
const fakeMetrics=(ranks:number[]):ScoreMetrics=>({
  n:ranks.length,top1Hits:ranks.filter(x=>x===1).length,
  top3Hits:ranks.filter(x=>x<=3).length,
  top1:ranks.filter(x=>x===1).length/ranks.length,
  top3:ranks.filter(x=>x<=3).length/ranks.length,logLoss:1,
});
const evals=(ranks:number[])=>({
  metrics:fakeMetrics(ranks),
  races:ranks.map((rank,i):RaceEval=>({raceId:"r"+i,winnerNo:1,rank,pWinner:0.2})),
});
describe("RAN signal complementarity — fail closed and paired metrics",()=>{
  it("checks canonical train date, duplicates and full signal shape before any fitting",()=>{
    const a=race("1","2026-08-16");
    expect(()=>validateAuditRows([a,a],"TRAIN",["2026-08-16","2026-08-25"],2)).toThrow(/duplicate/);
    expect(()=>validateAuditRows([race("2","2026-10-21")],"TRAIN",["2026-08-16","2026-08-25"],1)).toThrow(/date/);
    const bad=race("1","2026-08-16");
    bad.vectors[0].signals.pop();
    expect(()=>validateAuditRows([bad],"TRAIN",["2026-08-16","2026-08-25"],1)).toThrow(/shape/);
  });
  it("identifies numeric overlap but does not drop any feature",()=>{
    const training=trainDays.map((d,i)=>race("training"+i,d));
    const rows=auditCorrelations(training);
    const a=rows.find(p=>p.codeA===UNIFIED_MODEL_CODES[0]&&p.codeB===UNIFIED_MODEL_CODES[1]);
    expect(a?.nBothObserved).toBe(9);
    expect(a?.pearson).toBeNull(); // fewer than 30 observations is NOT evidence
    expect(rows).toHaveLength(630); // choose(36,2), no silent skips
    expect(UNIFIED_MODEL_CODES).toHaveLength(36);
  });
  it("counts rescues AND new losses on the exact same race IDs",()=>{
    const base=evals([4,1,5,2,3]);
    const cand=evals([2,4,1,4,1]);
    const r=compareAuditRaces("TEST",UNIFIED_MODEL_CODES,base,cand);
    expect(r.rescue).toEqual({top1:2,top3:2});
    expect(r.harm).toEqual({top1:1,top3:2});
    expect(r.delta.top1Hits).toBe(1);
    expect(r.delta.top3Hits).toBe(0);
  });
  it("never permits lowering independent acceptance below 60",()=>{
    const training=trainDays.map((d,i)=>race("t"+i,d));
    const stats=computeFeatureStats(training.flatMap(r=>r.vectors),UNIFIED_MODEL_CODES);
    const model=fitModel(training.map(r=>({
      raceId:r.raceId,date:new Date(r.tarih+"T00:00:00Z"),
      winnerNo:r.winnerNo,vectors:r.vectors,
    })),stats,{lambda:1,learningRate:0.01,iterations:5});
    expect(()=>auditSignalComplementarity(training,[race("a","2026-10-23")],model,
      ["2026-08-16","2026-08-18"],"2026-08-28",3,1)).toThrow(/minimum cannot be lowered/);
  });
  it("fails when source training rows cannot match frozen model instead of fabricating ablations",()=>{
    const training=trainDays.map((d,i)=>race("t"+i,d));
    const stats=computeFeatureStats(training.flatMap(r=>r.vectors),UNIFIED_MODEL_CODES);
    const model=fitModel(training.map(r=>({
      raceId:r.raceId,date:new Date(r.tarih+"T00:00:00Z"),
      winnerNo:r.winnerNo,vectors:r.vectors,
    })),stats,{lambda:1,learningRate:0.01,iterations:5});
    const acceptance=Array.from({length:60},(_,i)=>race("a"+i,"2026-10-23"));
    const corrupted={...model,beta:model.beta.map((v,i)=>i===0?v+1:v)};
    expect(()=>auditSignalComplementarity(training,acceptance,corrupted,
      ["2026-08-16","2026-08-18"],"2026-08-28",3,60)).toThrow(/do not compare against unmatched training/);
  });
  it("identifies fixed pre-race source blockers instead of declaring publication safe",()=>{
    expect(KNOWN_SOURCE_BLOCKERS.map(x=>x.code)).toEqual(["SIRE_HISTORY","SPEED"]);
  });
  it("runs standalone audit CLI without DB, fails closed when locked train archive is absent",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-audit-cli-"));
    try {
      const dest=path.join(dir,"report");
      const result=spawnSync(process.execPath,[
        "node_modules/tsx/dist/cli.mjs","arac-ran-sinyal-tamamlayicilik-denetimi.mts",
      ],{cwd:process.cwd(),encoding:"utf8",timeout:20000,env:{
        ...process.env,
        RAN_AUDIT_TRAIN:path.join(dir,"not-here-train.json"),
        RAN_AUDIT_ACCEPT:path.join(dir,"not-here-accept.json"),
        RAN_AUDIT_OUT:dest,
        DATABASE_URL:"",
      }});
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("[RAN_SIGNAL_AUDIT] BLOCKED");
      expect(result.stderr).not.toContain("DATABASE_URL");
      const output=JSON.parse(readFileSync(dest+".json","utf8"));
      expect(output.publicationGate).toBe("BLOCKED");
      expect(output.status).toBe("INCOMPLETE");
      expect(output.originalModelUnchanged).toBe(true);
    } finally {
      rmSync(dir,{recursive:true,force:true});
    }
  },25000);

});
