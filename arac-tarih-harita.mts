import { writeFileSync, readFileSync } from "node:fs";
import { db } from "./src/lib/db";
const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows: any[] = JSON.parse(readFileSync(`${S}/model-veri.json`, "utf8"));
const ids = [...new Set(rows.map((r) => r.raceId))];
const harita: Record<string, string> = {};
for (let i = 0; i < ids.length; i += 1000) {
  const parca = await db.race.findMany({ where: { id: { in: ids.slice(i, i + 1000) } }, select: { id: true, raceDay: { select: { date: true } } } });
  for (const r of parca) harita[r.id] = r.raceDay.date.toISOString().slice(0, 10);
}
writeFileSync(`${S}/race-tarih-v2.json`, JSON.stringify(harita));
console.log("RACE", ids.length, "ESLESEN", Object.keys(harita).length);
process.exit(0);
