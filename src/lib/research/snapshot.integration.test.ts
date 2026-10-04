import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

// Yerel entegrasyon testi: yalnız 127.0.0.1:5433/rota_test üzerinde çalışır.
// RESEARCH_IT_DB verilmeden normal test koşusunda atlanır.
const IT_URL = process.env.RESEARCH_IT_DB ?? "";
const RUN_IT = IT_URL.includes("127.0.0.1:5433/rota_test");

vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ user: { id: "it-author" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const DAY = new Date("2026-08-01T00:00:00Z");
const DAY_ID = "it-day";
const HIP_ID = "it-hip";
const RACE_KEYS = ["A", "B", "C", "D", "E", "F", "Z"] as const;
const DEBUTANT_ONLY = "Z";

type Db = typeof import("@/lib/db")["db"];
let db: Db;
let upsertPrediction: typeof import("@/server/actions/prediction.actions")["upsertPrediction"];
let runHook: typeof import("@/lib/research/snapshot-runtime")["runResearchSnapshotHook"];

const raceId = (k: string) => `it-race-${k}`;
const raceIdx = (k: string) => RACE_KEYS.indexOf(k as (typeof RACE_KEYS)[number]);
const runnerCount = (k: string) => (k === DEBUTANT_ONLY ? 3 : 6);
const tjkFor = (k: string, i: number) => 90000 + raceIdx(k) * 100 + i;
const HISTORY_DATES = ["15.07.2026", "08.07.2026", "01.07.2026", "24.06.2026", "10.06.2026"];

function historyRows(i: number) {
  const rows = HISTORY_DATES.map((date) => ({ date, finishPos: "1", hp: "50", classType: "H", distance: 1400, surface: "Çim", weight: "55" }));
  if (i === 1) rows.push({ date: "01.08.2026", finishPos: "2", hp: "50", classType: "H", distance: 1400, surface: "Çim", weight: "55" });
  return rows;
}

function makePicks(k: string) {
  return Array.from({ length: runnerCount(k) }, (_, idx) => {
    const i = idx + 1;
    return {
      rank: i,
      runnerId: `it-r-${k}-${i}`,
      runnerLabel: `${i} IT ${k}${i}`,
      score: 100 - i * 5,
      scoreExact: 100 - i * 5 + 0.25,
      details: [],
      pedigreeRating: "ORTA" as const,
      isTarget: false,
    };
  });
}

function saveInput(k: string) {
  return { raceId: raceId(k), confidence: "ORTA" as const, notes: `it ${k}`, isBanko: false, picks: makePicks(k) };
}

async function dumpPrediction(k: string) {
  const p = await db.prediction.findUnique({ where: { raceId: raceId(k) }, include: { picks: { orderBy: { rank: "asc" } } } });
  if (!p) return null;
  return {
    published: p.published,
    confidence: p.confidence,
    notes: p.notes,
    isBanko: p.isBanko,
    couponNarrow: p.couponNarrow,
    couponNormal: p.couponNormal,
    couponWide: p.couponWide,
    picks: p.picks.map((k2) => ({
      rank: k2.rank,
      runnerId: k2.runnerId,
      runnerLabel: k2.runnerLabel,
      score: k2.score,
      scoreExact: k2.scoreExact,
      isTarget: k2.isTarget,
      details: k2.details,
      pedigreeRating: k2.pedigreeRating,
      probTop2: k2.probTop2,
      probTop3: k2.probTop3,
      marketBlindProb1: k2.marketBlindProb1,
      featureSnapshot: k2.featureSnapshot,
    })),
  };
}

async function predictionIdOf(k: string): Promise<string> {
  const p = await db.prediction.findUnique({ where: { raceId: raceId(k) }, select: { id: true } });
  if (!p) throw new Error(`prediction yok: ${k}`);
  return p.id;
}

type RunRow = {
  id: string;
  captureNo: number;
  status: string;
  writtenPicks: number;
  expectedPicks: number;
  expectedHistoryRows: number;
  capturedHistoryRows: number;
  errorCode: string | null;
  snapshotSchemaVersion: number;
};

async function runsFor(predictionId: string): Promise<RunRow[]> {
  return db.$queryRaw<RunRow[]>`SELECT "id","captureNo","status","writtenPicks","expectedPicks","expectedHistoryRows","capturedHistoryRows","errorCode","snapshotSchemaVersion" FROM "ResearchSnapshotRun" WHERE "predictionId" = ${predictionId} ORDER BY "captureNo"`;
}

async function pickSnapshotCount(runId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "ResearchPickSnapshot" WHERE "runId" = ${runId}`;
  return rows[0].n;
}

async function faultTjk(k: string, idxs: number[]) {
  for (const i of idxs) {
    await db.$executeRaw`INSERT INTO it_fault (kind, key) VALUES ('tjk', ${String(tjkFor(k, i))}) ON CONFLICT DO NOTHING`;
  }
}

async function faultRun(predictionId: string) {
  await db.$executeRaw`INSERT INTO it_fault (kind, key) VALUES ('run', ${predictionId}) ON CONFLICT DO NOTHING`;
}

async function clearFaults() {
  await db.$executeRaw`DELETE FROM it_fault`;
}

async function cleanupData() {
  await db.$executeRaw`DELETE FROM "ResearchPickSnapshot" WHERE "predictionId" IN (SELECT "id" FROM "Prediction" WHERE "raceId" LIKE 'it-race-%')`;
  await db.$executeRaw`DELETE FROM "ResearchSnapshotRun" WHERE "raceId" LIKE 'it-race-%'`;
  await db.raceDay.deleteMany({ where: { id: DAY_ID } });
  await db.horseRaceHistoryCache.deleteMany({ where: { tjkAtId: { gte: 90000, lt: 91000 } } });
}

async function seed() {
  await db.user.upsert({
    where: { id: "it-author" },
    create: { id: "it-author", email: "it-author@test.local", name: "IT" },
    update: {},
  });
  await db.hippodrome.upsert({
    where: { id: HIP_ID },
    create: { id: HIP_ID, name: "IT Hipodrom", slug: "it-hip" },
    update: {},
  });
  await db.raceDay.create({ data: { id: DAY_ID, date: DAY, hippodromeId: HIP_ID } });
  for (const k of RACE_KEYS) {
    await db.race.create({
      data: { id: raceId(k), raceDayId: DAY_ID, raceNo: raceIdx(k) + 1, classType: "Handikap", breed: "ARAP", surface: "CIM", distance: 1400 },
    });
    for (let i = 1; i <= runnerCount(k); i++) {
      await db.runner.create({
        data: { id: `it-r-${k}-${i}`, raceId: raceId(k), no: i, name: `IT ${k}${i}`, startNo: i, tjkAtId: tjkFor(k, i) },
      });
      if (k !== DEBUTANT_ONLY && i <= 5) {
        await db.horseRaceHistoryCache.create({ data: { tjkAtId: tjkFor(k, i), rowsJson: historyRows(i) } });
      }
    }
  }
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function snapshotDone(): Array<Record<string, unknown>> {
  return infoSpy.mock.calls.filter((c: unknown[]) => c[0] === "RESEARCH_SNAPSHOT_DONE").map((c: unknown[]) => c[1] as Record<string, unknown>);
}

function insertFailedCount(): number {
  return warnSpy.mock.calls.filter((c: unknown[]) => c[0] === "RESEARCH_RUN_INSERT_FAILED").length;
}

function setFlag(on: boolean) {
  if (on) process.env.RESEARCH_SNAPSHOT_ENABLED = "true";
  else delete process.env.RESEARCH_SNAPSHOT_ENABLED;
}

describe.skipIf(!RUN_IT)("research snapshot — yerel entegrasyon (rota_test)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = IT_URL;
    db = (await import("@/lib/db")).db;
    upsertPrediction = (await import("@/server/actions/prediction.actions")).upsertPrediction;
    runHook = (await import("@/lib/research/snapshot-runtime")).runResearchSnapshotHook;

    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS it_fault (kind text NOT NULL, key text NOT NULL, PRIMARY KEY (kind, key))`);
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION it_fault_pick_fn() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN
        IF EXISTS (SELECT 1 FROM it_fault WHERE kind = 'tjk' AND key = NEW."runnerTjkAtId"::text) THEN RAISE EXCEPTION 'IT_FAULT_PICK'; END IF;
        RETURN NEW;
      END $f$`);
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION it_fault_run_fn() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN
        IF EXISTS (SELECT 1 FROM it_fault WHERE kind = 'run' AND key = NEW."predictionId") THEN RAISE EXCEPTION 'IT_FAULT_RUN'; END IF;
        RETURN NEW;
      END $f$`);
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fault_pick ON "ResearchPickSnapshot"`);
    await db.$executeRawUnsafe(`CREATE TRIGGER it_fault_pick BEFORE INSERT ON "ResearchPickSnapshot" FOR EACH ROW EXECUTE FUNCTION it_fault_pick_fn()`);
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fault_run ON "ResearchSnapshotRun"`);
    await db.$executeRawUnsafe(`CREATE TRIGGER it_fault_run BEFORE INSERT ON "ResearchSnapshotRun" FOR EACH ROW EXECUTE FUNCTION it_fault_run_fn()`);

    await clearFaults();
    await cleanupData();
    await seed();
  }, 120000);

  afterAll(async () => {
    await clearFaults();
    await cleanupData();
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fault_pick ON "ResearchPickSnapshot"`);
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fault_run ON "ResearchSnapshotRun"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS it_fault_pick_fn()`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS it_fault_run_fn()`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS it_fault`);
    setFlag(false);
    await db.$disconnect();
  }, 120000);

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await clearFaults();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("flag OFF: admin save hook'tan hiç DB çağrısı yapmaz ve research tablolarına yazmaz", async () => {
    setFlag(false);
    const rawSpy = vi.spyOn(db, "$executeRaw");
    await upsertPrediction(saveInput("F"));
    expect(rawSpy).not.toHaveBeenCalled();
    rawSpy.mockRestore();
    const pid = await predictionIdOf("F");
    expect(await runsFor(pid)).toHaveLength(0);
    expect(snapshotDone()).toHaveLength(0);
  });

  it("flag OFF ve flag ON aynı kaydı üretir: prediction ve pick içeriği birebir aynı", async () => {
    setFlag(false);
    await upsertPrediction(saveInput("E"));
    const off = await dumpPrediction("E");
    setFlag(true);
    await upsertPrediction(saveInput("E"));
    const on = await dumpPrediction("E");
    setFlag(false);
    expect(on).toEqual(off);
    expect(off?.picks).toHaveLength(6);
  });

  it("flag ON PASS: tüm pick'ler yazılır, coverage doğru, debutant dahil", async () => {
    setFlag(true);
    await upsertPrediction(saveInput("A"));
    setFlag(false);
    const pid = await predictionIdOf("A");
    const runs = await runsFor(pid);
    expect(runs).toHaveLength(1);
    const r = runs[0];
    expect(r.status).toBe("PASS");
    expect(r.captureNo).toBe(1);
    expect(r.expectedPicks).toBe(6);
    expect(r.writtenPicks).toBe(6);
    expect(r.expectedHistoryRows).toBe(25);
    expect(r.capturedHistoryRows).toBe(25);
    expect(r.errorCode).toBeNull();
    expect(r.snapshotSchemaVersion).toBe(2);
    expect(await pickSnapshotCount(r.id)).toBe(6);
    const done = snapshotDone().at(-1);
    expect(done?.status).toBe("PASS");
  });

  it("flag ON PARTIAL: bazı pick insert'leri fail ederse prediction kaydı yine başarılı, run PARTIAL", async () => {
    setFlag(true);
    await faultTjk("B", [1, 2]);
    await expect(upsertPrediction(saveInput("B"))).resolves.toBeDefined();
    await clearFaults();
    setFlag(false);
    const dump = await dumpPrediction("B");
    expect(dump?.picks).toHaveLength(6);
    const runs = await runsFor(await predictionIdOf("B"));
    expect(runs[0].status).toBe("PARTIAL");
    expect(runs[0].writtenPicks).toBe(4);
    expect(runs[0].expectedPicks).toBe(6);
    expect(runs[0].errorCode).toBe("PICK_INSERT_PARTIAL");
  });

  it("flag ON FAILED: tüm pick insert'leri fail ederse run FAILED, prediction yine kayıtlı", async () => {
    setFlag(true);
    await faultTjk("C", [1, 2, 3, 4, 5, 6]);
    await expect(upsertPrediction(saveInput("C"))).resolves.toBeDefined();
    await clearFaults();
    setFlag(false);
    expect((await dumpPrediction("C"))?.picks).toHaveLength(6);
    const runs = await runsFor(await predictionIdOf("C"));
    expect(runs[0].status).toBe("FAILED");
    expect(runs[0].writtenPicks).toBe(0);
    expect(runs[0].errorCode).toBe("PICK_INSERT_PARTIAL");
  });

  it("run insert fail ederse hook fail-open: tahmin etkilenmez, RUN_NOT_WRITTEN loglanır", async () => {
    setFlag(false);
    await upsertPrediction(saveInput("D"));
    const pid = await predictionIdOf("D");
    const before = await dumpPrediction("D");
    await faultRun(pid);
    setFlag(true);
    await expect(runHook(pid, raceId("D"))).resolves.toBeUndefined();
    setFlag(false);
    await clearFaults();
    expect(await dumpPrediction("D")).toEqual(before);
    expect(await runsFor(pid)).toHaveLength(0);
    expect(insertFailedCount()).toBe(1);
  });

  it("re-save: aynı predictionId için ikinci run captureNo=2 olur, ilk run değişmez", async () => {
    setFlag(true);
    await upsertPrediction(saveInput("A"));
    setFlag(false);
    const pid = await predictionIdOf("A");
    const runs = await runsFor(pid);
    expect(runs.map((r) => r.captureNo)).toEqual([1, 2]);
    expect(runs[0].writtenPicks).toBe(6);
    expect(await pickSnapshotCount(runs[0].id)).toBe(6);
    expect(await pickSnapshotCount(runs[1].id)).toBe(6);
    expect(runs[0].id).not.toBe(runs[1].id);
  });

  it("debutant / 0-history: tüm koşu geçmişsiz ise expectedHistoryRows=0 ve PASS", async () => {
    setFlag(true);
    await upsertPrediction(saveInput(DEBUTANT_ONLY));
    setFlag(false);
    const runs = await runsFor(await predictionIdOf(DEBUTANT_ONLY));
    expect(runs[0].status).toBe("PASS");
    expect(runs[0].expectedPicks).toBe(3);
    expect(runs[0].writtenPicks).toBe(3);
    expect(runs[0].expectedHistoryRows).toBe(0);
    expect(runs[0].capturedHistoryRows).toBe(0);
  });

  it("eşzamanlı hook çağrıları (aynı tahmin): captureNo çakışması prediction'ı etkilemez", async () => {
    setFlag(true);
    await upsertPrediction(saveInput("A"));
    const pid = await predictionIdOf("A");
    const picksBefore = (await db.pick.findMany({ where: { predictionId: pid }, select: { id: true } })).map((p) => p.id).sort();
    const failsBefore = insertFailedCount();
    const ROUNDS = 10;
    for (let round = 0; round < ROUNDS; round++) {
      await Promise.all([runHook(pid, raceId("A")), runHook(pid, raceId("A"))]);
    }
    setFlag(false);
    const failsAfter = insertFailedCount() - failsBefore;
    const runs = await runsFor(pid);
    const picksAfter = (await db.pick.findMany({ where: { predictionId: pid }, select: { id: true } })).map((p) => p.id).sort();
    console.log(`CONCURRENCY hook-pairs=${ROUNDS} run-insert-failures=${failsAfter} totalRuns=${runs.length} captureNos=${runs.map((r) => r.captureNo).join(",")}`);
    expect(picksAfter).toEqual(picksBefore);
    expect(new Set(runs.map((r) => r.captureNo)).size).toBe(runs.length);
  });

  it("eşzamanlı admin save: flag OFF ve ON için sonuç karşılaştırması", async () => {
    const ROUNDS = 5;
    const outcomes: Record<string, { ok: number; err: number; finalPicks: number[]; predictionCount: number }> = {};
    for (const flag of [false, true]) {
      setFlag(flag);
      await upsertPrediction(saveInput("F"));
      let ok = 0;
      let err = 0;
      for (let round = 0; round < ROUNDS; round++) {
        const results = await Promise.allSettled([upsertPrediction(saveInput("F")), upsertPrediction(saveInput("F"))]);
        ok += results.filter((r) => r.status === "fulfilled").length;
        err += results.filter((r) => r.status === "rejected").length;
      }
      setFlag(false);
      const pred = await dumpPrediction("F");
      const count = await db.prediction.count({ where: { raceId: raceId("F") } });
      outcomes[flag ? "flagOn" : "flagOff"] = { ok, err, finalPicks: [pred?.picks.length ?? 0], predictionCount: count };
    }
    console.log(`CONC-SAVE ${JSON.stringify(outcomes)}`);
    expect(outcomes.flagOn.predictionCount).toBe(1);
    expect(outcomes.flagOn.finalPicks[0]).toBe(6);
  });

  it("round-trip sayımı: flag ON bir admin save snapshot için tek yazım ifadesi kullanır", async () => {
    setFlag(true);
    const raw = vi.spyOn(db, "$executeRaw");
    const reads = [
      vi.spyOn(db.prediction, "findUnique"),
      vi.spyOn(db.horseRaceHistoryCache, "findMany"),
      vi.spyOn(db.accuraceHorseSplit, "findMany"),
    ];
    await upsertPrediction(saveInput("D"));
    setFlag(false);
    const snapshotWrites = raw.mock.calls.filter((c) => typeof c[0] === "object" && Array.isArray(c[0]) && c[0].join("").includes("ResearchSnapshotRun")).length;
    const snapshotReads = reads.map((r) => r.mock.calls.length);
    raw.mockRestore();
    reads.forEach((r) => r.mockRestore());
    console.log(`ROUNDTRIPS snapshotWrites=${snapshotWrites} hookReads(prediction,cache,split)=${snapshotReads.join(",")}`);
    expect(snapshotWrites).toBe(1);
  });

  it("latency: admin save süresi flag OFF vs ON (yerel DB, 10 tekrar, medyan)", async () => {
    const N = 10;
    const time = async (flag: boolean) => {
      setFlag(flag);
      const xs: number[] = [];
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        await upsertPrediction(saveInput("F"));
        xs.push(performance.now() - t0);
      }
      setFlag(false);
      xs.sort((a, b) => a - b);
      return { median: xs[Math.floor(N / 2)], p90: xs[Math.floor(N * 0.9)] };
    };
    await time(false);
    const off = await time(false);
    const on = await time(true);
    console.log(`LATENCY off=${off.median.toFixed(1)}ms(p90 ${off.p90.toFixed(1)}) on=${on.median.toFixed(1)}ms(p90 ${on.p90.toFixed(1)}) delta=${(on.median - off.median).toFixed(1)}ms`);
    expect(on.median).toBeGreaterThan(0);
  });
}, 120000);
