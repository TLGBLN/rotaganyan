import { writeFileSync } from "node:fs";
import { buildFeatureVectorsForRace } from "@/lib/motor-v1/engine/feature-vector";
import { db } from "@/lib/db";

const out = process.argv[2];
const CONTROL_A = "cmv92m7yh003x06jnunvw8ydp";
async function main() {
  const extra = await db.race.findMany({
    where: { id: { not: CONTROL_A }, raceDay: { date: { lt: new Date("2026-10-16") } } },
    orderBy: { raceDay: { date: "desc" } }, take: 2, select: { id: true },
  });
  const ids = [CONTROL_A, ...extra.map((e) => e.id)];
  const result: Record<string, unknown> = {};
  for (const id of ids) {
    const t0 = Date.now();
    const v = await buildFeatureVectorsForRace(id);
    console.error(`RACE ${id} ${Date.now() - t0}ms ${v.length} runners`);
    result[id] = v;
  }
  writeFileSync(out, JSON.stringify(result, null, 1));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
