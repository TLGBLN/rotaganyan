import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";
function fixture() {
  return Array.from({length:300},(_,i)=>{
    const raceId="PIT-"+(i+1);
    return {raceId,tarih:i<238?"2026-08-21":"2026-08-27",winnerNo:1,
      vectors:Array.from({length:3},(_,j)=>({
        raceId,no:j+1,signals:UNIFIED_MODEL_CODES.map(code=>({
          code,rawValue:0,observed:true,
        })),
      })),
    };
  });
}
function run(rows: unknown) {
  const dir=mkdtempSync(path.join(tmpdir(),"ran-pit-check-"));
  try {
    const p=path.join(dir,"data.json");
    writeFileSync(p,JSON.stringify(rows));
    return spawnSync(process.execPath,["arac-ran-pit-dataset-check.cjs",p],{
      cwd:process.cwd(),encoding:"utf8",timeout:15000,
      env:{...process.env,DATABASE_URL:""},
    });
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
describe("RAN PIT completed cohort JSON validation (offline)",()=>{
  it("recognizes true 300-row JSON array across PowerShell versions",()=>{
    const r=run(fixture());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("total=300 train=238 dev=62");
    expect(r.stdout).toContain("PASS:");
  });
  it("fails closed on malformed sample rather than re-collecting 88 min of source",()=>{
    const r=run([fixture()]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("expected total=300");
  });
  it("fails closed on duplicate race and noncanonical feature count",()=>{
    const d=fixture();d[1].raceId=d[0].raceId;
    expect(run(d).stderr).toContain("duplicate raceId");
    const e=fixture();e[2].vectors[0].signals.pop();
    expect(run(e).stderr).toContain("noncanonical");
  });
});
