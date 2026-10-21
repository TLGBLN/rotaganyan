import { db } from "./src/lib/db";
import { createFieldSizeResolver } from "./src/lib/motor-v1/features/history-source";
import { buildGoingHistory } from "./src/lib/motor-v1/features/pist-durum-history";
import { computePistDurum01 } from "./src/lib/motor-v1/features/pist-durum-score";
import { parsePistRejimi } from "./src/lib/motor-v1/features/pist-durum-01";
import {
  existsSync, readdirSync, readFileSync, statSync
} from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(
  "src/lib/motor-v1/artifacts/going-snapshots"
);

async function main() {
  if (!existsSync(root)) {
    throw new Error("Snapshot klasoru bulunamadi");
  }

  const files = readdirSync(root, { withFileTypes: true })
    .filter(x => x.isDirectory())
    .flatMap(x => readdirSync(join(root, x.name))
      .filter(f => f.endsWith(".json"))
      .map(f => join(root, x.name, f)));

  const resolver = createFieldSizeResolver();

  let verifiedFiles = 0;
  let rejectedFiles = 0;
  let horses = 0;
  let observed = 0;
  let missingHistory = 0;
  let insufficient = 0;
  let skippedResolver = 0;

  for (const file of files) {
    try {
      const record = JSON.parse(readFileSync(file, "utf8"));
      const p = record.payload;

      if (!p || typeof record.sha256 !== "string") {
        throw new Error("INVALID_FORMAT");
      }

      const digest = createHash("sha256")
        .update(JSON.stringify(p))
        .digest("hex");

      if (digest !== record.sha256) {
        throw new Error("HASH_MISMATCH");
      }

      if (
        p.version !== 1 ||
        p.source !== "RaceDay.surfaceConditions" ||
        p.raceId !== basename(dirname(file)) ||
        !["CIM", "KUM", "SENTETIK"].includes(p.surface) ||
        parsePistRejimi(p.rawGoing) !== p.regime
      ) throw new Error("INVALID_PAYLOAD");

      const captureMs = Date.parse(p.capturedAt);
      const startMs = Date.parse(p.scheduledRaceStartUtc);
      const stat = statSync(file);

      if (
        !Number.isFinite(captureMs) ||
        !Number.isFinite(startMs) ||
        captureMs >= startMs - 300000 ||
        Math.abs(stat.birthtimeMs - captureMs) > 120000 ||
        stat.mtimeMs >= startMs
      ) throw new Error("LOCAL_TIMING_NOT_VERIFIED");

      const race = await db.race.findUnique({
        where: { id: p.raceId },
        select: {
          raceNo: true,
          time: true,
          surface: true,
          raceDay: { select: { date: true } },
          runners: {
            where: { scratched: false },
            select: {
              no: true,
              name: true,
              tjkAtId: true
            }
          }
        }
      });

      if (!race) throw new Error("RACE_NOT_FOUND");

      const timeMatch = /^(\d{1,2}):([0-5]\d)$/.exec(
        race.time?.trim() ?? ""
      );

      if (!timeMatch) throw new Error("INVALID_RACE_TIME");

      const d = race.raceDay.date;
      const currentStart = Date.UTC(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        Number(timeMatch[1]) - 3, Number(timeMatch[2])
      );

      if (
        race.raceNo !== p.raceNo ||
        race.surface !== p.surface ||
        currentStart !== startMs
      ) throw new Error("RACE_CONTEXT_CHANGED");

      verifiedFiles++;

      const ids = race.runners.flatMap(r =>
        r.tjkAtId == null ? [] : [r.tjkAtId]
      );

      const caches = await db.horseRaceHistoryCache.findMany({
        where: { tjkAtId: { in: ids } },
        select: { tjkAtId: true, rowsJson: true }
      });

      const historyById = new Map(
        caches.map(x => [x.tjkAtId, x.rowsJson])
      );

      let raceObserved = 0;
      let raceInsufficient = 0;

      for (const runner of race.runners) {
        horses++;

        if (runner.tjkAtId == null ||
            !historyById.has(runner.tjkAtId)) {
          missingHistory++;
          continue;
        }

        const historical = await buildGoingHistory(
          historyById.get(runner.tjkAtId),
          d,
          resolver
        );

        skippedResolver += historical.diagnostics.skippedResolver;

        // Yalnizca deneysel yerel snapshot:
        // bagimsiz degistirilemez arsiv kaniti degildir.
        const score = computePistDurum01({
          raceStart: p.scheduledRaceStartUtc,
          surface: p.surface,
          going: p.rawGoing,
          goingCapturedAt: p.capturedAt,
          immutablePreRaceSnapshot: true,
        }, historical.history);

        if (score.value != null) {
          observed++;
          raceObserved++;
        } else {
          insufficient++;
          raceInsufficient++;
        }
      }

      console.log("V1_GOING_SHADOW_RACE", JSON.stringify({
        raceId: p.raceId,
        runners: race.runners.length,
        observed: raceObserved,
        insufficient: raceInsufficient,
        regime: p.regime,
        evidence: "LOCAL_PROVISIONAL"
      }));

    } catch (error) {
      rejectedFiles++;
      console.log("V1_GOING_SHADOW_REJECTED", JSON.stringify({
        file: basename(file),
        reason: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  console.log("V1_GOING_SHADOW_SUMMARY", JSON.stringify({
    files: files.length,
    verifiedFiles,
    rejectedFiles,
    horses,
    observed,
    missingHistory,
    insufficient,
    skippedResolver,
    status: "RESEARCH_ONLY_NOT_TRAINED"
  }));

  console.log("V1_GOING_SHADOW_PASS");
}

main().catch(e => {
  console.error("V1_GOING_SHADOW_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});