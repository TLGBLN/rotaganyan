import { db } from "./src/lib/db";

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

function historyDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;

  const date = new Date(Date.UTC(
    Number(m[3]), Number(m[2]) - 1, Number(m[1])
  ));

  const result = date.toISOString().slice(0, 10);

  return result ===
    `${m[3]}-${m[2]}-${m[1]}` ? result : null;
}

const distance = (s: unknown): number | null => {
  const m = String(s ?? "").match(/\d{3,4}/);
  return m ? Number(m[0]) : null;
};

async function main() {
  const races = await db.race.findMany({
    where: { result: { isNot: null } },
    orderBy: [
      { raceDay: { date: "desc" } },
      { raceNo: "asc" }
    ],
    take: 12,
    select: {
      runners: {
        where: {
          scratched: false,
          tjkAtId: { not: null }
        },
        select: {
          name: true,
          tjkAtId: true
        }
      }
    }
  });

  const horses = new Map<number, string>();

  for (const race of races) {
    for (const horse of race.runners) {
      if (horse.tjkAtId != null) {
        horses.set(horse.tjkAtId, horse.name);
      }
    }
  }

  const ids = [...horses.keys()];

  const [caches, archives] = await Promise.all([
    db.horseRaceHistoryCache.findMany({
      where: { tjkAtId: { in: ids } },
      select: { tjkAtId: true, rowsJson: true }
    }),

    db.tjkDereceKaydi.findMany({
      select: {
        atAdi: true,
        tarih: true,
        hipodrom: true,
        pist: true,
        pistDurumu: true,
        mesafe: true
      }
    })
  ]);

  const archiveByKey = new Map<string, typeof archives>();

  for (const row of archives) {
    if (!row.tarih) continue;

    const key = `${norm(row.atAdi)}|${
      row.tarih.toISOString().slice(0, 10)
    }`;

    const group = archiveByKey.get(key) ?? [];
    group.push(row);
    archiveByKey.set(key, group);
  }

  let historicalRows = 0;
  let validDates = 0;
  let nameDateFound = 0;
  let nameDateUnique = 0;
  let strictUnique = 0;
  let strictMultiple = 0;
  let strictMissing = 0;

  const surfaceExamples = new Set<string>();
  const cityExamples = new Set<string>();

  for (const cache of caches) {
    const name = horses.get(cache.tjkAtId);
    if (!name || !Array.isArray(cache.rowsJson)) continue;

    for (const raw of cache.rowsJson) {
      if (!raw || typeof raw !== "object") continue;

      const row = raw as Record<string, unknown>;
      historicalRows++;

      const date = historyDate(row.date);
      if (!date) continue;

      validDates++;

      if (surfaceExamples.size < 12) {
        surfaceExamples.add(String(row.surface ?? ""));
      }

      if (cityExamples.size < 8) {
        cityExamples.add(String(row.city ?? ""));
      }

      const candidates = archiveByKey.get(
        `${norm(name)}|${date}`
      ) ?? [];

      if (candidates.length > 0) nameDateFound++;
      if (candidates.length === 1) nameDateUnique++;

      const strict = candidates.filter(a =>
        norm(a.hipodrom) === norm(row.city) &&
        distance(a.mesafe) != null &&
        distance(a.mesafe) === distance(row.distance)
      );

      if (strict.length === 1) strictUnique++;
      else if (strict.length > 1) strictMultiple++;
      else strictMissing++;
    }
  }

  console.log("V1_GROUND_LINK_SAMPLE", JSON.stringify({
    races: races.length,
    horses: horses.size,
    horsesWithCache: caches.length,
    archiveRows: archives.length,
    historicalRows,
    validDates
  }));

  console.log("V1_GROUND_LINK_MATCHING", JSON.stringify({
    nameDateFound,
    nameDateUnique,
    strictUnique,
    strictMultiple,
    strictMissing,
    warning: "Unique name/date/city/distance is not proof of horse identity or PIT availability"
  }));

  console.log("V1_GROUND_LINK_FORMAT", JSON.stringify({
    surfaceExamples: [...surfaceExamples],
    cityExamples: [...cityExamples]
  }));

  console.log("V1_GROUND_LINK_PASS");
}

main().catch(e => {
  console.error("V1_GROUND_LINK_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});