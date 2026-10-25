import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {PEDIGREE_V3_VERSION} from "../pedigree-v3/lineage-weighted";

describe("RAN BASKET research CLI (all 36 signal families jointly refitted)",()=>{
  it("discovers 36 singles + all 630 pairs + multi-sized sets, on PIT V3 train only",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-basket-cli-"));
    try{
      const input=path.join(dir,"v3.json"),out=path.join(dir,"result");
      const rows=Array.from({length:300},(_,i)=>{
        const raceId="basket-smoke-"+i,win=1+i%4;
        const day=i<238?16+Math.floor(i*10/238):26+Math.floor((i-238)*3/62);
        return {
          raceId,tarih:"2026-08-"+String(day).padStart(2,"0"),winnerNo:win,
          pedigreeV3:{version:PEDIGREE_V3_VERSION},
          vectors:Array.from({length:4},(_,j)=>({
            raceId,no:j+1,name:"horse "+j,tjkAtId:100+i*4+j,jockey:null,
            pedigreeScoringVersion:PEDIGREE_V3_VERSION,
            signals:UNIFIED_MODEL_CODES.map((code,k)=>({
              code,family:"SMOKE",rawValue:(j*5+i+k*11)%31/31,
              observed:true,asOfSafe:true,coverageState:null,
              sampleCount:5,missingReason:null,
            })),
          })),
        };
      });
      writeFileSync(input,JSON.stringify(rows));
      const env={...process.env,NODE_ENV:"test",RAN_BASKET_IN:input,
        RAN_BASKET_OUT:out,RAN_BASKET_SCREEN_ITER:"5",
        RAN_BASKET_MAX_FITS:"750",RAN_BASKET_RESTARTS:"4",
        RAN_BASKET_ROUNDS:"1",RAN_BASKET_BEAM:"2",
        RAN_BASKET_NEIGHBORS:"10",RAN_BASKET_FINALISTS:"3"};
      delete env.DATABASE_URL;
      const run=spawnSync(process.execPath,
        ["node_modules/tsx/dist/cli.mjs","arac-ran-sepet-optimizasyonu.mts"],{
          cwd:process.cwd(),env,encoding:"utf8",timeout:120000,maxBuffer:2_000_000,
        });
      expect(run.error).toBeUndefined();
      expect(run.status,String(run.stderr)+"\n"+String(run.stdout).slice(-2000)).toBe(0);
      const report=JSON.parse(readFileSync(out+".report.json","utf8"));
      const candidate=JSON.parse(readFileSync(out+".candidate-model.json","utf8"));
      expect(report.trainingRaces).toBe(238);
      expect(report.devUsedForSelection).toBe(0);
      expect(report.previousOctoberUsedForSelection).toBe(0);
      expect(report.exhaustivePairs).toBe(630);
      expect(report.exhaustiveSingles).toBe(36);
      expect(report.evaluatedUniqueBaskets).toBeGreaterThanOrEqual(667);
      expect(report.searchIsExhaustive).toBe(false);
      expect(report.publicationGate).toBe("BLOCKED");
      expect(report.roiStatus).toContain("NOT_VERIFIED");
      expect(report.engineInputVersion).toBe(PEDIGREE_V3_VERSION);
      expect(candidate.model.nRacesUsed).toBe(238);
      expect(candidate.codes).toEqual(report.chosen.codes);
      expect(candidate.model.beta.length).toBe(2*candidate.codes.length);
      expect(candidate.publicationGate).toBe("BLOCKED");
      expect(readFileSync(out+".md","utf8")).toContain("SİNYAL SEPETİ");
    }finally{rmSync(dir,{recursive:true,force:true});}
  },125000);
});
