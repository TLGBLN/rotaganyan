"use strict";
// ROTAGANYAN PIT train/dev cohort validator — zero DB access, zero writes.
// Works identically on Windows PowerShell 5.1, PS7 and CI, unlike ConvertFrom-Json
// pipeline array counting. Never changes original source/model artifacts.
const fs = require("node:fs");
const path = process.argv[2];
function blocked(message) {
  console.error("[RAN_PIT_DATASET_CHECK] BLOCKED: " + message);
  process.exitCode = 2;
}
try {
  if (!path) throw new Error("dataset file path missing");
  const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("expected a JSON ARRAY of 300 races");
  const train = parsed.filter(r => typeof r?.tarih === "string" &&
    r.tarih >= "2026-08-16" && r.tarih <= "2026-08-25");
  const dev = parsed.filter(r => typeof r?.tarih === "string" &&
    r.tarih >= "2026-08-26" && r.tarih <= "2026-08-28");
  console.log("[RAN_PIT_DATASET_CHECK] total=" + parsed.length +
    " train=" + train.length + " dev=" + dev.length);
  if (parsed.length !== 300 || train.length !== 238 || dev.length !== 62) {
    throw new Error("expected total=300 train=238 dev=62, got " +
      parsed.length + "/" + train.length + "/" + dev.length);
  }
  const ids = new Set();
  for (const r of parsed) {
    if (typeof r?.raceId !== "string" || !r.raceId ||
        !Number.isSafeInteger(r?.winnerNo) || r.winnerNo <= 0 ||
        !Array.isArray(r?.vectors) || r.vectors.length < 3 ||
        !r.vectors.some(v => v?.no === r.winnerNo)) {
      throw new Error("missing race ID, winner or valid field");
    }
    if (ids.has(r.raceId)) throw new Error("duplicate raceId");
    ids.add(r.raceId);
    for (const v of r.vectors) {
      if (v?.raceId !== r.raceId || !Array.isArray(v.signals) ||
          v.signals.length !== 36) {
        throw new Error("noncanonical runner vectors/signals");
      }
    }
  }
  console.log("[RAN_PIT_DATASET_CHECK] PASS: 300 distinct historical races; 238/62 split; 36 signals per runner");
} catch (error) {
  blocked(error instanceof Error ? error.message : "unknown validation failure");
}
