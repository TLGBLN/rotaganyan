import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {PEDIGREE_V2_VERSION,LINEAGES} from "./lineage-score";
import {scorePedigreeV2Candidates,type PedigreeV2Artifact} from "./score-candidate";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
describe("RAN v2 original 300-row archive -> offline fit -> versioned score parity",()=>{
  it("re-fits 238 PIT races with all 3 ancestry signals and refuses any legacy-model confusion",()=>{
    const dir=mkdtempSync(path.join(tmpdir(),"ran-ped-v2-fit-"));
    try{
      const source=path.join(dir,"v2.json"),out=path.join(dir,"v2-trained.json");
      const rows=Array.from({length:300},(_,i)=>{
        const raceId="ped-v2-smoke-"+i;
        const date=i<238?"2026-08-"+String(16+Math.floor(i*10/238)).padStart(2,"0"):
          "2026-08-"+String(26+Math.floor((i-238)*3/62)).padStart(2,"0");
        const vectors:RunnerFeatureVector[]=Array.from({length:4},(_,j)=>({
          raceId,no:j+1,name:"R"+(j+1),tjkAtId:100+j,jockey:null,
          pedigreeScoringVersion:PEDIGREE_V2_VERSION,
          signals:UNIFIED_MODEL_CODES.map((code,k)=>({
            code,family:"SMOKE",rawValue:(k%7+j*3+i%5)/10,
            observed:true,asOfSafe:true,coverageState:null,missingReason:null,
            sampleCount:LINEAGES.some(l=>l.code===code)?(5+j):null,
          })),
        }));
        return {raceId,tarih:date,winnerNo:1+(i%4),
          vectors,pedigreeV2:{version:PEDIGREE_V2_VERSION,lines:{}}};
      });
      writeFileSync(source,JSON.stringify(rows));
      const env={...process.env,NODE_ENV:"test",RAN_IN:source,RAN_MODEL_OUT:out,
        RAN_MODEL_VERSION:PEDIGREE_V2_VERSION,RAN_SPLIT_DATE:"2026-08-26",
        RAN_LAMBDA:"90",RAN_LR:"0.25",RAN_ITER:"5"};
      delete env.DATABASE_URL;
      const run=spawnSync(process.execPath,
        ["node_modules/tsx/dist/cli.mjs","arac-ran-egit-ve-degerlendir.mts"],{
          cwd:process.cwd(),env,encoding:"utf8",timeout:25000,maxBuffer:1_000_000,
        });
      expect(run.error).toBeUndefined();
      expect(run.status,run.stderr+"\n"+run.stdout.slice(-1800)).toBe(0);
      const candidate=JSON.parse(readFileSync(out,"utf8")) as PedigreeV2Artifact;
      expect(candidate.engineVersion).toBe(PEDIGREE_V2_VERSION);
      expect(candidate.publicationGate).toBe("BLOCKED");
      expect(candidate.nTrainRaces).toBe(238);
      expect(candidate.nHoldoutRaces).toBe(62);
      const scores=scorePedigreeV2Candidates(rows[250].vectors,candidate);
      expect(scores.ranked).toHaveLength(4);
      expect(scores.ranked.reduce((s,r)=>s+r.probability,0)).toBeCloseTo(1);
      const mismatched={...candidate,engineVersion:"RAN_36_LEGACY"};
      expect(()=>scorePedigreeV2Candidates(rows[250].vectors,mismatched)).toThrow();
    }finally{rmSync(dir,{recursive:true,force:true});}
  },30000);
});
