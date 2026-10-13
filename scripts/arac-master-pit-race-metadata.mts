import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

loadEnvConfig(process.cwd());
const { db } = await import("../src/lib/db.ts");

const masterPit = process.argv[2];
if (!masterPit) throw new Error("master-pit path missing");

const runnerRowsPath = path.join(masterPit, "runner-rows.json");
const snapshotsPath = path.join(masterPit, "per-runner-agfsnapshots.json");
const manifestPath = path.join(masterPit, "manifest.json");

const rows = JSON.parse(fs.readFileSync(runnerRowsPath, "utf8"));
const snapshotsByRunner = JSON.parse(fs.readFileSync(snapshotsPath, "utf8"));
const oldManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const raceIds = [...new Set(rows.map((r:any) => r.raceId))];

const races = await db.race.findMany({
  where: { id: { in: raceIds } },
  select: {
    id: true,
    raceNo: true,
    time: true,
    raceDay: {
      select: {
        date: true
      }
    }
  }
});

function sha256(file:string) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function parseRaceTime(raw:any) {
  if (raw == null) return null;
  const s = String(raw).trim();

  const m = s.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] ?? 0);

  if (
    !Number.isInteger(hh) ||
    !Number.isInteger(mm) ||
    !Number.isInteger(ss) ||
    hh < 0 || hh > 23 ||
    mm < 0 || mm > 59 ||
    ss < 0 || ss > 59
  ) return null;

  return { hh, mm, ss };
}

/*
 Turkey is UTC+03:00 throughout the 2026 dataset.
 raceDay.date gives the calendar date.
 Race.time is interpreted as Europe/Istanbul local wall-clock time.
*/
function makeCutoff(dateValue:any, rawTime:any) {
  const p = parseRaceTime(rawTime);
  if (!p) return null;

  const d = new Date(dateValue);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();

  return new Date(
    Date.UTC(y, mo, day, p.hh - 3, p.mm, p.ss, 0)
  );
}

const raceMap = new Map(races.map((r:any) => [r.id, r]));

let timeKnown = 0;
let timeMissing = 0;
let timeParseFail = 0;
let dbRaceMissing = 0;
let raceDateMismatch = 0;

let totalSnapshots = 0;
let preRaceSnapshots = 0;
let postCutoffSnapshots = 0;
let acceptedPostCutoff = 0;

let runnerWithAnySnapshot = 0;
let runnerWith2PlusPre = 0;
let runnerWithKnownCutoff = 0;

const eligibleRaceIds = new Set<string>();
const raceAgg = new Map<string, {
  pre:number;
  post:number;
  runnersWith2:number;
  runnersWithSnapshots:number;
}>();

const rowRaceDate = new Map<string,string>();
for (const row of rows) {
  if (!rowRaceDate.has(row.raceId)) {
    rowRaceDate.set(row.raceId, String(row.raceDate));
  }
}

const metadata:any[] = [];

for (const raceId of raceIds) {
  const race:any = raceMap.get(raceId);

  if (!race) {
    dbRaceMissing++;
    metadata.push({
      raceId,
      raceDate: rowRaceDate.get(raceId) ?? null,
      raceTimeRaw: null,
      cutoffTimestamp: null,
      parseStatus: "DB_RACE_MISSING"
    });
    continue;
  }

  const rawTime = race.time;
  const parsed = parseRaceTime(rawTime);

  let parseStatus = "OK";

  if (rawTime == null || String(rawTime).trim() === "") {
    timeMissing++;
    parseStatus = "TIME_MISSING";
  } else if (!parsed) {
    timeParseFail++;
    parseStatus = "TIME_PARSE_FAIL";
  } else {
    timeKnown++;
  }

  const cutoff = parsed ? makeCutoff(race.raceDay.date, rawTime) : null;

  const datasetDate = rowRaceDate.get(raceId);
  if (datasetDate) {
    const a = new Date(datasetDate).toISOString().slice(0,10);
    const b = new Date(race.raceDay.date).toISOString().slice(0,10);
    if (a !== b) raceDateMismatch++;
  }

  metadata.push({
    raceId,
    raceNo: race.raceNo,
    raceDate: new Date(race.raceDay.date).toISOString(),
    raceTimeRaw: rawTime,
    cutoffTimestamp: cutoff ? cutoff.toISOString() : null,
    timezone: "Europe/Istanbul",
    utcOffset: "+03:00",
    parseStatus,
    agfPreRaceSnapshotCount: 0,
    agfPostCutoffSnapshotCount: 0,
    agfRunnersWith2PlusPreRace: 0
  });
}

