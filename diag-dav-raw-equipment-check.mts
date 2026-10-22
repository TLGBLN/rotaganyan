// SALT-OKUNUR denetim: DAV_TAKI_CIKARILDI'nin "%96 pozitif" iddiasini ham veriden
// dogrular — bugunku Runner.equipment ile HorseRaceHistoryCache'teki en son yaris
// equipment'ini yan yana basar.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { parseHistoryRows, rowsBeforeCutoff, parseTjkDate } from "./src/lib/motor-v1/features/history-source";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[] };
  const races = await db.race.findMany({
    where: { id: { in: lock.trainRaceIds.slice(0, 20) } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, equipment: true, tjkAtId: true } } },
  });
  let shown = 0;
  let cikarildi1 = 0, cikarildi0 = 0;
  for (const race of races) {
    const cutoff = race.raceDay.date;
    const tjkIds = race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
    const cacheRows = tjkIds.length ? await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIds } }, select: { tjkAtId: true, rowsJson: true } }) : [];
    const byTjk = new Map(cacheRows.map((c) => [c.tjkAtId, c.rowsJson]));
    for (const r of race.runners) {
      const rowsJson = byTjk.get(r.tjkAtId ?? -1) ?? [];
      const rows = rowsBeforeCutoff(parseHistoryRows(rowsJson), cutoff).map((row) => ({ row, date: parseTjkDate(row.date)! })).sort((a, b) => b.date.getTime() - a.date.getTime());
      if (rows.length === 0) continue;
      const last = rows[0].row;
      const curRaw = r.equipment ?? "";
      const lastRaw = last.equipment ?? "";
      if (shown < 25) {
        console.log(`no=${r.no} tjkAtId=${r.tjkAtId} CURRENT="${curRaw}" LAST="${lastRaw}" lastDate=${last.date}`);
        shown++;
      }
      // basit "cikarildi" taklidi (familyOf olmadan, ham string karsilastirma)
      if (lastRaw.trim() !== "" && curRaw.trim() === "") cikarildi1++;
      else cikarildi0++;
    }
  }
  console.log(`\nHam-string bazli yaklasik "gecmiste equip VAR, simdi YOK" orani: ${cikarildi1}/${cikarildi1 + cikarildi0} (%${(100 * cikarildi1 / Math.max(1, cikarildi1 + cikarildi0)).toFixed(1)})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
