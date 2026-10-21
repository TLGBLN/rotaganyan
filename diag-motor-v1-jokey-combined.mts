import { db } from "@/lib/db";
import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import {
  computeJokeySon30Form,
  computeJokeyUzunDonem,
  computeJokeyAtUyumu,
  computeJokeyStilUyumu,
} from "@/lib/motor-v1/features/jokey";
import { createFieldSizeResolver } from "@/lib/motor-v1/features/history-source";
import { PLACEHOLDER_HALF_LIFE_DAYS } from "@/lib/motor-v1/features/common";
import type { TargetRace } from "@/lib/accurace/types";

const RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1
const CUTOFF = new Date("2026-10-16T00:00:00.000Z");

async function main() {
  const race = await db.race.findUnique({
    where: { id: RACE_ID },
    select: { surface: true, distance: true, raceDay: { select: { date: true } } },
  });
  if (!race) throw new Error("yarış bulunamadı");
  const target: TargetRace = { date: race.raceDay.date, length: race.distance, surface: race.surface };

  const runners = await db.runner.findMany({
    where: { raceId: RACE_ID, scratched: false },
    select: { no: true, name: true, jockey: true, tjkAtId: true },
  });
  console.log("Saha:", runners.map((r) => `${r.no}:${r.name} (jokey=${r.jockey})`).join(" | "));

  const tempoCtx = await loadTempoContext();

  const horses = runners.filter((r) => ["SHIMMER", "SECRET OF DRAGON"].includes(r.name));
  for (const h of horses) {
    console.log(`\n==============================\n${h.name} — jokey: ${h.jockey}\n------------------------------`);
    const [son30, uzun, atUyum, stilUyum] = await Promise.all([
      computeJokeySon30Form(h.jockey, CUTOFF),
      computeJokeyUzunDonem(h.jockey, CUTOFF),
      computeJokeyAtUyumu(
        h.tjkAtId,
        h.jockey,
        (await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: h.tjkAtId! } }))?.rowsJson ?? [],
        CUTOFF,
        PLACEHOLDER_HALF_LIFE_DAYS,
        createFieldSizeResolver()
      ),
      computeJokeyStilUyumu(h.jockey, h.tjkAtId, target, tempoCtx),
    ]);
    console.log("JOKEY_01 son-30-gün:", son30);
    console.log("JOKEY_02 uzun-dönem:", { ...uzun, bySurface: uzun?.bySurface });
    console.log("JOKEY_03 at-jokey uyumu:", atUyum);
    console.log("JOKEY_04 stil uyumu:", stilUyum);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
