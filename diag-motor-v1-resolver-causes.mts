import { db } from "./src/lib/db";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseHistoryRows,
  rowsBeforeCutoff,
  parseTjkDate,
  createFieldSizeResolver,
  type HistoryRow
} from "./src/lib/motor-v1/features/history-source";
import { parseHistoryGoing } from "./src/lib/motor-v1/features/pist-durum-history";

async function main() {
  const folder = resolve(
    "src/lib/motor-v1/artifacts/going-snapshots"
  );

  const ids = readdirSync(folder, { withFileTypes: true })
    .filter(x => x.isDirectory())
    .map(x => x.name);

  const targets = await db.race.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      raceDay: { select: { date: true } },
      runners: {
        where: {
          scratched: false,
          tjkAtId: { not: null }
        },
        select: { tjkAtId: true }
      }
    }
  });

  const horseIds = [...new Set(
    targets.flatMap(r => r.runners)
      .flatMap(r => r.tjkAtId == null ? [] : [r.tjkAtId])
  )];

  const [caches, databaseRaces] = await Promise.all([
    db.horseRaceHistoryCache.findMany({
      where: { tjkAtId: { in: horseIds } },
      select: { tjkAtId: true, rowsJson: true }
    }),
    db.race.findMany({
      select: {
        raceNo: true,
        raceDay: {
          select: {
            date: true,
            hippodrome: { select: { name: true } }
          }
        }
      }
    })
  ]);

  const history = new Map(
    caches.map(c => [c.tjkAtId, c.rowsJson])
  );

  const byDate = new Map<string, typeof databaseRaces>();

  for (const race of databaseRaces) {
    const date = race.raceDay.date.toISOString().slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(race);
    byDate.set(date, list);
  }

  const resolver = createFieldSizeResolver();
  const unresolved: HistoryRow[] = [];
  let checked = 0;

  for (const target of targets) {
    for (const runner of target.runners) {
      if (runner.tjkAtId == null) continue;

      const rows = rowsBeforeCutoff(
        parseHistoryRows(history.get(runner.tjkAtId)),
        target.raceDay.date
      );

      for (const row of rows) {
        if (!parseHistoryGoing(row.surface)) continue;
        checked++;

        if (await resolver(row) == null) {
          unresolved.push(row);
        }
      }
    }
  }

  const counts: Record<string, number> = {};
  const examples: Record<string, unknown[]> = {};

  function add(reason: string, row: HistoryRow, candidates: string[]) {
    counts[reason] = (counts[reason] ?? 0) + 1;
    const list = examples[reason] ?? [];
    if (list.length < 3) {
      list.push({
        date: row.date,
        city: row.city,
        raceNo: row.raceNo,
        availableCities: candidates.slice(0, 4)
      });
    }
    examples[reason] = list;
  }

  for (const row of unresolved) {
    const date = parseTjkDate(row.date);
    if (!date) {
      add("INVALID_DATE", row, []);
      continue;
    }

    const day = date.toISOString().slice(0, 10);
    const candidates = byDate.get(day) ?? [];
    const no = Number.parseInt(row.raceNo, 10);

    if (!Number.isFinite(no)) {
      add("INVALID_RACE_NO", row, []);
    } else if (candidates.length === 0) {
      add("DATE_NOT_IN_DATABASE", row, []);
    } else {
      const sameCity = candidates.filter(
        r => r.raceDay.hippodrome.name === row.city
      );
      const sameNumber = candidates.filter(
        r => r.raceNo === no
      );
      const exact = sameCity.filter(r => r.raceNo === no);

      if (exact.length > 0) {
        add("EXACT_RACE_BUT_UNRESOLVED", row, []);
      } else if (sameNumber.length > 0) {
        add("CITY_MISMATCH", row,
          sameNumber.map(r => r.raceDay.hippodrome.name));
      } else if (sameCity.length > 0) {
        add("RACE_NUMBER_MISMATCH", row, []);
      } else {
        add("CITY_AND_NUMBER_MISMATCH", row, []);
      }
    }
  }

  const byYear: Record<string, number> = {};
  for (const row of unresolved) {
    const year = row.date.slice(-4);
    byYear[year] = (byYear[year] ?? 0) + 1;
  }

  console.log("V1_RESOLVER_CAUSES", JSON.stringify({
    snapshotRaces: targets.length,
    checkedHistoryRows: checked,
    unresolvedRows: unresolved.length,
    counts,
    byYear
  }));

  console.log("V1_RESOLVER_EXAMPLES", JSON.stringify(examples));
  console.log("V1_RESOLVER_AUDIT_PASS");
}

main().catch(e => {
  console.error("V1_RESOLVER_AUDIT_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});