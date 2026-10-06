// V5.46.1 Accurace blokları (ClosingConsistency, LateSpeed, Speed) — primer pencere 2026-07-01+.
// ATIK KİMLİĞİ: Runner.id yarış girişine özgüdür; geçmiş Accurace kayıtları bu yüzden TJK at kimliği
// (Runner.tjkAtId) üzerinden birleştirilir. Her özellik yalnız yarıştan önceki (date < raceDate) kayıtlarla.
// Ayarlar sabittir ve beyan edilir; test sonucuna göre ayarlanmaz.
import { db } from "./src/lib/db";
import { readFileSync, writeFileSync } from "node:fs";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const AYAR = { primerTarih: "2026-07-01", hlGun: 120, tauMesafe: 400, kRel: 2.0, eps: 1e-6 };

const yuzey = (raw: string | null | undefined) => {
  if (!raw) return null;
  if (raw.startsWith("Ç") || raw.startsWith("C")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  if (raw.startsWith("S")) return "SENTETIK";
  return null;
};
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a: number[]) => { const m = med(a); return m == null ? null : med(a.map((x) => Math.abs(x - m))); };
const gun = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86400000;
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

type Cp = { checkpoint: number; timeReal: number; place: number };
type Kayit = { tjk: number; date: Date; L: number; yuz: string | null; place: number; n: number; fin: number; cps: Cp[]; lateMs: number | null; pace100: number; raceKey: string };

