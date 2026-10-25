// RAN v1.0 — GERCEK PostgreSQL + Prisma, YALNIZ LOCAL ran_shadow_test DB.
// Guard'dan once db/service import YOK: production .env URL'sine baglanamaz.
// Veri: 60'lik kabul JSON'undan 6 farkli kosu; raceNo=1..6 SENTETIK test etiketidir.
// Gercek bir 6'li havuz veya pre-race yayin kaniti DEGILDIR.
// Production Prediction/Pick/HomeKupon okumasi/yazmasi YOK.
// BASLATMA: RAN_TEST_DATABASE_URL=postgresql://postgres@localhost:54329/ran_shadow_test
//             RAN_TEST_LOCAL_DB_ACK=ran_shadow_test
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import type { RanBundleLeg } from "./src/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle";
import { Client } from "pg";
import { isolatedRanDatabaseUrl } from "./src/lib/rotaganyan-analiz-motoru/isolated-db-guard";

const SOURCE = process.env.RAN_ACCEPT_DATA ?? "C:/tmp/ran-egitim-verisi-SON.json";
type DbClient = Client;
const migrationPath = "prisma/migrations/20261025160000_add_ran_snapshot_bundle/migration.sql";

async function connectLocal(url: URL): Promise<DbClient> {
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 4000, ssl: false });
  await client.connect();
  return client;
}

async function ensureDedicatedLocalDatabase(url: URL): Promise<DbClient> {
  try {
    return await connectLocal(url);
  } catch (error) {
    const reason = error as Error & { code?: string };
    if (reason.code !== "3D000") {
      throw new Error("LOCAL_POSTGRES_CONNECTION_FAILED: " + reason.message);
    }
  }
  // Var olmayan test DB'sini SADECE localhost postgres uzerinde olustur.
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  const admin = await connectLocal(adminUrl);
  try {
    const check = await admin.query("SELECT current_database() AS db");
    if (check.rows[0]?.db !== "postgres") throw new Error("RAN_LOCAL_ADMIN_DATABASE_MISMATCH");
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", ["ran_shadow_test"]);
    if (found.rowCount === 0) await admin.query('CREATE DATABASE "ran_shadow_test"');
  } finally {
    await admin.end();
  }
  return await connectLocal(url);
}