const metaMap = new Map(metadata.map(x => [x.raceId, x]));

for (const row of rows) {
  const list:any[] = snapshotsByRunner[row.runnerId] ?? [];
  const meta:any = metaMap.get(row.raceId);

  if (list.length > 0) runnerWithAnySnapshot++;

  if (!meta || !meta.cutoffTimestamp) {
    totalSnapshots += list.length;
    continue;
  }

  runnerWithKnownCutoff++;

  const cutoffMs = Date.parse(meta.cutoffTimestamp);

  let pre = 0;
  let post = 0;

  for (const s of list) {
    totalSnapshots++;

    const ts = Date.parse(s.capturedAt);
    if (!Number.isFinite(ts)) continue;

    if (ts < cutoffMs) {
      pre++;
      preRaceSnapshots++;

      // Strict acceptance rule:
      // accepted snapshot MUST be strictly before cutoff.
      if (ts >= cutoffMs) acceptedPostCutoff++;
    } else {
      post++;
      postCutoffSnapshots++;
    }
  }

  meta.agfPreRaceSnapshotCount += pre;
  meta.agfPostCutoffSnapshotCount += post;

  if (pre >= 2) {
    runnerWith2PlusPre++;
    meta.agfRunnersWith2PlusPreRace++;
    eligibleRaceIds.add(row.raceId);
  }

  const agg = raceAgg.get(row.raceId) ?? {
    pre:0,
    post:0,
    runnersWith2:0,
    runnersWithSnapshots:0
  };

  agg.pre += pre;
  agg.post += post;
  if (pre >= 2) agg.runnersWith2++;
  if (list.length > 0) agg.runnersWithSnapshots++;

  raceAgg.set(row.raceId, agg);
}

metadata.sort((a,b) =>
  String(a.raceDate).localeCompare(String(b.raceDate)) ||
  (a.raceNo ?? 0) - (b.raceNo ?? 0)
);

const metadataPath = path.join(masterPit, "race-metadata.json");
fs.writeFileSync(
  metadataPath,
  JSON.stringify(metadata, null, 2),
  "utf8"
);

const metadataSha = sha256(metadataPath);

const validCutoffs = metadata
  .filter(x => x.cutoffTimestamp)
  .sort((a,b) => a.cutoffTimestamp.localeCompare(b.cutoffTimestamp));

function exampleFor(meta:any) {
  const raceRows = rows.filter((r:any) => r.raceId === meta.raceId);
  const all:any[] = [];

  for (const r of raceRows) {
    for (const s of (snapshotsByRunner[r.runnerId] ?? [])) {
      all.push({
        runnerId: r.runnerId,
        no: r.no,
        capturedAt: s.capturedAt,
        agf: s.agf
      });
    }
  }

  all.sort((a,b) => Date.parse(a.capturedAt)-Date.parse(b.capturedAt));

  const cutoff = Date.parse(meta.cutoffTimestamp);

  const pre = all.filter(x => Date.parse(x.capturedAt) < cutoff);
  const post = all.filter(x => Date.parse(x.capturedAt) >= cutoff);

  return {
    raceId: meta.raceId,
    raceNo: meta.raceNo,
    raceDate: meta.raceDate,
    raceTimeRaw: meta.raceTimeRaw,
    cutoffTimestamp: meta.cutoffTimestamp,
    firstPre: pre[0] ?? null,
    lastPre: pre.at(-1) ?? null,
    firstPost: post[0] ?? null
  };
}

