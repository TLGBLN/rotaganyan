import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";

describe("RAN 36 singles + 630 exhaustive pairs CLI integration",()=>{
  it("makes diagnostic candidate without a DB or using development winners, and resumes safe checkpoint",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-combo-cli-"));
    try {
      const input=path.join(dir,"data.json"),out=path.join(dir,"report");
      const fixture=Array.from({length:300},(_,i)=>{
        const day=i<238?16+Math.floor(i*10/238):26+Math.floor((i-238)*3/62);
        const raceId="smoke-race-"+i;
        const winnerNo=i%4+1;
        return {
          raceId,tarih:"2026-08-"+String(day).padStart(2,"0"),winnerNo,
          vectors:Array.from({length:4},(_,j)=>({
            raceId,no:j+1,name:"SMOKE "+(j+1),tjkAtId:null,jockey:null,
            signals:UNIFIED_MODEL_CODES.map((code,k)=>({
              code,family:"SMOKE",rawValue:((j*3+i+k*7)%13)/13,
              observed:true,asOfSafe:true,coverageState:null,missingReason:null,
            })),
          })),
        };
      });
      writeFileSync(input,JSON.stringify(fixture));
      const env={...process.env,NODE_ENV:"test",RAN_COMBO_DATA:input,RAN_COMBO_OUT:out,
        RAN_COMBO_ITERATIONS:"5",RAN_COMBO_BEAM_WIDTH:"1",RAN_COMBO_MAX_SIGNALS:"3",
        RAN_COMBO_INTERACTIONS:"top50"};
      delete env.DATABASE_URL;
      const run=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs","arac-ran-kombinasyonlu-sinyal-secimi.mts"],{
        cwd:process.cwd(),env,encoding:"utf8",timeout:120000,maxBuffer:1_000_000,
      });
      expect(run.error).toBeUndefined();
      expect(run.status,run.stderr+"\n"+run.stdout.slice(-2500)).toBe(0);
      expect(run.stdout).toContain("pairs=630");
      const report=JSON.parse(readFileSync(out+".json","utf8"));
      const candidate=JSON.parse(readFileSync(out+".candidate-model.json","utf8"));
      expect(report.trainingRaces).toBe(238);
      expect(report.developmentUsedForSelection).toBe(0);
      expect(report.acceptanceUsedForSelection).toBe(0);
      expect(report.pairCount).toBe(630);
      expect(report.singleCount).toBe(36);
      expect(report.interactionTrials).toBe(50);
      expect(report.interactionResults).toHaveLength(50);
      expect(report.scoreInflation.selected.nRaces).toBeGreaterThan(0);
      expect(report.scoreInflation.selected.publicationGate).toBe("BLOCKED");
      expect(report.scoreInflation.selected.bins).toHaveLength(5);
      expect(report.scoreInflation.selected.multiClassBrierMean).toBeGreaterThanOrEqual(0);
      expect(report.innerFolds).toHaveLength(3);
      expect(report.publicationGate).toBe("BLOCKED");
      expect(candidate.artifactType).toContain("SHADOW");
      expect(candidate.nRacesUsed).toBe(238);
      expect(candidate.devRacesUsed).toBe(0);
      expect(candidate.codes.length).toBeGreaterThanOrEqual(2);
      expect(candidate.beta).toHaveLength(candidate.codes.length*2);
      expect(candidate.opts.iterations).toBe(2500);
    }finally{
      rmSync(dir,{recursive:true,force:true});
    }
  },125000);
});