async function main() {
  const url = isolatedRanDatabaseUrl(
    process.env.RAN_TEST_DATABASE_URL,
    process.env.RAN_TEST_LOCAL_DB_ACK,
    process.env.NODE_ENV
  );
  if (!fs.existsSync(SOURCE)) throw new Error("RAN_TEST_ACCEPTANCE_FILE_MISSING: " + SOURCE);

  // BEFORE loading Prisma or any other DB module: force the fully validated test URL.
  // dotenv and the app's DATABASE_URL/DIRECT_URL cannot silently override this URL.
  process.env.DATABASE_URL = url.toString();
  process.env.RAN_SHADOW_SNAPSHOT_WRITES = "isolated-test-only";
  const pg = await ensureDedicatedLocalDatabase(url);
  let db: typeof import("./src/lib/db").db | null = null;
  let savedKey: string | null = null;
  try {
    const dbName = await pg.query("SELECT current_database() AS db");
    if (dbName.rows[0]?.db !== "ran_shadow_test") throw new Error("RAN_ISOLATION_RUNTIME_FAILED");

    const table = await pg.query('SELECT to_regclass(\'public."RanSnapshotBundle"\') AS tbl');
    if (table.rows[0]?.tbl == null) {
      await pg.query(fs.readFileSync(migrationPath, "utf8"));
    }
    const [modelModule, trainingModule, integrityModule, bundleModule, dbModule, store, codesModule, checker] =
      await Promise.all([
        import("./src/lib/rotaganyan-analiz-motoru/load-trained-model"),
        import("./src/lib/motor-v1/engine/training"),
        import("./src/lib/rotaganyan-analiz-motoru/snapshot-integrity"),
        import("./src/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle"),
        import("./src/lib/db"),
        import("./src/server/services/ran-snapshot-bundle.service"),
        import("./src/lib/rotaganyan-analiz-motoru/unified-model-codes"),
        import("./src/lib/rotaganyan-analiz-motoru/rca/acceptance-vector-rca"),
      ]);
    db = dbModule.db;
    const raw: unknown = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
    if (raw == null || typeof raw !== "object") throw new Error("RAN_TEST_ACCEPTANCE_INVALID");
    const rows = (Array.isArray(raw) ? raw : Object.values(raw)) as {
      raceId: string; tarih: string; winnerNo: number | null;
      vectors: import("./src/lib/motor-v1/engine/feature-vector").RunnerFeatureVector[];
    }[];
    const accepted = rows.filter((r) => r && r.winnerNo != null &&
      Array.isArray(r.vectors) && r.vectors.length >= 2 &&
      checker.validateAcceptanceVectors(r.raceId, r.vectors).length === 0);
    const picked = accepted.filter((r, i) =>
      accepted.findIndex((other) => other.raceId === r.raceId) === i
    ).slice(0, 6);
    if (picked.length !== 6) throw new Error("RAN_TEST_NEEDS_SIX_DISTINCT_VALID_ACCEPTANCE_RACES");

    const model = modelModule.loadTrainedModel();
    const engineVersion = (await import("./src/lib/rotaganyan-analiz-motoru/engine-versions")).getCurrentRanEngineVersion().surum;
    const fp = integrityModule.computeWeightsFingerprint(model);
    const generatedAt = new Date().toISOString();
    const legs: RanBundleLeg[] = picked.map((race, idx) => {
      const ranked = trainingModule.scoreRace(race.vectors, model).sort((a, b) => b.probability - a.probability);
      const vectorsByNo = new Map(race.vectors.map((v) => [v.no, v]));
      return {
        raceId: race.raceId,
        raceNo: idx + 1, // Only for test coupon; NOT an actual six-leg timetable.
        runners: ranked.map((r, order) => {
          const vec = vectorsByNo.get(r.no)!;
          const explained = trainingModule.explainRunner(vec, model);
          const signals = explained.rows.map(integrityModule.toRanSignalSnapshotEntry);
          return {
            raceId: race.raceId, no: r.no, name: r.name,
            runnerId: null, engineVersion, weightsFingerprint: fp,
            generatedAt, originalRank: order + 1, publishedRank: order + 1,
            winProbability: r.probability, finalScore: explained.totalScore,
            featureCodeOrder: codesModule.UNIFIED_MODEL_CODES,
            preRaceDataSnapshotId: integrityModule.computePreRaceDataSnapshotId(race.raceId, signals),
            signals,
          };
        }),
      };
    });
    const snapshot = bundleModule.buildRanSnapshotBundle(legs, 20, generatedAt);
    savedKey = snapshot.bundleKey;
    bundleModule.verifyRanSnapshotBundle(snapshot);

    const a = await store.persistRanSnapshotBundle(snapshot);
    const b = await store.persistRanSnapshotBundle(snapshot); // same key MUST be idempotent
    if (a.id !== b.id || a.bundleKey !== b.bundleKey) throw new Error("RAN_REAL_DB_IDEMPOTENCY_FAILED");

    const read = await store.loadRanSnapshotBundle(a.id);
    if (!read || read.bundleKey !== snapshot.bundleKey ||
        read.analyses.length !== 6 ||
        !isDeepStrictEqual(read.coupon, snapshot.coupon)) {
      throw new Error("RAN_REAL_DB_READBACK_MISMATCH");
    }
    for (let i = 0; i < 6; i++) {
      const received = read.analyses[i];
      const expected = [...snapshot.legs[i].runners].sort((x,y)=>x.publishedRank-y.publishedRank);
      if (received.raceId !== snapshot.legs[i].raceId ||
          received.ranked.some((r,j) => r.no !== expected[j].no ||
            r.winProbability !== expected[j].winProbability ||
            r.finalScore !== expected[j].finalScore)) {
        throw new Error("RAN_REAL_DB_RANK_PARITY_FAILED: raceIndex=" + i);
      }
    }
    const count = await pg.query('SELECT count(*)::int AS n FROM "RanSnapshotBundle" WHERE "bundleKey"=$1',
      [snapshot.bundleKey]);
    if (count.rows[0]?.n !== 1) throw new Error("RAN_REAL_DB_DUPLICATE_ROWS");
    console.log("[RAN_PG_ROUNDTRIP] PASS");
    console.log("[RAN_PG] db=ran_shadow_test scope=localhost rows=1 legs=6");
    console.log("[RAN_PG] sameBundleKey=true sameRowId=true rankParity=true couponParity=true");
    console.log("[RAN_PG] status=SHADOW_TEST_ONLY sourceProvenance=NOT_VERIFIED");
  } finally {
    if (db) {
      try {
        // Sadece testin kendi hash'i; baska tablolara veya satirlara dokunulmaz.
        if (savedKey) await db.ranSnapshotBundle.deleteMany({ where: { bundleKey: savedKey } });
      } finally {
        await db.$disconnect();
      }
    }
    await pg.end();
  }
}
main().catch((e) => {
  console.error("[RAN_PG_ROUNDTRIP] FAIL:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
