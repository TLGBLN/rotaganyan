import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computePreRaceDataSnapshotId, type RanSignalSnapshotEntry } from "@/lib/rotaganyan-analiz-motoru/snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "@/lib/rotaganyan-analiz-motoru/unified-model-codes";
import { buildRanSnapshotBundle } from "@/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle";

const mocked=vi.hoisted(()=>({
  upsert: vi.fn(), findUnique: vi.fn(), tx: vi.fn(),
}));
vi.mock("@/lib/db",()=>({
  db:{
    $transaction: mocked.tx,
    ranSnapshotBundle: { findUnique: mocked.findUnique },
  },
}));
import { persistRanSnapshotBundle, loadRanSnapshotBundle } from "./ran-snapshot-bundle.service";

const when="2026-10-25T12:30:00.000Z";
function bundle(){
  return buildRanSnapshotBundle(Array.from({length:6},(_,k)=>{
    const raceId="race-"+(k+1);
    return {raceId,raceNo:k+1,runners:[1,2].map((no)=>{
      const p=no===1?0.6:0.4;
      const signals: RanSignalSnapshotEntry[]=UNIFIED_MODEL_CODES.map(code=>({
        code, family:"TEST",raw:no,observed:true,reliability:1,
        coverageState:null,modelVersion:"1.0",standardizedValue:0,
        learnedCoefficient:0,scoreContribution:code===UNIFIED_MODEL_CODES[0]?Math.log(p):0,
        missingIndicatorCoefficient:0,missingIndicatorContribution:0,
      }));
      return {
        raceId,no,name:"Horse-"+no,runnerId:"runner-"+no,
        engineVersion:"1.0",weightsFingerprint:"model-hash",generatedAt:when,
        originalRank:no,publishedRank:no,winProbability:p,
        finalScore:Math.log(p),featureCodeOrder:UNIFIED_MODEL_CODES,
        preRaceDataSnapshotId:computePreRaceDataSnapshotId(raceId,signals),signals,
      };
    })};
  }),24,when);
}

describe("RAN isolated immutable transaction",()=>{
  const oldFlag=process.env.RAN_SHADOW_SNAPSHOT_WRITES;
  const oldNode=process.env.NODE_ENV;
  beforeEach(()=>{
    mocked.upsert.mockReset();
    mocked.tx.mockReset();
    mocked.findUnique.mockReset();
  });
  afterEach(()=>{
    if(oldFlag===undefined) delete process.env.RAN_SHADOW_SNAPSHOT_WRITES;
    else process.env.RAN_SHADOW_SNAPSHOT_WRITES=oldFlag;
    if(oldNode===undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV=oldNode;
  });
  it("write guard fails closed with no flag; no transaction is started",async()=>{
    delete process.env.RAN_SHADOW_SNAPSHOT_WRITES;
    await expect(persistRanSnapshotBundle(bundle())).rejects.toThrow("RAN_SHADOW_WRITES_DISABLED");
    expect(mocked.tx).not.toHaveBeenCalled();
  });
  it("only explicitly isolated test writes use one idempotent upsert and immutable update={}",async()=>{
    process.env.NODE_ENV="test";
    process.env.RAN_SHADOW_SNAPSHOT_WRITES="isolated-test-only";
    const b=bundle();
    mocked.tx.mockImplementation(async(fn: (t:unknown)=>Promise<unknown>)=>
      fn({ranSnapshotBundle:{upsert:mocked.upsert}}));
    mocked.upsert.mockResolvedValue({id:"persisted-one-row",bundleKey:b.bundleKey,payload:b});
    const saved=await persistRanSnapshotBundle(b);
    expect(saved).toEqual({id:"persisted-one-row",bundleKey:b.bundleKey});
    expect(mocked.upsert).toHaveBeenCalledTimes(1);
    const args=mocked.upsert.mock.calls[0][0];
    expect(args.update).toEqual({});
    expect(args.where.bundleKey).toBe(b.bundleKey);
    expect(args.create.payload.coupon).toEqual(b.coupon);
    expect(args.create.payload.legs).toHaveLength(6);
  });
  it("reads same stored bundle and never recalculates from a live model",async()=>{
    const b=bundle();
    mocked.findUnique.mockResolvedValue({bundleKey:b.bundleKey,payload:b});
    const read=await loadRanSnapshotBundle("stored-id");
    expect(read?.bundleKey).toBe(b.bundleKey);
    expect(read?.analyses).toHaveLength(6);
    expect(read?.coupon).toEqual(b.coupon);
    expect(mocked.tx).not.toHaveBeenCalled();
  });
});
