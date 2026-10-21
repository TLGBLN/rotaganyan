import { db } from "./src/lib/db";
import { hedefPistRejimi } from "./src/lib/motor-v1/features/pist-durum-01";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

async function main() {
  const now = new Date();

  const from = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1
  ));

  const until = new Date(from.getTime() + 9 * 86400000);

  const races = await db.race.findMany({
    where: {
      result: { is: null },
      raceDay: {
        date: { gte: from, lt: until }
      }
    },
    select: {
      id: true,
      raceNo: true,
      time: true,
      surface: true,
      raceDay: {
        select: {
          date: true,
          surfaceConditions: true,
          hippodrome: {
            select: { name: true }
          }
        }
      }
    }
  });

  const root = resolve(
    "src/lib/motor-v1/artifacts/going-snapshots"
  );

  const labels = {
    CIM: "Çim",
    KUM: "Kum",
    SENTETIK: "Sentetik"
  } as const;

  let written = 0;
  let missingGoing = 0;
  let skippedTime = 0;
  let alreadyExists = 0;

  for (const r of races) {
    if (
      r.surface !== "CIM" &&
      r.surface !== "KUM" &&
      r.surface !== "SENTETIK"
    ) continue;

    const match = /^(\d{1,2}):([0-5]\d)$/.exec(
      r.time?.trim() ?? ""
    );

    if (!match || Number(match[1]) > 23) {
      skippedTime++;
      continue;
    }

    const d = r.raceDay.date;

    // Türkiye yerel yarış saati: UTC+3.
    const raceStartMs = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      Number(match[1]) - 3,
      Number(match[2])
    );

    // Yarış başlangıcına en az 5 dakika kalmalı.
    const capturedAt = new Date();

    if (capturedAt.getTime() >= raceStartMs - 300000) {
      skippedTime++;
      continue;
    }

    const raw = r.raceDay.surfaceConditions;

    const conditions = (Array.isArray(raw) ? raw : [])
      .flatMap(x => {
        if (!x || typeof x !== "object" ||
            Array.isArray(x)) return [];

        const obj = x as {
          label?: unknown;
          detail?: unknown;
        };

        return typeof obj.label === "string" &&
          typeof obj.detail === "string"
          ? [{ label: obj.label, detail: obj.detail }]
          : [];
      });

    const regime = hedefPistRejimi(
      r.surface,
      conditions
    );

    const matches = conditions.filter(c =>
      c.label.trim().toLocaleLowerCase("tr-TR") ===
      labels[r.surface].toLocaleLowerCase("tr-TR")
    );

    if (regime == null || matches.length !== 1) {
      missingGoing++;
      continue;
    }

    const payload = {
      version: 1,
      raceId: r.id,
      raceNo: r.raceNo,
      hippodrome: r.raceDay.hippodrome.name,
      surface: r.surface,
      rawGoing: matches[0].detail,
      regime,
      capturedAt: capturedAt.toISOString(),
      scheduledRaceStartUtc:
        new Date(raceStartMs).toISOString(),
      source: "RaceDay.surfaceConditions",
      sourceOriginalTimestampAvailable: false
    };

    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    const folder = join(root, r.id);
    mkdirSync(folder, { recursive: true });

    const filename =
      capturedAt.toISOString().replace(/[-:.]/g, "") +
      ".json";

    const filepath = join(folder, filename);

    try {
      writeFileSync(
        filepath,
        JSON.stringify({
          payload,
          sha256: hash
        }, null, 2) + "\n",
        { encoding: "utf8", flag: "wx" }
      );

      written++;

      console.log("V1_GOING_CAPTURED", JSON.stringify({
        raceId: r.id,
        raceNo: r.raceNo,
        capturedAt: payload.capturedAt,
        going: payload.rawGoing,
        regime
      }));
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === "EEXIST"
      ) {
        alreadyExists++;
        continue;
      }

      throw e;
    }
  }

  console.log("V1_GOING_CAPTURE_SUMMARY", JSON.stringify({
    upcomingCandidates: races.length,
    written,
    missingGoing,
    skippedTime,
    alreadyExists,
    outputDirectory: root
  }));

  console.log("V1_GOING_CAPTURE_PASS");
}

main().catch(e => {
  console.error("V1_GOING_CAPTURE_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});