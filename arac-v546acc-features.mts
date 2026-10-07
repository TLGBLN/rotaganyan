// V5.46_Acc challenger — tüm model satırları için Accurace özellikleri (as-of). Yalnız okuma.
// Çıktı: scratchpad/accurace-tum-ozellik.json; anahtar "raceId|runnerId".
// Ayarlar features.ts AYAR'dan gelir (SERT yüzey, k=2, stil kesimleri). Sonuca göre ayarlanmaz.
import { readFileSync, writeFileSync } from "node:fs";
import { accuraceKosulari, tjkAtIdOf } from "./src/lib/accurace/loader";
import {
  closingConsistency, lateSegmentSpeed, speedResidual, styleVector, rivalPressure, makeBaselineCache,
  closingResidual, makeClosingBaselineCache,
} from "./src/lib/accurace/features";
import type { Surface, TargetRace } from "./src/lib/accurace/types";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows: any[] = JSON.parse(readFileSync(`${S}/model-veri.json`, "utf8"));
const tar: Record<string, string> = JSON.parse(readFileSync(`${S}/race-tarih-v2.json`, "utf8"));
const tjkOf = await tjkAtIdOf([...new Set(rows.map((r) => r.runnerId))]);
const runs = await accuraceKosulari();
const byTjk = new Map<number, typeof runs>();
for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }
const baselineAt = makeBaselineCache(runs);
const closingBaselineAt = makeClosingBaselineCache(runs);

const alanByRace = new Map<string, number[]>();
for (const r of rows) {
  const t = tjkOf.get(r.runnerId);
  if (t == null) continue;
  const a = alanByRace.get(r.raceId) ?? []; a.push(t); alanByRace.set(r.raceId, a);
}
const SURF: Record<string, Surface> = { CIM: "CIM", KUM: "KUM", SENTETIK: "SENTETIK" };

const cikti: Record<string, any> = {};
let n = 0, tjkVar = 0;
for (const r of rows) {
  n++;
  const tjk = tjkOf.get(r.runnerId);
  if (tjk == null) continue;
  tjkVar++;
  const target: TargetRace = {
    date: new Date(`${tar[r.raceId]}T00:00:00.000Z`),
    length: r.distance ?? 0,
    surface: SURF[r.surface as string] ?? null,
  };
  const gecmis = byTjk.get(tjk) ?? [];
  const c = closingConsistency(gecmis, target);
  const cr = closingResidual(gecmis, target, closingBaselineAt);
  const l = lateSegmentSpeed(gecmis, target);
  const sp = speedResidual(gecmis, target, baselineAt);
  const h = styleVector(gecmis, target);
  const rakip = (alanByRace.get(r.raceId) ?? []).filter((t) => t !== tjk).map((t) => styleVector(byTjk.get(t) ?? [], target));
  const F = rivalPressure(rakip);
  cikti[`${r.raceId}|${r.runnerId}`] = {
    c: c.observed ? c.raw : null, cR: c.reliability,
    cr: cr.observed ? cr.raw : null, crR: cr.reliability,
    l: l.observed ? l.raw : null, lR: l.reliability,
    s: sp.observed ? sp.raw : null, sR: sp.reliability,
    h: h.observed ? h.vec : null, hR: h.reliability,
    f: F.vec, fN: F.nObserved,
  };
}
writeFileSync(`${S}/accurace-tum-ozellik.json`, JSON.stringify(cikti));
console.log(JSON.stringify({ satir: n, tjkVar, yazilan: Object.keys(cikti).length }));
process.exit(0);
