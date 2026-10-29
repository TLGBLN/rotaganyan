import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";

describe("RAN pedigree lineage CLI no-DB smoke",()=>{
  it("emits 32 contextual experiments from 238 TRAIN, never chooses on DEV",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-pedigree-cli-"));
    try {
      const input=path.join(dir,"data.json"),out=path.join(dir,"pedigree-out");
      const rows=Array.from({length:300},(_,i)=>{
        const day=i<238?16+Math.floor(i*10/238):26+Math.floor((i-238)*3/62);
        const raceId="ped-run-"+i;
        return {
          raceId,tarih:"2026-08-"+String(day).padStart(2,"0"),winnerNo:1+i%4,
          vectors:Array.from({length:4},(_,j)=>({
            raceId,no:j+1,name:"At "+(j+1),tjkAtId:i*4+j,jockey:null,
            signals:UNIFIED_MODEL_CODES.map((code,k)=>({
              code,family:"SMOKE",rawValue:(i*5+j*3+k*7)%23/23,
              observed:true,asOfSafe:true,coverageState:null,missingReason:null,
            })),
          })),
        };
      });
      writeFileSync(input,JSON.stringify(rows));
      const env: NodeJS.ProcessEnv={...process.env,NODE_ENV:"test",RAN_PEDIGREE_DATA:input,
        RAN_PEDIGREE_OUT:out,RAN_PEDIGREE_ITERATIONS:"5"};
      delete env.DATABASE_URL;
      const run=spawnSync(process.execPath,
        ["node_modules/tsx/dist/cli.mjs","arac-ran-pedigri-hat-denetimi.mts"],
        {cwd:process.cwd(),env,encoding:"utf8",timeout:120000,maxBuffer:1_000_000});
      expect(run.error).toBeUndefined();
      expect(run.status,run.stderr+"\n"+run.stdout.slice(-2000)).toBe(0);
      expect(run.stdout).toContain("32/32");
      const report=JSON.parse(readFileSync(out+".json","utf8"));
      expect(report.publicationGate).toBe("BLOCKED");
      expect(report.trainingCount).toBe(238);
      expect(report.devUsedForSelection).toBe(0);
      expect(report.acceptanceUsedForSelection).toBe(0);
      expect(report.experiments).toHaveLength(32);
      expect(report.grouped).toHaveLength(4);
      expect(report.lineCoverage).toHaveLength(3);
      expect(readFileSync(out+".md","utf8")).toContain("DAM_HISTORY");
    }finally{rmSync(dir,{recursive:true,force:true});}
  },125000);
});
