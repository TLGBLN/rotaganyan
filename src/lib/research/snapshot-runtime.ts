import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import {
  SNAPSHOT_SCHEMA_VERSION,
  RESEARCH_SNAPSHOT_SCHEMA_VERSION,
  buildSourceRefs,
  isResearchSnapshotEnabled,
  maybeCaptureResearchSnapshot,
  selectHistoryRows,
  type PickSnapshotInput,
  type RawHistoryRow,
  type RunInput,
  type SectionalRaw,
  type SnapshotDeps,
} from "./snapshot";
import { parseTjkDate } from "@/lib/tjk-date";

/** Admin tahmin kaydı commit olduktan SONRA çağrılır. Hiçbir koşulda throw etmez.
 * Flag kapalıyken ilk satır döner: hiçbir DB çağrısı yapılmaz. */
export async function runResearchSnapshotHook(predictionId: string, raceId: string): Promise<void> {
  if (!isResearchSnapshotEnabled()) return;
  const t0 = Date.now();
  try {
    const result = await captureForPrediction(predictionId, raceId);
    console.info("RESEARCH_SNAPSHOT_DONE", { predictionId, ms: Date.now() - t0, status: result?.status ?? null, errorCode: result?.errorCode ?? null });
  } catch (e) {
    console.warn("RESEARCH_SNAPSHOT_HOOK_FAILED", { predictionId, ms: Date.now() - t0, error: String(e) });
  }
}

async function captureForPrediction(predictionId: string, raceId: string) {
  const pred = await db.prediction.findUnique({
    where: { id: predictionId },
    select: {
      createdAt: true,
      race: { select: { raceDay: { select: { date: true } } } },
      picks: {
        orderBy: { rank: "asc" },
        select: { id: true, runnerId: true, rank: true, runner: { select: { name: true, tjkAtId: true } } },
      },
    },
  });
  if (!pred) return null;
  const raceDate = pred.race.raceDay.date;
  const picks = pred.picks.filter((k) => k.runner);

  // Toplu okumalar (N+1 yok): önbellek satırları + sectional splitler
  const tjkIds = [...new Set(picks.map((k) => k.runner!.tjkAtId).filter((x): x is number => x != null))];
  const names = [...new Set(picks.map((k) => k.runner!.name))];
  const cacheRows = tjkIds.length
    ? await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIds } }, select: { tjkAtId: true, rowsJson: true } })
    : [];
  const cacheMap = new Map(cacheRows.map((c) => [c.tjkAtId, (c.rowsJson as unknown as RawHistoryRow[]) ?? []]));
  const splitRows = names.length
    ? await db.accuraceHorseSplit.findMany({
        where: { horseName: { in: names }, accuraceRace: { date: { lt: raceDate } } },
        select: {
          horseName: true,
          horseNumber: true,
          checkpoints: true,
          finishTimeReal: true,
          accuraceRace: { select: { date: true, length: true, _count: { select: { splits: true } } } },
        },
      })
    : [];
  const splitsByName = new Map<string, typeof splitRows>();
  for (const s of splitRows) {
    const arr = splitsByName.get(s.horseName) ?? [];
    arr.push(s);
    splitsByName.set(s.horseName, arr);
  }

  const pickInputs: PickSnapshotInput[] = picks.map((k) => {
    const rawRows = k.runner!.tjkAtId != null ? (cacheMap.get(k.runner!.tjkAtId) ?? []) : [];
    const rowsUsed = selectHistoryRows(rawRows, raceDate);
    const available = rawRows.filter((r) => typeof r.date === "string" && (() => { const d = parseTjkDate(r.date as string); return d != null && d.getTime() < raceDate.getTime(); })()).length;
    const items: SectionalRaw[] = (splitsByName.get(k.runner!.name) ?? [])
      .filter((s) => s.accuraceRace.date < raceDate)
      .sort((a, b) => b.accuraceRace.date.getTime() - a.accuraceRace.date.getTime())
      .slice(0, 5)
      .map((s) => ({
        horseName: s.horseName,
        horseNumber: s.horseNumber,
        finishTimeReal: s.finishTimeReal,
        raceLength: s.accuraceRace.length ?? 0,
        splitCount: s.accuraceRace._count.splits,
        checkpoints: s.checkpoints as unknown as SectionalRaw["checkpoints"],
      }));
    const { refsJson, sourceHash } = buildSourceRefs(rowsUsed, items);
    return {
      pickId: k.id,
      predictionId,
      runnerTjkAtId: k.runner!.tjkAtId,
      rowsUsed,
      availableBeforeCutoff: available,
      refsJson,
      sourceHash,
    };
  });

  const engine = ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1];
  const run: RunInput = {
    predictionId,
    raceId,
    engineVersion: engine.versiyon,
    gitCommitHash: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    weightsSemanticHash: null,
    scalerSemanticHash: null,
    predictionAt: pred.createdAt,
    cutoffAt: raceDate,
    expectedPicks: pickInputs.length,
  };

  const deps: SnapshotDeps = {
    insertRun: async (r) => {
      const id = randomUUID();
      // captureNo: aynı tahminin her kaydetmesi yeni bir sürüm (tahmin pick'leri silinip yeniden yazılabiliyor)
      await db.$executeRaw`INSERT INTO "ResearchSnapshotRun" ("id","predictionId","captureNo","raceId","engineVersion","gitCommitHash","weightsSemanticHash","scalerSemanticHash","featureSchemaVersion","snapshotSchemaVersion","predictionAt","cutoffAt","expectedPicks","writtenPicks","expectedHistoryRows","capturedHistoryRows","status","errorCode") VALUES (${id}, ${r.predictionId}, (SELECT COALESCE(MAX("captureNo"), 0) + 1 FROM "ResearchSnapshotRun" WHERE "predictionId" = ${r.predictionId}), ${r.raceId}, ${r.engineVersion}, ${r.gitCommitHash}, ${r.weightsSemanticHash}, ${r.scalerSemanticHash}, ${RESEARCH_SNAPSHOT_SCHEMA_VERSION}, ${SNAPSHOT_SCHEMA_VERSION}, ${r.predictionAt}, ${r.cutoffAt}, ${r.expectedPicks}, 0, 0, 0, ${r.status}, NULL)`;
      return id;
    },
    insertPick: async (runId, p) => {
      const id = randomUUID();
      await db.$executeRaw`INSERT INTO "ResearchPickSnapshot" ("id","runId","pickId","predictionId","runnerTjkAtId","historyRowsJson","availableBeforeCutoff","sourceRefsJson","sourceHash","featureSchemaVersion","snapshotSchemaVersion") VALUES (${id}, ${runId}, ${p.pickId}, ${p.predictionId}, ${p.runnerTjkAtId}, ${JSON.stringify(p.rowsUsed)}::jsonb, ${p.availableBeforeCutoff}, ${p.refsJson}::jsonb, ${p.sourceHash}, ${RESEARCH_SNAPSHOT_SCHEMA_VERSION}, ${SNAPSHOT_SCHEMA_VERSION})`;
    },
    updateRun: async (runId, f) => {
      await db.$executeRaw`UPDATE "ResearchSnapshotRun" SET "writtenPicks" = ${f.writtenPicks}, "expectedHistoryRows" = ${f.expectedHistoryRows}, "capturedHistoryRows" = ${f.capturedHistoryRows}, "status" = ${f.status}, "errorCode" = ${f.errorCode} WHERE "id" = ${runId}`;
    },
    log: (event, detail) => console.warn(event, detail),
  };

  return maybeCaptureResearchSnapshot(true, run, pickInputs, deps);
}