// 1) Accurace bölünmeleri (runnerId) -> tjkAtId
const arsiv = await db.accuraceRace.findMany({
  select: { id: true, date: true, length: true, ground: true, splits: { where: { runnerId: { not: null } }, select: { runnerId: true, place: true, finishTimeReal: true, checkpoints: true } } },
});
const splitRunnerIds = [...new Set(arsiv.flatMap((a) => a.splits.map((s) => s.runnerId!)))];
const tjkByRunner = new Map<string, number>();
for (const c of chunk(splitRunnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) tjkByRunner.set(x.id, x.tjkAtId);

const kayitlar: Kayit[] = [];
const yarisSplit = new Map<string, { tjk: number; lateMs: number | null }[]>();
for (const a of arsiv) {
  const L = a.length ?? 0;
  if (!L || !a.splits.length) continue;
  const hedef = L - Math.min(800, 0.5 * L);
  const n = a.splits.length;
  const liste: { tjk: number; lateMs: number | null }[] = [];
  for (const s of a.splits) {
    const tjk = tjkByRunner.get(s.runnerId!);
    if (tjk == null) continue;
    const cps = ((s.checkpoints as unknown) as Cp[]) ?? [];
    if (!Array.isArray(cps) || !cps.length) continue;
    const sirali = [...cps].sort((x, y) => x.checkpoint - y.checkpoint);
    const yak = sirali.reduce((b, c) => (Math.abs(c.checkpoint - hedef) < Math.abs(b.checkpoint - hedef) ? c : b));
    const lateMs = s.finishTimeReal - yak.timeReal;
    liste.push({ tjk, lateMs });
    kayitlar.push({ tjk, date: a.date, L, yuz: yuzey(a.ground), place: s.place, n, fin: s.finishTimeReal, cps: sirali, lateMs, pace100: (s.finishTimeReal / 1000) / L * 100, raceKey: a.id });
  }
  yarisSplit.set(a.id, liste);
}
const atIndex = new Map<number, Kayit[]>();
for (const k of kayitlar) { const l = atIndex.get(k.tjk) ?? []; l.push(k); atIndex.set(k.tjk, l); }

// 2) Primer yarışlar: satırın tjkAtId'si
const rows: any[] = JSON.parse(readFileSync(`${S}/model-veri-yg4.json`, "utf8"));
const tar: Record<string, string> = JSON.parse(readFileSync(`${S}/race-tarih.json`, "utf8"));
const primer = rows.filter((r) => tar[r.raceId] >= AYAR.primerTarih);
const primRunnerIds = [...new Set(primer.map((r) => r.runnerId))];
const tjkOfPrim = new Map<string, number>();
for (const c of chunk(primRunnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) tjkOfPrim.set(x.id, x.tjkAtId);

// 3) Özellikler (as-of)
const cikti: any[] = [];
const kap = { satir: 0, tjkVar: 0, closingGozl: 0, lateGozl: 0, speedGozl: 0 };
for (const r of primer) {
  kap.satir++;
  const tjk = tjkOfPrim.get(r.runnerId);
  const d = new Date(`${tar[r.raceId]}T00:00:00.000Z`);
  const yuz = yuzey(r.surface);
  const Lt = r.distance ?? 0;
  if (tjk == null) { cikti.push({ raceId: r.raceId, runnerId: r.runnerId, neden: "TJK_YOK" }); continue; }
  kap.tjkVar++;
  const gecmis = (atIndex.get(tjk) ?? []).filter((k) => k.date < d);

  let sW = 0, sWX = 0, sWl = 0, sWlX = 0, sWs = 0, sWsX = 0;
  for (const k of gecmis) {
    const wRec = Math.pow(0.5, gun(k.date, d) / AYAR.hlGun);
    const wDist = Math.exp(-Math.abs(k.L - Lt) / AYAR.tauMesafe);
    const wSurf = k.yuz === yuz ? 1 : 0;
    const w = wRec * wDist * wSurf;
    if (w <= 0) continue;
    const hedef = k.L - Math.min(800, 0.5 * k.L);
    const yak = k.cps.reduce((b, c) => (Math.abs(c.checkpoint - hedef) < Math.abs(b.checkpoint - hedef) ? c : b), k.cps[0]);
    if (k.n > 1) { sW += w; sWX += w * ((yak.place - k.place) / (k.n - 1)); }
    const ys = yarisSplit.get(k.raceKey) ?? [];
    const lates = ys.map((y) => y.lateMs).filter((x): x is number => x != null);
    const m = med(lates), md = mad(lates);
    if (k.lateMs != null && m != null && md != null) { sWl += w; sWlX += w * ((m - k.lateMs) / (1.4826 * md + AYAR.eps)); }
  }
  const closing = sW > 0 ? { observed: true, raw: sWX / sW, reliability: sW / (sW + AYAR.kRel), nUsed: gecmis.length } : { observed: false, raw: null, reliability: 0, nUsed: gecmis.length };
  const late = sWl > 0 ? { observed: true, raw: sWlX / sWl, reliability: sWl / (sWl + AYAR.kRel), nUsed: gecmis.length } : { observed: false, raw: null, reliability: 0, nUsed: gecmis.length };
  if (closing.observed) kap.closingGozl++;
  if (late.observed) kap.lateGozl++;

  const baglam = kayitlar.filter((k) => k.date < d && k.yuz === yuz && Math.abs(k.L - Lt) <= 100).map((k) => k.pace100);
  const bm = baglam.length >= 20 ? med(baglam) : null;
  if (bm != null) for (const k of gecmis) {
    if (Math.abs(k.L - Lt) > 100 || k.yuz !== yuz) continue;
    const w = Math.pow(0.5, gun(k.date, d) / AYAR.hlGun);
    sWs += w; sWsX += w * (bm - k.pace100);
  }
  const speed = sWs > 0 ? { observed: true, raw: sWsX / sWs, reliability: sWs / (sWs + AYAR.kRel) } : { observed: false, raw: null, reliability: 0 };
  if (speed.observed) kap.speedGozl++;

  cikti.push({ raceId: r.raceId, runnerId: r.runnerId, tjk, closing, lateSpeed: late, speed });
}
const pct = (k: number) => +(100 * k / kap.satir).toFixed(1);
const ozet = { satir: kap.satir, tjkAtIdVar: `${kap.tjkVar} (%${pct(kap.tjkVar)})`, closingGozlemli: `${kap.closingGozl} (%${pct(kap.closingGozl)})`, lateSpeedGozlemli: `${kap.lateGozl} (%${pct(kap.lateGozl)})`, speedGozlemli: `${kap.speedGozl} (%${pct(kap.speedGozl)})`, ayarlar: AYAR };
writeFileSync(`${S}/v5461-blok-ozellikler.json`, JSON.stringify(cikti));
console.log("BLOK " + JSON.stringify(ozet));
process.exit(0);
