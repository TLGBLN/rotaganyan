import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UNIFIED_MODEL_CODES } from "@/lib/rotaganyan-analiz-motoru/unified-model-codes";
import { computePreRaceDataSnapshotId, type RanSignalSnapshotEntry } from "@/lib/rotaganyan-analiz-motoru/snapshot-integrity";
const mocks=vi.hoisted(()=>({
  auth:vi.fn(),hasRole:vi.fn(),race:vi.fn(),run:vi.fn(),persist:vi.fn(),load:vi.fn(),
}));
vi.mock("@/lib/auth",()=>({auth:mocks.auth,hasRole:mocks.hasRole}));
vi.mock("@/lib/db",()=>({db:{race:{findUnique:mocks.race}}}));
vi.mock("@/app/api/admin/test-ran-engine/route",()=>({runRanEngineForRace:mocks.run}));
vi.mock("@/server/services/ran-snapshot-bundle.service",()=>({
  persistRanSnapshotBundle:mocks.persist,loadRanSnapshotBundle:mocks.load,
}));
import {GET,POST} from "./route";
const ts="2026-10-25T10:00:00.000Z";
function engineRows(raceId:string) {
  return [1,2].map(no=>{
    const p=no===1?0.65:0.35;
    const signals:RanSignalSnapshotEntry[]=UNIFIED_MODEL_CODES.map(code=>({
      code,family:"TEST",raw:no,observed:true,reliability:1,coverageState:null,
      modelVersion:"v1",standardizedValue:0,learnedCoefficient:0,
      scoreContribution:code===UNIFIED_MODEL_CODES[0]?Math.log(p):0,missingIndicatorCoefficient:0,missingIndicatorContribution:0,
    }));
    return {
      raceId,no,name:"At "+no,runnerId:"runner-"+no,engineVersion:"1.0",
      weightsFingerprint:"fp",generatedAt:ts,originalRank:no,publishedRank:no,
      winProbability:p,finalScore:Math.log(p),featureCodeOrder:UNIFIED_MODEL_CODES,
      preRaceDataSnapshotId:computePreRaceDataSnapshotId(raceId,signals),signals,
    };
  });
}
const input={legs:Array.from({length:6},(_,i)=>({raceId:"race-"+(i+1),raceNo:i+1})),maxCombinations:20};
function req(body:unknown) {
  return new NextRequest("http://localhost/api/admin/test-ran-bundle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
describe("ADMIN-only RAN snapshot preview",()=>{
  beforeEach(()=>{
    mocks.auth.mockResolvedValue({user:{role:"EDITOR"}});
    mocks.hasRole.mockReturnValue(true);
    mocks.race.mockImplementation(async({where}:{where:{id:string}})=>{
      const raceNo=Number(where.id.split("-")[1]);
      return {raceNo,raceDay:{date:new Date(ts),hippodrome:{name:"Adana"}},
        runners:[{no:1,ekuriGroup:null},{no:2,ekuriGroup:null}]};
    });
    mocks.run.mockReset();
    mocks.run.mockImplementation(async(raceId:string)=>({atlar:engineRows(raceId)}));
    mocks.persist.mockReset();mocks.load.mockReset();
    vi.stubEnv("NODE_ENV","test");
    vi.stubEnv("RAN_SHADOW_SNAPSHOT_WRITES", undefined);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it("rejects production calls without invoking engine or writes",async()=>{
    vi.stubEnv("NODE_ENV","production");
    const res=await POST(req(input));
    expect(res.status).toBe(404);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("blocks persist=true without isolated-test-only permission",async()=>{
    const res=await POST(req({...input,persist:true}));
    expect(res.status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("generates six-leg analysis and coupon from server-calculated immutable snapshots, no writes",async()=>{
    const res=await POST(req(input));
    expect(res.status).toBe(200);
    const body=await res.json();
    expect(body.analyses).toHaveLength(6);
    expect(Object.keys(body.coupon.secimler)).toHaveLength(6);
    expect(body.sourceProvenance).toBe("NOT_VERIFIED");
    expect(body.storage).toBe("NOT_PERSISTED");
    expect(mocks.run).toHaveBeenCalledTimes(6);
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("GET checks authorization before retrieving a stored immutable bundle",async()=>{
    mocks.hasRole.mockReturnValue(false);
    const res=await GET(new NextRequest("http://localhost/api/admin/test-ran-bundle?id=bundle-1"));
    expect(res.status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
