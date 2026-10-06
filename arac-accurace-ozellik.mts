// Accurace özellik kurulumu — primer pencere (2026-07-01+). Yalnız okuma; sonuç JSON'a yazılır.
import { readFileSync, writeFileSync } from "node:fs";
import { accuraceKosulari, tjkAtIdOf } from "./src/lib/accurace/loader";
import { closingConsistency, lateSpeed, speedResidual, AYAR } from "./src/lib/accurace/features";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows: any[] = JSON.parse(readFileSync(`${S}/model-veri-yg4.json`, "utf8"));
const tar: Record<string, string> = JSON.parse(readFileSync(`${S}/race-tarih.json`, "utf8"));
const primer = rows.filter((r) => tar[r.raceId] >= "2026-07-01");
const tjkOf = await tjkAtIdOf([...new Set(primer.map((r) => r.runnerId))]);
const runs = await accuraceKosulari();
const byTjk = new Map<number, typeof runs>();
for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }

const sonuc: any[] = [];
const sayac = { satir: 0, tjk: 0, closing: 0, late: 0, speed: 0 };
const kayitTumu = runs.map((r) => ({ pace100: (r.finishMs / 1000 / r.length) * 100, surface: r.surface, length: r.length, date: r.date }));
for (const r of primer) {
  sayac.satir++;
  const tjk = tjkOf.get(r.runnerId);
  if (tjk == null) { sonuc.push({ raceId: r.raceId, runnerId: r.runnerId, neden: "TJK_YOK" }); continue; }
  sayac.tjk++;
  const target = {
    date: new Date(`${tar[r.raceId]}T00:00:00.000Z`),
    length: r.distance ?? 0,
    surface: ({ CIM: "CIM", KUM: "KUM", SENTETIK: "SENTETIK" } as const)[r.surface as "CIM"] ?? null,
  };
  const gecmis = byTjk.get(tjk) ?? [];
  const c = closingConsistency(gecmis, target);
  const l = lateSpeed(gecmis, target);
  const sp = speedResidual(gecmis, target, kayitTumu);
  if (c.observed) sayac.closing++;
  if (l.observed) sayac.late++;
  if (sp.observed) sayac.speed++;
  sonuc.push({ raceId: r.raceId, runnerId: r.runnerId, tjk, closingConsistency: c, lateSpeed: l, speedResidual: sp });
}
const pct = (k: number) => +(100 * k / sayac.satir).toFixed(1);
const ozet = {
  satir: sayac.satir,
  tjkAtIdVar: `${sayac.tjk} (%${pct(sayac.tjk)})`,
  closingConsistency: `${sayac.closing} (%${pct(sayac.closing)})`,
  lateSpeed: `${sayac.late} (%${pct(sayac.late)})`,
  speedResidual: `${sayac.speed} (%${pct(sayac.speed)})`,
  ayarlar: AYAR,
};
writeFileSync(`${S}/accurace-ozellik-v546.json`, JSON.stringify(sonuc));
console.log("ACC " + JSON.stringify(ozet));
process.exit(0);
