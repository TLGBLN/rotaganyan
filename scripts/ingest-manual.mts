import { TjkAdapter } from "../src/server/services/ingest/tjk.adapter";
import { persistRaceDays } from "../src/server/services/ingest/base";

const date = new Date("2026-07-05T00:00:00.000Z");
console.log(`Ingesting ${date.toISOString().split("T")[0]}...`);

const adapter = new TjkAdapter();
const raceDays = await adapter.fetchRaceDays(date);

console.log(`Fetched ${raceDays.length} hippodromes:`);
for (const rd of raceDays) console.log(`  ${rd.hippodromeName} — ${rd.races.length} races`);

const result = await persistRaceDays(raceDays);
console.log("Result:", result);
process.exit(0);
