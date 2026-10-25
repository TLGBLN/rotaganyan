// RAN v1.0 — REAL PostgreSQL snapshot roundtrip on isolated CI service.
// Synthetic feature inputs test physical DB I/O, not prediction accuracy or pre-race provenance.
// No Docker on the user's computer, no production database, no Prediction/Pick/HomeKupon writes.
import { Client } from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";
import { isolatedRanDatabaseUrl } from "./src/lib/rotaganyan-analiz-motoru/isolated-db-guard";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

async function main() {
  const url = isolatedRanDatabaseUrl(
    process.env.RAN_TEST_DATABASE_URL,
    process.env.RAN_TEST_LOCAL_DB_ACK,
    process.env.NODE_ENV
  );
  // A direct DB connection must also use only the checked loopback URL.
  process.env.DATABASE_URL = url.toString();
  process.env.RAN_SHADOW_SNAPSHOT_WRITES = "isolated-test-only";
  const pg = new Client({connectionString: url.toString(), ssl: false});
  await pg.connect();
  let prisma: typeof import("./src/lib/db").db | null = null;
  let savedKey: string | null = null;
  try {
    const check = await pg.query("SELECT current_database() AS name");
    assert.equal(check.rows[0]?.name, "ran_shadow_test", "unexpected DB name");

    // Apply ONLY the shadow table migration to the brand-new ephemeral test DB.
    await pg.query(fs.readFileSync("prisma/migrations/20261025160000_add_ran_snapshot_bundle/migration.sql","utf8"));

    // These modules are imported only AFTER the local DB guard and override above.
    const [
      { db },
      { loadTrainedModel },
      { getCurrentRanEngineVersion },
      { scoreRace, explainRunner },
      { toRanSignalSnapshotEntry, computePreRaceDataSnapshotId, computeWeightsFingerprint },
      { buildRanSnapshotBundle, readRanSnapshotBundle },
      { persistRanSnapshotBundle, loadRanSnapshotBundle },
      { UNIFIED_MODEL_CODES },
    ] = await Promise.all([
      import("./src/lib/db"),
      import("./src/lib/rotaganyan-analiz-motoru/load-trained-model"),
      import("./src/lib/rotaganyan-analiz-motoru/engine-versions"),
      import("./src/lib/motor-v1/engine/training"),
      import("./src/lib/rotaganyan-analiz-motoru/snapshot-integrity"),
      import("./src/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle"),
      import("./src/server/services/ran-snapshot-bundle.service"),
      import("./src/lib/rotaganyan-analiz-motoru/unified-model-codes"),
    ]);
    prisma = db;
    const model=loadTrainedModel();
    const version=getCurrentRanEngineVersion().surum;
    const fingerprint=computeWeightsFingerprint(model);
    const createdAt=new Date().toISOString();
    const legs=Array.from({length:6},(_,i)=>{
      const raceId="ci-ran-synthetic-"+(i+1);
      const vectors: RunnerFeatureVector[]=Array.from({length:3},(_,j)=>{
        const no=j+1;
        return {
          raceId,no,name:"SYNTHETIC-"+i+"-"+no,tjkAtId:null,jockey:null,
          signals:UNIFIED_MODEL_CODES.map((code,k)=>{
            const stat=model.stats.get(code);
            const observed=k===0;
            return {
              code, family:"CI_SYNTHETIC",
              rawValue:observed ? (stat?.mu ?? 0) + ((i+j+1)*0.03)*(stat?.sigma ?? 1) : null,
              observed, coverageState:null, asOfSafe:true as const,
              missingReason:observed?null:"ci-synthetic-no-observation",
            };
          }),
        };
      });
      const scores=scoreRace(vectors,model).sort((a,b)=>b.probability-a.probability);
      const map=new Map(vectors.map(v=>[v.no,v]));
      return {
        raceId,raceNo:i+1,runners:scores.map((r,index)=>{
          const vec=map.get(r.no)!;
          const rows=explainRunner(vec,model);
          const signals=rows.rows.map(toRanSignalSnapshotEntry);
          return {
            raceId,no:r.no,name:r.name,runnerId:null,
            engineVersion:version,weightsFingerprint:fingerprint,generatedAt:createdAt,
            originalRank:index+1,publishedRank:index+1,
            winProbability:r.probability,finalScore:rows.totalScore,
            featureCodeOrder:UNIFIED_MODEL_CODES,
            preRaceDataSnapshotId:computePreRaceDataSnapshotId(raceId,signals),
            signals,ekuriGroup:null,
          };
        }),
      };
    });
    const snapshot=buildRanSnapshotBundle(legs, 60, createdAt);
    savedKey=snapshot.bundleKey;

    const first=await persistRanSnapshotBundle(snapshot);
    const second=await persistRanSnapshotBundle(snapshot);
    assert.equal(first.id,second.id,"same bundle key must reuse same stored row");
    const read=await loadRanSnapshotBundle(first.id);
    assert.ok(read,"readback missing");
    const expected=readRanSnapshotBundle(snapshot);
    assert.deepEqual(read,expected,"stored JSONB changes analysis/coupon");
    assert.equal(read.analyses.length,6);
    const count=await pg.query('SELECT count(*)::int AS n FROM "RanSnapshotBundle" WHERE "bundleKey"=$1',[savedKey]);
    assert.equal(count.rows[0]?.n,1,"duplicate persisted rows");
    console.log("[RAN_PG_ROUNDTRIP] PASS");
    console.log("[RAN_PG] db=ran_shadow_test fixture=SYNTHETIC_ONLY realPostgres=true legs=6 rows=1");
    console.log("[RAN_PG] sameBundleKey=true sameRowId=true rankParity=true couponParity=true");
    console.log("[RAN_PG] production=false preRaceProvenance=NOT_VERIFIED");
  } finally {
    try {
      if(prisma && savedKey) await prisma.ranSnapshotBundle.deleteMany({where:{bundleKey:savedKey}});
    } finally {
      if(prisma) await prisma.$disconnect();
      await pg.end();
    }
  }
}
main().catch(e=>{
  console.error("[RAN_PG_ROUNDTRIP] FAIL",e instanceof Error?e.stack:e);
  process.exitCode=1;
});