const examples:any[] = [];
if (validCutoffs.length > 0) {
  const candidateIndexes = [
    0,
    Math.floor(validCutoffs.length / 2),
    validCutoffs.length - 1
  ];

  for (const idx of candidateIndexes) {
    const ex = exampleFor(validCutoffs[idx]);
    if (ex) examples.push(ex);
  }
}

const validation = {
  totalRacesRequested: raceIds.length,
  racesFoundInDb: races.length,
  dbRaceMissing,
  raceDateMismatch,

  timeKnown,
  timeMissing,
  timeParseFail,

  totalRunnerRows: rows.length,
  runnerWithKnownCutoff,
  runnerWithAnySnapshot,

  totalAgfSnapshots: totalSnapshots,
  preRaceSnapshots,
  postCutoffSnapshots,

  runnerWith2PlusPreRace: runnerWith2PlusPre,
  runnerCoverage2PlusPct:
    rows.length ? Number((100 * runnerWith2PlusPre / rows.length).toFixed(4)) : 0,

  racesWithAtLeastOneEligibleAgfTrendRunner: eligibleRaceIds.size,
  raceCoveragePct:
    raceIds.length ? Number((100 * eligibleRaceIds.size / raceIds.length).toFixed(4)) : 0,

  acceptedPostCutoffSnapshots: acceptedPostCutoff,

  strictRule: "capturedAt < cutoffTimestamp",
  agfTrendMinimumPreRaceSnapshots: 2,
  timezone: "Europe/Istanbul",
  utcOffset2026: "+03:00",

  examples
};

const manifestV2 = {
  ...oldManifest,

  manifestVersion: 2,

  raceMetadata: {
    file: "race-metadata.json",
    sha256: metadataSha,
    bytes: fs.statSync(metadataPath).size
  },

  pitValidation: validation,

  freeze: {
    frozen: true,
    frozenAt: new Date().toISOString(),
    policy: "No DB history refresh after freeze. Challenger producers must use this frozen bundle only.",
    featureTimeRule: "All historical feature inputs must be strictly before target cutoff.",
    agfRule: "AgfSnapshot.capturedAt < race cutoff timestamp.",
    gallopRule: "Gallop.date < RaceDay.date; same-day gallop excluded.",
    productionChanged: false
  }
};

const manifestV2Path = path.join(masterPit, "manifest-v2.json");
fs.writeFileSync(
  manifestV2Path,
  JSON.stringify(manifestV2, null, 2),
  "utf8"
);

const manifestV2Sha = sha256(manifestV2Path);

console.log("");
console.log("=== MASTER PIT RACE-TIME RESULT ===");
console.log("race-metadata:", metadataPath);
console.log("race-metadata SHA256:", metadataSha);
console.log("");
console.log("Races:", raceIds.length);
console.log("DB found:", races.length);
console.log("DB missing:", dbRaceMissing);
console.log("Race-date mismatch:", raceDateMismatch);
console.log("");
console.log("Time known:", timeKnown);
console.log("Time missing:", timeMissing);
console.log("Time parse-fail:", timeParseFail);
console.log("");
console.log("AGF snapshots total:", totalSnapshots);
console.log("Pre-race:", preRaceSnapshots);
console.log("Post-cutoff:", postCutoffSnapshots);
console.log("ACCEPTED post-cutoff:", acceptedPostCutoff);
console.log("");
console.log("Runner >=2 pre-race:", runnerWith2PlusPre, "/", rows.length,
  "(" + validation.runnerCoverage2PlusPct + "%)");
console.log("Race with >=1 eligible runner:", eligibleRaceIds.size, "/", raceIds.length,
  "(" + validation.raceCoveragePct + "%)");
console.log("");
console.log("manifest-v2:", manifestV2Path);
console.log("manifest-v2 SHA256:", manifestV2Sha);
console.log("");
console.log(
  acceptedPostCutoff === 0
    ? "PIT ASSERTION: PASS"
    : "PIT ASSERTION: FAIL"
);
console.log("MASTER DATASET: FROZEN");

await db.$disconnect();