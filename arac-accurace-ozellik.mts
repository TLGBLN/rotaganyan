// Accurace özellik kurulumu — primer pencere (2026-07-01+). Yalnız okuma; sonuç JSON'a yazılır.
// Ayarlar beyan edilmiş sabitlerdir (features.ts AYAR). Sonuca göre ayarlanmaz.
import { readFileSync, writeFileSync } from "node:fs";
import { accuraceKosulari, tjkAtIdOf } from "./src/lib/accurace/loader";
import {
  closingConsistency, lateSegmentSpeed, speedResidual, styleVector, rivalPressure,
  makeBaselineCache, AYAR,
} from "./src/lib/accurace/features";
import type { Surface, TargetRace } from "./src/lib/accurace/types";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows: any[] = JSON.parse(readFileSync(`${S}/model-veri-yg4.json`, "utf8"));
const tar: Record<string, string> = JSON.parse(readFileSync(`${S}/race-tarih.json`, "utf8"));
const primer = rows.filter((r) => tar[r.raceId] >= "2026-07-01");
const tjkOf = await tjkAtIdOf([...new Set(primer.map((r) => r.runnerId))]);
const runs = await accuraceKosulari();
const byTjk = new Map<number, typeof runs>();
for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }
const baselineAt = makeBaselineCache(runs);

// Yarış alanı: model satırlarındaki her raceId'nin runnerId → tjk listesi
const alanByRace = new Map<string, number[]>();
for (const r of primer) {
  const t = tjkOf.get(r.runnerId);
  if (t == null) continue;
  const a = alanByRace.get(r.raceId) ?? []; a.push(t); alanByRace.set(r.raceId, a);
}

const SURF: Record<string, Surface> = { CIM: "CIM", KUM: "KUM", SENTETIK: "SENTETIK" };
const sonuc: any[] = [];
const kap = { satir: 0, tjk: 0, closing: 0, lateSeg: 0, speed: 0, stil: 0, rakip: 0 };
const neden: Record<string, Record<string, number>> = { lateSeg: {}, speed: {}, closing: {}, stil: {} };
const say = (ad: string, n: string | null) => { if (n == null) return; neden[ad][n] = (neden[ad][n] ?? 0) + 1; };

for (const r of primer) {
  kap.satir++;
  const tjk = tjkOf.get(r.runnerId);
  if (tjk == null) { sonuc.push({ raceId: r.raceId, runnerId: r.runnerId, neden: "TJK_YOK" }); continue; }
  kap.tjk++;
  const target: TargetRace = {
    date: new Date(`${tar[r.raceId]}T00:00:00.000Z`),
    length: r.distance ?? 0,
    surface: SURF[r.surface as string] ?? null,
  };
  const gecmis = byTjk.get(tjk) ?? [];
  const c = closingConsistency(gecmis, target);
  const l = lateSegmentSpeed(gecmis, target);
  const sp = speedResidual(gecmis, target, baselineAt);
  const h = styleVector(gecmis, target);
  if (c.observed) kap.closing++; else say("closing", c.missingReason);
  if (l.observed) kap.lateSeg++; else say("lateSeg", l.missingReason);
  if (sp.observed) kap.speed++; else say("speed", sp.missingReason);
  if (h.observed) kap.stil++; else say("stil", h.missingReason);

  // Rakip baskısı: aynı yarıştaki diğer atların (as-of) stil vektörleri
  const rakipler = (alanByRace.get(r.raceId) ?? []).filter((t) => t !== tjk).map((t) => styleVector(byTjk.get(t) ?? [], target));
  const F = rivalPressure(rakipler);
  if (F.vec) kap.rakip++;

  sonuc.push({ raceId: r.raceId, runnerId: r.runnerId, tjk, closingConsistency: c, lateSegmentSpeed: l, speedResidual: sp, styleVector: h, rivalPressure: F });
}

const pct = (k: number) => +(100 * k / kap.satir).toFixed(1);
const ozet = {
  satir: kap.satir,
  tjkAtIdVar: `${kap.tjk} (%${pct(kap.tjk)})`,
  closingConsistency: `${kap.closing} (%${pct(kap.closing)})`,
  lateSegmentSpeed: `${kap.lateSeg} (%${pct(kap.lateSeg)})`,
  speedResidual: `${kap.speed} (%${pct(kap.speed)})`,
  styleVector: `${kap.stil} (%${pct(kap.stil)})`,
  rivalPressureVar: `${kap.rakip} (%${pct(kap.rakip)})`,
  kayipNedenleri: neden,
  gecmisKosuSayisi: runs.length,
  lateSegmentKosuNedenDagilimi: runs.reduce((o: Record<string, number>, x) => { const k = x.lateSegReason ?? (x.lateSegScore != null ? "GOZLEMLI" : "BILINMIYOR"); o[k] = (o[k] ?? 0) + 1; return o; }, {}),
  pistDurumuDoluOrani: +(100 * runs.filter((x) => x.going != null).length / Math.max(1, runs.length)).toFixed(1),
  ayarlar: AYAR,
};
writeFileSync(`${S}/accurace-ozellik-v546.json`, JSON.stringify(sonuc));
console.log("ACC " + JSON.stringify(ozet));
process.exit(0);
