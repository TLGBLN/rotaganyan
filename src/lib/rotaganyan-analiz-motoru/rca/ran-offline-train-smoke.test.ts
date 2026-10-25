import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";

describe("RAN training recovery — offline smoke", () => {
  it("re-fits 36-signal model from JSON with DATABASE_URL ABSENT and without Prisma", () => {
    const temp=mkdtempSync(path.join(tmpdir(),"ran-pit-offline-train-"));
    try {
      const input=path.join(temp,"input.json"),output=path.join(temp,"result.json");
      const rows=Array.from({length:40},(_,i)=>{
        const raceId="offline"+i;
        return {
          raceId,tarih:i<30?"2026-08-18":"2026-08-26",winnerNo:i%4+1,
          vectors:Array.from({length:4},(_,j)=>({
            raceId,no:j+1,name:"runner-"+j,tjkAtId:null,jockey:null,
            signals:UNIFIED_MODEL_CODES.map((code,k)=>({
              code,family:"SMOKE",rawValue:((j+i+k)%9)/9,observed:true,
              coverageState:null,asOfSafe:true,missingReason:null,
            })),
          })),
        };
      });
      writeFileSync(input,JSON.stringify(rows));
      const env={...process.env,
        RAN_IN:input,RAN_MODEL_OUT:output,RAN_SPLIT_DATE:"2026-08-26",
        RAN_LAMBDA:"90",RAN_LR:"0.25",RAN_ITER:"5",NODE_ENV:"test"};
      delete env.DATABASE_URL;
      const r=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs","./arac-ran-egit-ve-degerlendir.mts"],{
        cwd:process.cwd(),env,encoding:"utf8",timeout:30000,maxBuffer:2_000_000,
      });
      expect(r.error).toBeUndefined();
      expect(r.status,String(r.stderr)+"\n"+String(r.stdout).slice(-800)).toBe(0);
      expect(r.stdout).toContain("train=30");
      expect(r.stdout).toContain("holdout=10");
      const result=JSON.parse(readFileSync(output,"utf8"));
      expect(result.nTrainRaces).toBe(30);
      expect(result.nHoldoutRaces).toBe(10);
      expect(result.model.names).toHaveLength(UNIFIED_MODEL_CODES.length*2);
      expect(result.holdoutMetrics.top1).toBeGreaterThanOrEqual(0);
      expect(result.holdoutMetrics.top3).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(temp,{force:true,recursive:true});
    }
  },35000);
});
