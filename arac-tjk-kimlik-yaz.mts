// Doğrulanmış eşlemeyi yazar: YALNIZ tjkAtId NULL olan satırlar. Kaynak: tjk-kimlik-esleme.json (isim-uyumlu, uyuşmazlıklar hariç).
import { readFileSync } from "node:fs";
import { db } from "./src/lib/db";
const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const d = JSON.parse(readFileSync(`${S}/tjk-kimlik-esleme.json`, "utf8"));
if (!d.tamamlandi) throw new Error("eşleme tamamlanmamış");
const gecerli = d.eslemeler.filter((e: any) => /^[a-z0-9]+$/.test(e.runnerId) && Number.isInteger(e.tjkAtId));
let guncellenen = 0;
for (let i = 0; i < gecerli.length; i += 1000) {
  const parca = gecerli.slice(i, i + 1000);
  const values = parca.map((e: any) => `('${e.runnerId}', ${e.tjkAtId})`).join(",");
  guncellenen += await db.$executeRawUnsafe(
    `UPDATE "Runner" AS r SET "tjkAtId" = v.tjk FROM (VALUES ${values}) AS v(id, tjk) WHERE r.id = v.id AND r."tjkAtId" IS NULL`,
  );
}
console.log("GUNCELLENEN", guncellenen, "GECERLI_ADAY", gecerli.length);
const bos = await db.runner.count({ where: { tjkAtId: null, race: { raceDay: { date: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-08-01T00:00:00.000Z") } } } } });
console.log("KALAN_BOS_JAN_JUL", bos);
process.exit(0);
