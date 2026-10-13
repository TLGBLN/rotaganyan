// V5.46.1 MASTER CHALLENGER FEATURE BUILD v2 — frozen master-pit bundle'dan, DB'ye donmeden,
// tum bug-fix/formul/drop/yeni-feature challenger degerlerini uretir. Beta fit YOK, OOS YOK,
// RESCUE YOK, production/weights/engine degisikligi YOK. PowerShell'den `npx tsx` ile calistirilir.
//
// RECONSTRUCTED 2026-10-11 — orijinal `arac-master-pit-challenger-build-v2.mts` (repo kokunde,
// ad-hoc-script temizligi sirasinda YANLISLIKLA silindi) bu dosyanin KENDI onceki Write/Edit
// tool-call gecmisinden (ayni oturum, ozetlenmemis/canli context) birebir yeniden olusturuldu.
// Reproducibility kaniti: bu script frozen bundle uzerinde tekrar calistirilip ciktisi
// challenger-features-v2-repro.json olarak kaydedildi, orijinal challenger-features-v2.json
// (SHA256 832b5862afbda02a9aae5d607ab91771b83302b2509c2467a06bf70e813e8d91) ile hucre-bazinda
// karsilastirildi — bkz. scripts/v5461-audit/compare-repro.mts ciktisi / pre-oos-freeze-v2.md.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hesaplaAgfSirasi } from "../../src/lib/methodology/agf-sirasi";
import { isSameJockey, isSprintIdman, galopQuality } from "../../src/components/program/panels/galop-helpers";
import { zeminKatsayisi, zeminDetayiBul, zeminDetayiSatirdanCikar } from "../../src/lib/methodology/mekanik-puanlama";
import { familyOf, toCodes } from "../../src/lib/equipment-family";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "../../src/lib/sire-stat-match";
import { finishPos } from "../../src/lib/race-result";
import { hizPaceIndexKur, hizDerecesiHesaplaOrtak, hizSureyiSaniyeyeCevir, hizSurfaceFromRaw, type HizGecmisSatir } from "../../src/lib/methodology/hiz-derecesi-hesapla";
import { closingResidual, lateSegmentSpeed, speedResidual, styleVector, makeBaselineCache, makeClosingBaselineCache, recencyW, mesafeW } from "../../src/lib/accurace/features";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, hesaplaYarisGidisati, type PaceCheckpoint } from "../../src/lib/methodology/pace-analizi";
import type { AccuraceRun, Surface as AccSurface, TargetRace, Breed as AccBreed } from "../../src/lib/accurace/types";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const t0 = Date.now();
const log = (s: string) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const readJson = (name: string) => JSON.parse(readFileSync(`${MP}/${name}.json`, "utf8"));
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

type Row = {
  raceId: string; raceDate: string; hippodrome: string; hippodromSlug: string;
  surfaceConditions: { label: string; detail: string }[] | null;
  runnerId: string; tjkAtId: number | null; name: string; no: number;
  win: boolean; fieldSize: number; breed: string; surface: string; distance: number; classType: string;
  ikramiye1: number | null; weight: string | null; jockey: string | null; trainer: string | null;
  sire: string | null; sireNorm: string | null; agf: number | null; ekuriGroup: number | null;
  equipmentCurrent: string | null; equipmentSourceKnown: boolean;
};

type Chal = { raw: number | null; observed: boolean; reliability: number };
const NA: Chal = { raw: null, observed: false, reliability: 0 };

log("Frozen bundle yukleniyor...");
const runnerRows: Row[] = readJson("runner-rows");
const raceMetaArr: { raceId: string; cutoffTimestamp: string | null; raceTimeRaw: string | null; parseStatus: string }[] = readJson("race-metadata");
const agfSnapsByRunner: Record<string, { agf: number; capturedAt: string }[]> = readJson("per-runner-agfsnapshots");
const gallopsByRunner: Record<string, { date: string; track: string | null; surface: string | null; jockey: string | null; splits: Record<string, string> }[]> = readJson("per-runner-gallops");
const h2hByRace: Record<string, { key: string; date: string; hippodrome: string; distance: number; surface: string; results: { horseName: string; finishPos: string }[] }[]> = readJson("per-race-h2h");
const tjkDerece: { atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string; derece: string | null; kilo: string | null; cinsAdi: string; tarih: string | null; hipodrom: string }[] = readJson("global-tjkderece");
const accRuns: AccuraceRun[] = (readJson("global-accurace-runs") as any[]).map((r) => ({ ...r, date: new Date(r.date) }));
const sirePop: { sireNorm: string; irk: string; pist: string; mesafeBucket: string; tarih: string; win: boolean }[] = readJson("global-sire-population");
const horseHist: { name: string; jockey: string | null; weight: string | null; equipment: string | null; tarih: string; hipodrom: string; breed: string; surface: string; distance: number; ikramiye1: number | null; pos: number | null; actualOrderLen: number | null }[] = readJson("global-horse-history");
const hrhCache: { tjkAtId: number; rowsJson: any }[] = readJson("global-horse-race-history-cache");
log(`Yuklendi: runnerRows=${runnerRows.length} tjkDerece=${tjkDerece.length} accRuns=${accRuns.length} sirePop=${sirePop.length} horseHist=${horseHist.length} hrhCache=${hrhCache.length}`);

const raceMetaById = new Map(raceMetaArr.map((r) => [r.raceId, r]));
const rowsByRace = new Map<string, Row[]>();
for (const r of runnerRows) { const a = rowsByRace.get(r.raceId) ?? []; a.push(r); rowsByRace.set(r.raceId, a); }

const HALF_LIFE_GUN = 120;
function recencyWeight(fromIso: string, toIso: string, halfLife = HALF_LIFE_GUN): number {
  const days = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000;
  if (days < 0) return 0;
  return Math.pow(0.5, days / halfLife);
}
function parseKilo(w: string | null): number | null {
  if (!w) return null;
  const n = parseFloat(w.replace(",", "."));
  return isNaN(n) ? null : n;
}
function mesafeyeMetre(m: string): number | null {
  try { return parseInt(m.replace(/\./g, ""), 10); } catch { return null; }
}
function dereceyeSaniye(t: string | null): number | null {
  if (!t) return null;
  const p = t.trim().split(".");
  if (p.length === 3) return parseInt(p[0], 10) * 60 + parseInt(p[1], 10) + parseInt(p[2], 10) / 100;
  if (p.length === 2) return parseInt(p[0], 10) + parseInt(p[1], 10) / 100;
  return null;
}
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" { return /handikap/i.test(cinsAdi) ? "handikap" : "diger"; }

const out = new Map<string, Record<string, Chal>>();
function key(r: Row) { return `${r.raceId}|${r.runnerId}`; }
function setC(r: Row, name: string, c: Chal) {
  const k = key(r);
  const o = out.get(k) ?? {};
  o[name] = c;
  out.set(k, o);
}

const skipReasons: Record<string, string> = {};
const validationNotes: string[] = [];
const metadata: Record<string, unknown> = {
  HALF_LIFE_GUN, note: "Tum recency/shrink sabitleri PLACEHOLDER — OOS asamasinda secilecek, henuz optimize edilmedi.",
};

// ═══ 1) AGF GROUP ═══════════════════════════════════════════════════════════
log("1) AGF group...");
for (const [raceId, rows] of rowsByRace) {
  const agfRankInput = rows.map((r) => ({ id: r.runnerId, agf: r.agf, ekuriGroup: r.ekuriGroup }));
  const rankMap = hesaplaAgfSirasi(agfRankInput);
  const sahaOrtasi = Math.ceil(rows.length / 2);
  for (const r of rows) {
    const sira = rankMap.get(r.runnerId) ?? sahaOrtasi;
    const payi = r.agf ?? 0;
    setC(r, "agfSirasi_CURRENT", { raw: sira, observed: true, reliability: 1 });
    setC(r, "agfPayi_CURRENT", { raw: payi, observed: true, reliability: 1 });
    setC(r, "agfPayi2_CURRENT", { raw: payi * payi, observed: true, reliability: 1 });
    const obs = r.agf != null;
    setC(r, "agfSirasi_MISSING_NEUTRAL", obs ? { raw: sira, observed: true, reliability: 1 } : NA);
    setC(r, "agfPayi_MISSING_NEUTRAL", obs ? { raw: payi, observed: true, reliability: 1 } : NA);
    setC(r, "agfPayi2_MISSING_NEUTRAL", obs ? { raw: payi * payi, observed: true, reliability: 1 } : NA);
  }
}
const AGF_TREND_K = 5;
for (const r of runnerRows) {
  const meta = raceMetaById.get(r.raceId);
  const cutoff = meta?.cutoffTimestamp ?? null;
  if (!cutoff) { setC(r, "agfTrend", NA); continue; }
  const snaps = (agfSnapsByRunner[r.runnerId] ?? []).filter((s) => s.capturedAt < cutoff).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (snaps.length < 2) { setC(r, "agfTrend", NA); continue; }
  const ilk = snaps[0].agf, son = snaps[snaps.length - 1].agf;
  const fark = Math.round((son - ilk) * 100) / 100;
  const reliability = Math.min(1, (snaps.length - 1) / AGF_TREND_K);
  setC(r, "agfTrend", { raw: fark, observed: true, reliability });
}
metadata.agfTrend = { k: AGF_TREND_K, rule: "fark=son_pre_race_agf-ilk_pre_race_agf, min 2 pre-race snapshot, k placeholder" };

// ═══ 2) idmJokey ═══════════════════════════════════════════════════════════
log("2) idmJokey...");
for (const r of runnerRows) {
  const gallops = (gallopsByRunner[r.runnerId] ?? []).filter((g) => g.date < r.raceDate);
  const current = gallops.some((g) => isSameJockey(g.jockey, r.jockey)) ? 1 : 0;
  setC(r, "idmJokey_CURRENT", { raw: current, observed: true, reliability: 1 });
  setC(r, "idmJokey_NO_GALLOP_MISSING", gallops.length > 0 ? { raw: current, observed: true, reliability: 1 } : NA);
  if (gallops.length === 0) { setC(r, "idmJokey_RECENCY_WEIGHTED", NA); continue; }
  let sw = 0, swy = 0;
  for (const g of gallops) { const w = recencyWeight(g.date, r.raceDate); sw += w; swy += w * (isSameJockey(g.jockey, r.jockey) ? 1 : 0); }
  setC(r, "idmJokey_RECENCY_WEIGHTED", sw > 0 ? { raw: swy / sw, observed: true, reliability: Math.min(1, sw) } : NA);
}

// ═══ 3) H2H ═════════════════════════════════════════════════════════════════
log("3) H2H...");
const H2H_K = 5;
for (const r of runnerRows) {
  const encounters = h2hByRace[r.raceId] ?? [];
  let skor = 0, karsilastirma = 0;
  let sw = 0, swy = 0;
  for (const enc of encounters) {
    const beni = enc.results.find((x) => x.horseName === r.name);
    if (!beni) continue;
    const benimPos = parseInt(beni.finishPos, 10);
    if (isNaN(benimPos)) continue;
    const w = recencyWeight(enc.date.split(".").reverse().join("-"), r.raceDate);
    for (const other of enc.results) {
      if (other.horseName === r.name) continue;
      const otherPos = parseInt(other.finishPos, 10);
      if (isNaN(otherPos)) continue;
      karsilastirma++;
      const y = benimPos < otherPos ? 1 : benimPos > otherPos ? -1 : 0;
      skor += y;
      sw += w; swy += w * y;
    }
  }
  setC(r, "h2hNetSkor_CURRENT", { raw: skor, observed: karsilastirma > 0, reliability: 1 });
  setC(r, "h2hNetSkor_SIGNED_SHRINK_RECENCY", karsilastirma > 0 ? { raw: swy / (sw + H2H_K), observed: true, reliability: 1 } : NA);
}
metadata.h2h = { k: H2H_K, note: "SIGNED_SHRINK_RECENCY'de reliability=1 sabit (raw zaten shrink edildi, cifte kucultme yok)." };

// ═══ 4) HIZ ═════════════════════════════════════════════════════════════════
log("4) HIZ (pace indeksi kuruluyor)...");
const gecmisByTjkAtId = new Map<number, HizGecmisSatir[]>();
const irkByTjkAtId = new Map<number, string>();
for (const c of hrhCache) {
  const rows = Array.isArray(c.rowsJson) ? c.rowsJson : [];
  const gecmis: HizGecmisSatir[] = rows.filter((x: any) => x.distance != null && x.surface && x.time).map((x: any) => ({ date: x.date, time: x.time, distance: x.distance, surface: x.surface }));
  gecmisByTjkAtId.set(c.tjkAtId, gecmis);
}
for (const r of runnerRows) if (r.tjkAtId != null && !irkByTjkAtId.has(r.tjkAtId)) irkByTjkAtId.set(r.tjkAtId, breedToIrk(r.breed));
const paceIndex = hizPaceIndexKur(gecmisByTjkAtId, irkByTjkAtId);

const parentIndex = new Map<string, { tarih: Date; pace: number }[]>();
for (const [bucketKey, arr] of paceIndex) {
  const [irk, pist] = bucketKey.split("|");
  const parentKey = `${irk}|${pist}`;
  const ex = parentIndex.get(parentKey) ?? [];
  ex.push(...arr);
  parentIndex.set(parentKey, ex);
}
function hierBaselinePace(bucketKey: string, cutoff: Date, k0 = 20): { v: number | null; n: number } {
  const [irk, pist] = bucketKey.split("|");
  const bucket = (paceIndex.get(bucketKey) ?? []).filter((p) => p.tarih.getTime() < cutoff.getTime());
  const parent = (parentIndex.get(`${irk}|${pist}`) ?? []).filter((p) => p.tarih.getTime() < cutoff.getTime());
  if (parent.length === 0) return { v: null, n: 0 };
  const parentMean = parent.reduce((s, p) => s + p.pace, 0) / parent.length;
  if (bucket.length === 0) return { v: parentMean, n: 0 };
  const bucketMean = bucket.reduce((s, p) => s + p.pace, 0) / bucket.length;
  const r = bucket.length / (bucket.length + k0);
  return { v: r * bucketMean + (1 - r) * parentMean, n: bucket.length };
}

type MesafeNokta = { tarih: Date; pace: number; mesafe: number };
const irkPistMesafeIndex = new Map<string, MesafeNokta[]>();
for (const [tjkAtId, gecmis] of gecmisByTjkAtId) {
  const irk = irkByTjkAtId.get(tjkAtId);
  if (!irk) continue;
  for (const g of gecmis) {
    const tarih = new Date(g.date.split(".").reverse().join("-"));
    if (isNaN(tarih.getTime())) continue;
    const saniye = hizSureyiSaniyeyeCevir(g.time);
    if (saniye == null || saniye <= 0 || !g.distance) continue;
    const pist = hizSurfaceFromRaw(g.surface);
    if (!pist) continue;
    const key2 = `${irk}|${surfaceToPist(pist)}`;
    const arr = irkPistMesafeIndex.get(key2) ?? [];
    arr.push({ tarih, pace: g.distance / saniye, mesafe: g.distance });
    irkPistMesafeIndex.set(key2, arr);
  }
}
const irkPistMesafeSirali = new Map<string, MesafeNokta[]>();
for (const [k, arr] of irkPistMesafeIndex) irkPistMesafeSirali.set(k, [...arr].sort((a, b) => a.mesafe - b.mesafe));
const DIST_TAU = 150;
function gaussianBaselinePace(irk: string, pist: string, mesafe: number, cutoff: Date): { v: number | null; effN: number; n: number } {
  const arr = irkPistMesafeSirali.get(`${irk}|${pist}`);
  if (!arr || arr.length === 0) return { v: null, effN: 0, n: 0 };
  const lo = mesafe - 3 * DIST_TAU, hi = mesafe + 3 * DIST_TAU;
  let i0 = 0, i1 = arr.length;
  { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m].mesafe < lo) a = m + 1; else b = m; } i0 = a; }
  { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m].mesafe <= hi) a = m + 1; else b = m; } i1 = a; }
  let sw = 0, swv = 0, n = 0;
  for (let i = i0; i < i1; i++) {
    const p = arr[i];
    if (p.tarih.getTime() >= cutoff.getTime()) continue;
    const w = Math.exp(-(((p.mesafe - mesafe) / DIST_TAU) ** 2));
    if (w <= 1e-6) continue;
    sw += w; swv += w * p.pace; n++;
  }
  if (sw <= 0) return { v: null, effN: 0, n };
  return { v: swv / sw, effN: sw, n };
}

let hizNanWarn = 0;
for (const r of runnerRows) {
  const gecmis = r.tjkAtId != null ? gecmisByTjkAtId.get(r.tjkAtId) ?? [] : [];
  if (gecmis.length === 0) { setC(r, "hizDerecesi_CURRENT", NA); setC(r, "hizDerecesi_HIER_BASELINE", NA); setC(r, "hizDerecesi_HIER_RECENCY", NA); setC(r, "hizDerecesi_HIER_RECENCY_DISTANCE", NA); continue; }
  const cutoff = new Date(r.raceDate);
  const irk = breedToIrk(r.breed);
  const current = hizDerecesiHesaplaOrtak(gecmis, irk, cutoff, paceIndex);
  const hasPrior = gecmis.some((g) => { const t = new Date(g.date.split(".").reverse().join("-")); return !isNaN(t.getTime()) && t < cutoff; });
  setC(r, "hizDerecesi_CURRENT", hasPrior ? { raw: current, observed: true, reliability: 1 } : NA);

  const pencereBaslangic = new Date(cutoff.getTime() - 365 * 86400000);
  const uygun = gecmis
    .map((g) => { const tarih = new Date(g.date.split(".").reverse().join("-")); const saniye = hizSureyiSaniyeyeCevir(g.time); return { ...g, tarih, saniye }; })
    .filter((g) => !isNaN(g.tarih.getTime()) && g.tarih < cutoff && g.tarih >= pencereBaslangic && g.saniye != null && g.saniye > 0 && g.distance);
  if (uygun.length === 0) { setC(r, "hizDerecesi_HIER_BASELINE", NA); setC(r, "hizDerecesi_HIER_RECENCY", NA); setC(r, "hizDerecesi_HIER_RECENCY_DISTANCE", NA); continue; }
  let swB = 0, swyB = 0, swR = 0, swyR = 0, swD = 0, swyD = 0;
  for (const g of uygun) {
    const pist = hizSurfaceFromRaw(g.surface);
    if (!pist) continue;
    const bk = `${irk}|${surfaceToPist(pist)}|${mesafeBucket(g.distance)}`;
    const base = hierBaselinePace(bk, g.tarih);
    if (base.v == null) continue;
    const kendiPace = g.distance / g.saniye!;
    const farkPct = (100 * (kendiPace - base.v)) / base.v;
    if (!Number.isFinite(farkPct)) { hizNanWarn++; continue; }
    const baselineReliability = base.n / (base.n + 20);
    swB += 1; swyB += farkPct;
    const wRec = recencyWeight(g.tarih.toISOString(), r.raceDate);
    swR += wRec * baselineReliability; swyR += wRec * baselineReliability * farkPct;

    const gBase = gaussianBaselinePace(irk, surfaceToPist(pist), g.distance, g.tarih);
    if (gBase.v != null) {
      const gFarkPct = (100 * (kendiPace - gBase.v)) / gBase.v;
      if (Number.isFinite(gFarkPct)) {
        const gReliability = gBase.effN / (gBase.effN + 20);
        swD += wRec * gReliability; swyD += wRec * gReliability * gFarkPct;
      }
    }
  }
  setC(r, "hizDerecesi_HIER_BASELINE", swB > 0 ? { raw: swyB / swB, observed: true, reliability: 1 } : NA);
  setC(r, "hizDerecesi_HIER_RECENCY", swR > 0 ? { raw: swyR / swR, observed: true, reliability: Math.min(1, swR) } : NA);
  setC(r, "hizDerecesi_HIER_RECENCY_DISTANCE", swD > 0 ? { raw: swyD / swD, observed: true, reliability: Math.min(1, swD) } : NA);
}
metadata.hizDerecesiDistance = { DIST_TAU, note: "v2: gercek surekli Gaussian mesafe-benzerligi (binary-search ile [-3tau,+3tau] pencereli), mesafeBucket kullanilmiyor — artik HIER_RECENCY'den GERCEKTEN farkli bir seri." };

// ═══ 5) ZEMIN TOLERANSI ═════════════════════════════════════════════════════
log("5) zeminToleransi...");
type TjkZen = { atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string; derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null; hipodrom: string };
const tjkZ: TjkZen[] = tjkDerece.map((s) => ({ ...s, tarih: s.tarih ? new Date(s.tarih) : null }));

function zeminToleransiHesapla(atIsimleri: Set<string>, cutoffTarihi: Date, fixWeightNull: boolean, classFree: boolean) {
  const egimToplam = new Map<string, { sxy: number; sxx: number; sayi: number }>();
  {
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: string }[]>();
    for (const s of tjkZ) {
      if (s.tarih && s.tarih >= cutoffTarihi) continue;
      if (s.pistDurumu !== "Normal") continue;
      const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece); const kilo = parseKilo(s.kilo);
      if (!saniye || !metre || kilo == null || saniye <= 0) continue;
      const bk = `${s.irk}|${s.pist}|${metre}`;
      const arr = bucketHam.get(bk) ?? []; arr.push({ pace: metre / saniye, kilo, kategori: classFree ? "all" : kiloKategorisi(s.cinsAdi) }); bucketHam.set(bk, arr);
    }
    for (const [, arr] of bucketHam) {
      if (arr.length < 10) continue;
      const ortKilo = arr.reduce((s, a) => s + a.kilo, 0) / arr.length, ortPace = arr.reduce((s, a) => s + a.pace, 0) / arr.length;
      for (const a of arr) { const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 }; const dx = a.kilo - ortKilo, dy = a.pace - ortPace; e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++; egimToplam.set(a.kategori, e); }
    }
  }
  const kiloEgimi = new Map<string, number>();
  for (const [k, e] of egimToplam) if (e.sayi >= 30 && e.sxx > 0) kiloEgimi.set(k, e.sxy / e.sxx);

  const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
  for (const s of tjkZ) {
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) continue;
    const kilo = parseKilo(s.kilo);
    const bk = `${s.irk}|${s.pist}|${metre}|${classFree ? "all" : kiloKategorisi(s.cinsAdi)}`;
    const e = bucketToplam.get(bk) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
    e.paceToplam += metre / saniye;
    if (fixWeightNull) { if (kilo != null) { e.kiloToplam += kilo; e.sayi++; } }
    else { e.kiloToplam += kilo ?? 0; }
    if (!fixWeightNull) e.sayi = (bucketToplam.get(bk)?.sayi ?? 0);
    bucketToplam.set(bk, e);
  }
  const bucketToplamDirty = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
  for (const s of tjkZ) {
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) continue;
    const kilo = parseKilo(s.kilo);
    const bk = `${s.irk}|${s.pist}|${metre}|${classFree ? "all" : kiloKategorisi(s.cinsAdi)}`;
    const e = bucketToplamDirty.get(bk) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
    e.paceToplam += metre / saniye; e.kiloToplam += kilo ?? 0; e.sayi++;
    bucketToplamDirty.set(bk, e);
  }
  const bucketOrtDirty = new Map<string, { pace: number; kilo: number }>();
  for (const [k, v] of bucketToplamDirty) if (v.sayi >= 5) bucketOrtDirty.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });
  const bucketOrtFixed = new Map<string, { pace: number; kilo: number }>();
  for (const [k, v] of bucketToplam) if (v.sayi >= 5) bucketOrtFixed.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });

  function goreliPace(s: TjkZen, taban: Map<string, { pace: number; kilo: number }>): number | null {
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) return null;
    const kategori = classFree ? "all" : kiloKategorisi(s.cinsAdi);
    const t = taban.get(`${s.irk}|${s.pist}|${metre}|${kategori}`);
    if (!t) return null;
    const egim = kiloEgimi.get(kategori); const kilo = parseKilo(s.kilo);
    const beklenenPace = egim != null && kilo != null ? t.pace + egim * (kilo - t.kilo) : t.pace;
    return ((metre / saniye - beklenenPace) / beklenenPace) * 100;
  }

  const sonucDirty = new Map<string, number>(); const sonucFixed = new Map<string, number>();
  const atMap = new Map<string, TjkZen[]>();
  for (const s of tjkZ) { if (!atIsimleri.has(s.atAdi)) continue; if (s.tarih && s.tarih >= cutoffTarihi) continue; if (s.pistDurumu === "Normal") continue; const arr = atMap.get(s.atAdi) ?? []; arr.push(s); atMap.set(s.atAdi, arr); }
  for (const [ad, kayitlar] of atMap) {
    const dirtyVals = kayitlar.map((s) => goreliPace(s, bucketOrtDirty)).filter((x): x is number => x != null);
    const fixedVals = kayitlar.map((s) => goreliPace(s, bucketOrtFixed)).filter((x): x is number => x != null);
    if (dirtyVals.length) sonucDirty.set(ad, dirtyVals.reduce((a, b) => a + b, 0) / dirtyVals.length);
    if (fixedVals.length) sonucFixed.set(ad, fixedVals.reduce((a, b) => a + b, 0) / fixedVals.length);
  }
  return { dirty: sonucDirty, fixed: sonucFixed };
}

const atIsimSeti = new Set(runnerRows.map((r) => r.name));
const byDate = new Map<string, Row[]>();
for (const r of runnerRows) { const a = byDate.get(r.raceDate) ?? []; a.push(r); byDate.set(r.raceDate, a); }
log(`zeminToleransi: ${byDate.size} farkli tarih icin hesaplaniyor...`);
let zdProcessed = 0;
for (const [dateIso, rows] of byDate) {
  const cutoff = new Date(dateIso);
  const names = new Set(rows.map((r) => r.name));
  const current = zeminToleransiHesapla(names, cutoff, false, false);
  const fixW = zeminToleransiHesapla(names, cutoff, true, false);
  const classFree = zeminToleransiHesapla(names, cutoff, true, true);
  for (const r of rows) {
    const dv = current.dirty.get(r.name); setC(r, "zeminToleransi_CURRENT", { raw: dv ?? 0, observed: true, reliability: 1 });
    const fv = fixW.fixed.get(r.name); setC(r, "zeminToleransi_FIX_WEIGHT_NULL", fv != null ? { raw: fv, observed: true, reliability: 1 } : { raw: 0, observed: true, reliability: 1 });
    const cv = classFree.fixed.get(r.name); setC(r, "zeminToleransi_CLASS_FREE_BASELINE", cv != null ? { raw: cv, observed: true, reliability: 1 } : { raw: 0, observed: true, reliability: 1 });
  }
  zdProcessed++;
  if (zdProcessed % 50 === 0) log(`  zeminToleransi tarih ${zdProcessed}/${byDate.size}`);
}
validationNotes.push("zeminToleransi_TODAY_GOING_REFORM: SKIP DEGIL, uretildi (5b blogu) — resid_g/w_g(goingSimilarity x recencyWeight x baselineReliability)/(+k).");

log("5b) zeminToleransi TODAY_GOING_REFORM...");
const ZT_K = 10;
function goingSimilarity(a: number, b: number): number { return a === b ? 1 : Math.max(0, 1 - Math.abs(a - b) / 0.5); }
for (const r of runnerRows) {
  const detay = r.surfaceConditions ? zeminDetayiBul(r.surfaceConditions as any, r.surface) : null;
  const bugunKatsayi = detay ? zeminKatsayisi(detay).katsayi : r.surface === "SENTETIK" ? 1.0 : null;
  if (bugunKatsayi == null) { setC(r, "zeminToleransi_TODAY_GOING_REFORM", NA); continue; }
  if (bugunKatsayi === 1.0) { setC(r, "zeminToleransi_TODAY_GOING_REFORM", { raw: 0, observed: true, reliability: 1 }); continue; }
  const cutoff = new Date(r.raceDate);
  const kayitlar = tjkZ.filter((s) => s.atAdi === r.name && s.tarih && s.tarih < cutoff && s.pistDurumu !== "Normal");
  if (kayitlar.length === 0) { setC(r, "zeminToleransi_TODAY_GOING_REFORM", NA); continue; }
  let sw = 0, swy = 0;
  for (const s of kayitlar) {
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece); const kilo = parseKilo(s.kilo);
    if (!saniye || !metre || saniye <= 0) continue;
    const pop = tjkZ.filter((x) => x.irk === s.irk && x.pist === s.pist && mesafeyeMetre(x.mesafe) === metre && x.tarih && x.tarih < cutoff && x.pistDurumu !== "Normal" && x.atAdi !== r.name);
    if (pop.length < 5) continue;
    const vals = pop.map((p) => { const pm = mesafeyeMetre(p.mesafe)!, ps = dereceyeSaniye(p.derece); return ps && ps > 0 ? pm / ps : null; }).filter((x): x is number => x != null);
    if (vals.length < 5) continue;
    const expected = vals.reduce((a, b) => a + b, 0) / vals.length;
    const actual = metre / saniye;
    const resid = (100 * (actual - expected)) / expected;
    if (!Number.isFinite(resid)) continue;
    const sKatsayi = zeminKatsayisi(s.pistDurumu).katsayi;
    const gs = goingSimilarity(bugunKatsayi, sKatsayi);
    const w = gs * recencyWeight(s.tarih!.toISOString(), r.raceDate);
    sw += w; swy += w * resid;
  }
  setC(r, "zeminToleransi_TODAY_GOING_REFORM", sw > 0 ? { raw: swy / (sw + ZT_K), observed: true, reliability: Math.min(1, sw) } : NA);
}
metadata.zeminToleransi = { ZT_K, note: "TODAY_GOING_REFORM O(n*pop) naif, kucuk at sayisinda kabul edilebilir; buyuk olcekte optimize edilmeli." };

// ═══ 6) ZEMIN MESAFE ════════════════════════════════════════════════════════
log("6) zeminMesafeDeneyim...");
function zeminMesafeHesapla(atIsimleri: Set<string>, cutoffTarihi: Date, bugunPist: string, bugunZeminKatsayi: number | null, bugunMesafe: number) {
  const sonuc = new Map<string, { deger: number; seviye: "tam" | "kismi" | "yok" }>();
  if (bugunZeminKatsayi == null) return { sonuc, weighted: new Map<string, number>() };
  const egimToplam = new Map<string, { sxy: number; sxx: number; sayi: number }>();
  const bucketHam = new Map<string, { pace: number; kilo: number; kategori: string }[]>();
  for (const s of tjkZ) {
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece); const kilo = parseKilo(s.kilo);
    if (!saniye || !metre || kilo == null || saniye <= 0) continue;
    const bk = `${s.irk}|${s.pist}|${metre}`;
    const arr = bucketHam.get(bk) ?? []; arr.push({ pace: metre / saniye, kilo, kategori: kiloKategorisi(s.cinsAdi) }); bucketHam.set(bk, arr);
  }
  for (const [, arr] of bucketHam) {
    if (arr.length < 10) continue;
    const ortKilo = arr.reduce((s, a) => s + a.kilo, 0) / arr.length, ortPace = arr.reduce((s, a) => s + a.pace, 0) / arr.length;
    for (const a of arr) { const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 }; const dx = a.kilo - ortKilo, dy = a.pace - ortPace; e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++; egimToplam.set(a.kategori, e); }
  }
  const kiloEgimi = new Map<string, number>();
  for (const [k, e] of egimToplam) if (e.sayi >= 30 && e.sxx > 0) kiloEgimi.set(k, e.sxy / e.sxx);
  const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
  for (const s of tjkZ) {
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) continue;
    const bk = `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
    const e = bucketToplam.get(bk) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
    e.paceToplam += metre / saniye; e.kiloToplam += parseKilo(s.kilo) ?? 0; e.sayi++;
    bucketToplam.set(bk, e);
  }
  const bucketOrt = new Map<string, { pace: number; kilo: number; sayi: number }>();
  for (const [k, v] of bucketToplam) if (v.sayi >= 5) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi, sayi: v.sayi });
  function goreliPace(s: TjkZen): number | null {
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) return null;
    const kategori = kiloKategorisi(s.cinsAdi);
    const t = bucketOrt.get(`${s.irk}|${s.pist}|${metre}|${kategori}`);
    if (!t) return null;
    const egim = kiloEgimi.get(kategori); const kilo = parseKilo(s.kilo);
    const beklenen = egim != null && kilo != null ? t.pace + egim * (kilo - t.kilo) : t.pace;
    return ((metre / saniye - beklenen) / beklenen) * 100;
  }
  const atKayitlari = new Map<string, TjkZen[]>();
  for (const s of tjkZ) {
    if (!atIsimleri.has(s.atAdi)) continue; if (s.tarih && s.tarih >= cutoffTarihi) continue;
    if (s.pist !== bugunPist) continue; if (zeminKatsayisi(s.pistDurumu).katsayi !== bugunZeminKatsayi) continue;
    const arr = atKayitlari.get(s.atAdi) ?? []; arr.push(s); atKayitlari.set(s.atAdi, arr);
  }
  for (const [ad, kayitlar] of atKayitlari) {
    const tam = kayitlar.filter((s) => { const m = mesafeyeMetre(s.mesafe); return m != null && Math.abs(m - bugunMesafe) <= 100; });
    const kullan = tam.length > 0 ? tam : kayitlar;
    const seviye = tam.length > 0 ? "tam" : "kismi";
    const goreliler = kullan.map(goreliPace).filter((x): x is number => x != null);
    if (goreliler.length === 0) continue;
    sonuc.set(ad, { deger: goreliler.reduce((a, b) => a + b, 0) / goreliler.length, seviye });
  }

  const weighted = new Map<string, number>();
  const atTumKayitlari = new Map<string, TjkZen[]>();
  for (const s of tjkZ) {
    if (!atIsimleri.has(s.atAdi)) continue; if (s.tarih && s.tarih >= cutoffTarihi) continue;
    if (s.pist !== bugunPist) continue;
    const arr = atTumKayitlari.get(s.atAdi) ?? []; arr.push(s); atTumKayitlari.set(s.atAdi, arr);
  }
  const DIST_TAU_ZM = 250;
  for (const [ad, kayitlar] of atTumKayitlari) {
    let sw = 0, swy = 0;
    for (const s of kayitlar) {
      const resid = goreliPace(s); if (resid == null) continue;
      const metre = mesafeyeMetre(s.mesafe); if (metre == null) continue;
      const kategori = kiloKategorisi(s.cinsAdi);
      const bOrt = bucketOrt.get(`${s.irk}|${s.pist}|${metre}|${kategori}`);
      if (!bOrt) continue;
      const distSim = Math.exp(-(((metre - bugunMesafe) / DIST_TAU_ZM) ** 2));
      const sKatsayi = zeminKatsayisi(s.pistDurumu).katsayi;
      const goingSim = goingSimilarity(bugunZeminKatsayi, sKatsayi);
      const rec = recencyWeight(s.tarih!.toISOString(), cutoffTarihi.toISOString());
      const baselineRel = bOrt.sayi / (bOrt.sayi + 20);
      const w = distSim * goingSim * rec * baselineRel;
      if (w <= 1e-6) continue;
      sw += w; swy += w * resid;
    }
    if (sw > 0) weighted.set(ad, swy / (sw + ZM_WEIGHTED_K));
  }
  return { sonuc, weighted };
}
const ZM_WEIGHTED_K = 10;
let zmProcessed = 0;
for (const [dateIso, rows] of byDate) {
  const cutoff = new Date(dateIso);
  const names = new Set(rows.map((r) => r.name));
  const byContext = new Map<string, Row[]>();
  for (const r of rows) {
    const detay = r.surfaceConditions ? zeminDetayiBul(r.surfaceConditions as any, r.surface) : null;
    const katsayi = detay ? zeminKatsayisi(detay).katsayi : r.surface === "SENTETIK" ? 1.0 : null;
    const ck = `${surfaceToPist(r.surface)}|${katsayi}|${r.distance}`;
    const a = byContext.get(ck) ?? []; a.push(r); byContext.set(ck, a);
  }
  for (const [ck, crows] of byContext) {
    const [pist, katStr, mesafeStr] = ck.split("|");
    const katsayi = katStr === "null" ? null : Number(katStr);
    const { sonuc, weighted } = zeminMesafeHesapla(names, cutoff, pist, katsayi, Number(mesafeStr));
    for (const r of crows) {
      const v = sonuc.get(r.name);
      setC(r, "zeminMesafeDeneyim_CURRENT", { raw: v?.deger ?? 0, observed: true, reliability: 1 });
      setC(r, "zeminMesafeDeneyim_FIX_OBSERVED", v != null && v.seviye !== "yok" ? { raw: v.deger, observed: true, reliability: 1 } : NA);
      const wv = weighted.get(r.name);
      setC(r, "zeminMesafeDeneyim_WEIGHTED_CONTINUOUS", wv != null ? { raw: wv, observed: true, reliability: 1 } : NA);
    }
  }
  zmProcessed++;
  if (zmProcessed % 50 === 0) log(`  zeminMesafe tarih ${zmProcessed}/${byDate.size}`);
}
metadata.zeminMesafeDeneyimWeighted = { DIST_TAU_ZM: 250, ZM_WEIGHTED_K: 10, note: "v2: SKIP kaldirildi, formul tamamlandi (resid/distanceSimilarity/goingSimilarity/recency/baselineReliability)." };

// ═══ 7) yakinsama2Plus — DROP ═══════════════════════════════════════════════
log("7) yakinsama2Plus: DROP_YAKINSAMA (seri uretilmedi).");
skipReasons["yakinsama2Plus_CURRENT"] = "Zaten pre-registered drop-one testinde UNSUPPORTED kanitlandi; bilesenleri (pistUzmani/sireRank/ajiGalibiyet/agfTrend/sinifDususu) ayri candidate'lar olarak (11/13/14. bolumler) uretildigi icin tekrar reproduce edilmedi. DROP_YAKINSAMA = model disi, seri yok.";

// ═══ 8) sonIdmanSprint ══════════════════════════════════════════════════════
log("8) sonIdmanSprint...");
for (const r of runnerRows) {
  const gallops = (gallopsByRunner[r.runnerId] ?? []).filter((g) => g.date < r.raceDate).sort((a, b) => b.date.localeCompare(a.date));
  const enSon = gallops[0];
  setC(r, "sonIdmanSprint_CURRENT", enSon ? { raw: isSprintIdman(enSon.track) ? 1 : 0, observed: true, reliability: 1 } : NA);
  if (gallops.length === 0) { setC(r, "sonIdmanSprint_SPRINT_RATE_RECENCY", NA); setC(r, "sonIdmanSprint_SPRINT_QUALITY", NA); continue; }
  let sw = 0, swy = 0;
  for (const g of gallops) { const w = recencyWeight(g.date, r.raceDate); sw += w; swy += w * (isSprintIdman(g.track) ? 1 : 0); }
  setC(r, "sonIdmanSprint_SPRINT_RATE_RECENCY", sw > 0 ? { raw: swy / sw, observed: true, reliability: Math.min(1, sw) } : NA);
  if (enSon && isSprintIdman(enSon.track)) {
    const q = galopQuality("400", enSon.splits?.["400"] ?? null, r.breed, enSon.splits?.["ic_dis"] === "İç");
    setC(r, "sonIdmanSprint_SPRINT_QUALITY", { raw: q === "cok_iyi" ? 1 : q === "iyi" ? 0.5 : 0, observed: true, reliability: 1 });
  } else {
    setC(r, "sonIdmanSprint_SPRINT_QUALITY", { raw: 0, observed: true, reliability: 1 });
  }
}

// ═══ 9) takiDegisikligi ═════════════════════════════════════════════════════
log("9) takiDegisikligi...");
const hrhByTjk = new Map(hrhCache.map((c) => [c.tjkAtId, Array.isArray(c.rowsJson) ? c.rowsJson : []]));
const CUTOVER = "2026-07-17T00:00:00.000Z";
const FAMILIES = new Set<string>();
for (const r of runnerRows) {
  const prevRows = r.tjkAtId != null ? (hrhByTjk.get(r.tjkAtId) ?? []).filter((x: any) => x.date && new Date(x.date.split(".").reverse().join("-")) < new Date(r.raceDate)) : [];
  const last = prevRows.sort((a: any, b: any) => b.date.localeCompare(a.date))[0];
  const currentCodes = toCodes(r.equipmentCurrent);
  const pastCodes = last ? toCodes(last.equipment ?? null) : [];
  const currentFam = new Set(currentCodes.map(familyOf));
  const pastFam = new Set(pastCodes.map(familyOf));
  for (const f of currentFam) FAMILIES.add(f);
  for (const f of pastFam) FAMILIES.add(f);
  const eklendi = [...currentFam].some((f) => !pastFam.has(f));
  const cikarildi = [...pastFam].some((f) => !currentFam.has(f));
  const raw = (cikarildi ? 1 : 0) - (eklendi ? 1 : 0);
  setC(r, "takiDegisikligi_CURRENT_DIRTY", { raw, observed: true, reliability: 1 });
  const previousRaceExists = !!last;
  const clean = r.raceDate >= CUTOVER && previousRaceExists;
  setC(r, "takiDegisikligi_CLEAN_CURRENT", clean ? { raw, observed: true, reliability: 1 } : NA);
  for (const f of FAMILIES) {
    setC(r, `takiDegisikligi_FAMILY_ACTION_ADD_${f}`, clean ? { raw: currentFam.has(f) && !pastFam.has(f) ? 1 : 0, observed: true, reliability: 1 } : NA);
    setC(r, `takiDegisikligi_FAMILY_ACTION_REMOVE_${f}`, clean ? { raw: pastFam.has(f) && !currentFam.has(f) ? 1 : 0, observed: true, reliability: 1 } : NA);
  }
}
metadata.takiDegisikligi = { cutover: CUTOVER, canonicalFamilies: [...FAMILIES] };

// ═══ 10) yarisGidisatiSkoru ═════════════════════════════════════════════════
log("10) yarisGidisatiSkoru — GIDISAT_PARTIAL_EXPLORATORY (tempoTasima terimi haric, yalniz stil-uyumu; GERCEK CURRENT DEGIL)...");
const accByTjk = new Map<number, AccuraceRun[]>();
for (const r of accRuns) { const a = accByTjk.get(r.tjk) ?? []; a.push(r); accByTjk.set(r.tjk, a); }
for (const [raceId, rows] of rowsByRace) {
  const profiller = rows.map((r) => {
    if (r.tjkAtId == null) return null;
    const hist = (accByTjk.get(r.tjkAtId) ?? []).filter((x) => x.date < new Date(r.raceDate));
    const sonuclar = hist.map((h) => {
      if (!h.checkpoints?.length) return null;
      return analizEtTekYaris(h.checkpoints as unknown as PaceCheckpoint[], h.length, h.fieldSize);
    }).filter((x): x is NonNullable<typeof x> => x != null);
    const egilim = hesaplaCokYarisEgilimi(sonuclar);
    return egilim ? { dagilim: egilim.dagilim, erkenHizGucu: egilim.erkenHizGucu, n: egilim.n } : null;
  });
  const mesafe = rows[0]?.distance ?? 0;
  const sonuc = hesaplaYarisGidisati(profiller, mesafe);
  rows.forEach((r, i) => {
    const s = sonuc.atSonuclari[i];
    setC(r, "GIDISAT_PARTIAL_EXPLORATORY", { raw: s.finalSkor ?? 0, observed: true, reliability: 1 });
    setC(r, "GIDISAT_PARTIAL_EXPLORATORY_FIX_MISSING", s.finalSkor != null ? { raw: s.finalSkor, observed: true, reliability: 1 } : NA);
  });
}
metadata.yarisGidisatiSkoru = {
  CURRENT_UNAVAILABLE_FROM_FROZEN: true,
  reason: "tempoTasimaGucu (ayni-gun sibling-yuzdelik verisi) frozen bundle'da yok; production'in GERCEK CURRENT degeri bu bundle'dan uretilemez.",
  exploratorySeries: ["GIDISAT_PARTIAL_EXPLORATORY", "GIDISAT_PARTIAL_EXPLORATORY_FIX_MISSING"],
  excludeFromBaseComparison: true,
  note: "Bu 2 seri ana BASE/DROP_GIDISAT walk-forward karsilastirmasina SOKULMAMALI — yalniz tanisal/exploratory amacli.",
};

// ═══ 11) sireOrani ══════════════════════════════════════════════════════════
log("11) sireOrani...");
const SIRE_POP_ORT = 0.14, SIRE_K = 20;
const sirePopByIrk = new Map<string, { tarih: Date; win: boolean }[]>();
const sirePopByIrkPist = new Map<string, { tarih: Date; win: boolean }[]>();
const sirePopByExact = new Map<string, { tarih: Date; win: boolean }[]>();
for (const s of sirePop) {
  const tarih = new Date(s.tarih);
  const exact = `${s.irk}|${s.pist}|${s.mesafeBucket}|${s.sireNorm}`;
  const breedSurf = `${s.irk}|${s.pist}|${s.sireNorm}`;
  const breedOnly = `${s.irk}|${s.sireNorm}`;
  (sirePopByExact.get(exact) ?? sirePopByExact.set(exact, []).get(exact)!).push({ tarih, win: s.win });
  (sirePopByIrkPist.get(breedSurf) ?? sirePopByIrkPist.set(breedSurf, []).get(breedSurf)!).push({ tarih, win: s.win });
  (sirePopByIrk.get(breedOnly) ?? sirePopByIrk.set(breedOnly, []).get(breedOnly)!).push({ tarih, win: s.win });
}
function sireCount(arr: { tarih: Date; win: boolean }[] | undefined, cutoff: Date) {
  if (!arr) return { n: 0, wins: 0 };
  let n = 0, wins = 0;
  for (const a of arr) { if (a.tarih >= cutoff) continue; n++; if (a.win) wins++; }
  return { n, wins };
}
function shrink(wins: number, n: number, pop: number, k: number) { return (wins + k * pop) / (n + k); }
for (const r of runnerRows) {
  const cutoff = new Date(r.raceDate);
  if (!r.sireNorm) { setC(r, "sireOrani_CURRENT_7", { raw: SIRE_POP_ORT * 100 * 0.5, observed: true, reliability: 1 }); setC(r, "sireOrani_NO_DATA_MISSING", NA); setC(r, "sireOrani_PRIOR_14", { raw: SIRE_POP_ORT * 100, observed: true, reliability: 1 }); setC(r, "sireOrani_HIERARCHICAL", NA); continue; }
  const irk = breedToIrk(r.breed), pist = surfaceToPist(r.surface), mb = mesafeBucket(r.distance);
  const exact = sireCount(sirePopByExact.get(`${irk}|${pist}|${mb}|${r.sireNorm}`), cutoff);
  if (exact.n === 0) {
    setC(r, "sireOrani_CURRENT_7", { raw: SIRE_POP_ORT * 100 * 0.5, observed: true, reliability: 1 });
    setC(r, "sireOrani_NO_DATA_MISSING", NA);
    setC(r, "sireOrani_PRIOR_14", { raw: SIRE_POP_ORT * 100, observed: true, reliability: 1 });
  } else {
    const v = shrink(exact.wins, exact.n, SIRE_POP_ORT, SIRE_K) * 100;
    setC(r, "sireOrani_CURRENT_7", { raw: v, observed: true, reliability: 1 });
    setC(r, "sireOrani_NO_DATA_MISSING", { raw: v, observed: true, reliability: Math.min(1, exact.n / SIRE_K) });
    setC(r, "sireOrani_PRIOR_14", { raw: v, observed: true, reliability: 1 });
  }
  const breedSurf = sireCount(sirePopByIrkPist.get(`${irk}|${pist}|${r.sireNorm}`), cutoff);
  const breedOnly = sireCount(sirePopByIrk.get(`${irk}|${r.sireNorm}`), cutoff);
  let level: 1 | 2 | 3 | 4, n: number, wins: number;
  if (exact.n >= 5) { level = 1; n = exact.n; wins = exact.wins; }
  else if (breedSurf.n >= 5) { level = 2; n = breedSurf.n; wins = breedSurf.wins; }
  else if (breedOnly.n >= 5) { level = 3; n = breedOnly.n; wins = breedOnly.wins; }
  else { level = 4; n = 0; wins = 0; }
  const hv = level === 4 ? SIRE_POP_ORT * 100 : shrink(wins, n, SIRE_POP_ORT, SIRE_K) * 100;
  setC(r, "sireOrani_HIERARCHICAL", { raw: hv, observed: true, reliability: level === 4 ? 0 : Math.min(1, n / SIRE_K) });
  setC(r, "sireOrani_HIERARCHICAL_LEVEL", { raw: level, observed: true, reliability: 1 });
}
metadata.sireOrani = { SIRE_POP_ORT, SIRE_K, hierarchyMinN: 5, note: "Prior/k elle sabit (production ile ayni), fold-estimated versiyon OOS asamasinda." };

// ═══ 12) ACC family ═════════════════════════════════════════════════════════
log("12) ACC_CLOSE_RES / ACC_LATE / ACC_SPEED...");
const baselineAt = makeBaselineCache(accRuns);
const closingBaselineAt = makeClosingBaselineCache(accRuns);
let accDone = 0;
for (const r of runnerRows) {
  const hist = r.tjkAtId != null ? accByTjk.get(r.tjkAtId) ?? [] : [];
  const target: TargetRace = { date: new Date(r.raceDate), length: r.distance, surface: (r.surface as AccSurface) ?? null };
  const cr = closingResidual(hist, target, closingBaselineAt);
  const la = lateSegmentSpeed(hist, target);
  const sp = speedResidual(hist, target, baselineAt);
  setC(r, "ACC_CLOSE_RES_CURRENT", cr.observed ? { raw: cr.raw, observed: true, reliability: cr.reliability } : NA);
  setC(r, "ACC_LATE_CURRENT", la.observed ? { raw: la.raw, observed: true, reliability: la.reliability } : NA);
  setC(r, "ACC_SPEED_CURRENT", sp.observed ? { raw: sp.raw, observed: true, reliability: sp.reliability } : NA);
  accDone++;
  if (accDone % 10000 === 0) log(`  ACC ${accDone}/${runnerRows.length}`);
}
skipReasons["ACC_LATE_LOO"] = "AccuraceRun objesinde orijinal yarisi gruplayan bir anahtar (raceId benzeri) frozen bundle'da YOK — lateSegScore zaten loader asamasinda ayni-yaris medyanindan hesaplanip tasiniyor, bu turda ayni-yaris gruplamasi geriye-insa edilemedi. SKIP.";
log("12b) ACC_SPEED_LEAVE_ONE_HORSE (leave-one-horse-out baseline)...");
function buildBaselineExcluding(tjk: number, asOf: Date) {
  const g = new Map<string, number[]>();
  for (const r of accRuns) {
    if (r.date >= asOf || r.tjk === tjk) continue;
    if (!r.breed || !r.surface) continue;
    const band = r.length <= 1400 ? "S" : r.length <= 2000 ? "M" : "L";
    const k2 = `${r.breed}|${r.surface}|${band}`;
    const k1 = r.hippodrome && r.going ? `${k2}|${r.hippodrome}|${r.going}` : null;
    const pace = (r.finishMs / 1000) / r.length * 100;
    for (const k of [k1, k2]) { if (!k) continue; const a = g.get(k); if (a) a.push(pace); else g.set(k, [pace]); }
  }
  const out2 = new Map<string, { med: number; n: number }>();
  for (const [k, a] of g) { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); out2.set(k, { med: s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, n: a.length }); }
  return out2;
}
const speedLooCache = new Map<number, Map<string, { med: number; n: number }>>();
let looDone = 0, looSkipped = 0;
const LOO_MAX = 3000;
for (const r of runnerRows) {
  if (r.tjkAtId == null) { setC(r, "ACC_SPEED_LEAVE_ONE_HORSE", NA); continue; }
  if (looDone >= LOO_MAX) { setC(r, "ACC_SPEED_LEAVE_ONE_HORSE", NA); looSkipped++; continue; }
  let table = speedLooCache.get(r.tjkAtId);
  if (!table) { table = buildBaselineExcluding(r.tjkAtId, new Date(r.raceDate)); speedLooCache.set(r.tjkAtId, table); looDone++; }
  const hist = accByTjk.get(r.tjkAtId) ?? [];
  const target: TargetRace = { date: new Date(r.raceDate), length: r.distance, surface: (r.surface as AccSurface) ?? null };
  const vals: { v: number; w: number }[] = [];
  for (const h of hist) {
    if (h.date >= target.date) continue;
    const w = recencyW((target.date.getTime() - h.date.getTime()) / 86400000) * mesafeW(h.length, target.length);
    if (w <= 0 || !h.breed || !h.surface) continue;
    const band = h.length <= 1400 ? "S" : h.length <= 2000 ? "M" : "L";
    const k2 = `${h.breed}|${h.surface}|${band}`;
    const k1 = h.hippodrome && h.going ? `${k2}|${h.hippodrome}|${h.going}` : null;
    const b1 = k1 ? table.get(k1) : undefined; const b2 = table.get(k2);
    const base = b1 && b1.n >= 20 ? b1 : b2 && b2.n >= 20 ? b2 : null;
    if (!base) continue;
    const pace = (h.finishMs / 1000) / h.length * 100;
    vals.push({ v: base.med - pace, w });
  }
  if (vals.length === 0) { setC(r, "ACC_SPEED_LEAVE_ONE_HORSE", NA); continue; }
  const sw = vals.reduce((s, x) => s + x.w, 0);
  const raw = vals.reduce((s, x) => s + x.w * x.v, 0) / sw;
  setC(r, "ACC_SPEED_LEAVE_ONE_HORSE", { raw, observed: true, reliability: sw / (sw + 2) });
}
metadata.accLeaveOneHorse = {
  LOO_MAX, skipped: looSkipped,
  tag: "EXPLORATORY_SUBSET",
  note: "O(archive) maliyeti nedeniyle ilk 3000 benzersiz tjkAtId ile sinirlandi (46188'in tamami DEGIL), kalan satirlar observed=false. Bu seri tanisal/EXPLORATORY_SUBSET kabul edilmeli, full-population ana OOS model yarisina (BASE/DROP_SPEED vb.) DAHIL EDILMEMELI — yalniz subset-ici diagnostik olarak kalabilir.",
  excludeFromMainOosRace: true,
};

// ═══ 13) PS-v2 ══════════════════════════════════════════════════════════════
log("13) PS-v2...");
for (const [raceId, rows] of rowsByRace) {
  const styleOf = new Map<string, ReturnType<typeof styleVector>>();
  for (const r of rows) {
    const hist = r.tjkAtId != null ? accByTjk.get(r.tjkAtId) ?? [] : [];
    const target: TargetRace = { date: new Date(r.raceDate), length: r.distance, surface: (r.surface as AccSurface) ?? null };
    styleOf.set(r.runnerId, styleVector(hist, target));
  }
  for (const r of rows) {
    const h = styleOf.get(r.runnerId)!;
    const rivals = rows.filter((x) => x.runnerId !== r.runnerId).map((x) => styleOf.get(x.runnerId)!);
    const obsRivals = rivals.filter((x) => x.observed && x.vec);
    if (!h.observed || !h.vec) {
      for (const nm of ["PS_front", "PS_lone", "PS_closerFit", "ownFront", "ownLeader", "ownCloser", "lambda_H_ONLY", "lambda_COMBINED", "meanPressure_H_ONLY", "meanPressure_COMBINED", "LONE_A", "LONE_B", "FRONT_CONFLICT_TOTAL", "FRONT_CONFLICT_MEAN", "CLOSER_FIT_TOTAL", "CLOSER_FIT_MEAN"]) setC(r, `PSv2_${nm}`, NA);
      continue;
    }
    const ownFront = h.vec[0] + h.vec[1], ownLeader = h.vec[0], ownCloser = h.vec[4] + h.vec[5];
    let lambda = 0, prodTerm = 1, rivalRelSum = 0;
    for (const rv of obsRivals) { const rf = rv.vec![0] + rv.vec![1]; lambda += rf; prodTerm *= (1 - rf); rivalRelSum += rv.reliability; }
    const meanPressure = obsRivals.length > 0 ? lambda / obsRivals.length : 0;
    const rivalPressureReliability = obsRivals.length > 0 ? rivalRelSum / obsRivals.length : 0;
    const frontOld = lambda;
    const loneOld = ownLeader * Math.max(0, 1 - frontOld);
    const closerOld = ownCloser * frontOld;
    setC(r, "PSv2_PS_front", { raw: frontOld, observed: true, reliability: h.reliability });
    setC(r, "PSv2_PS_lone", { raw: loneOld, observed: true, reliability: h.reliability });
    setC(r, "PSv2_PS_closerFit", { raw: closerOld, observed: true, reliability: h.reliability });
    setC(r, "PSv2_ownFront", { raw: ownFront, observed: true, reliability: h.reliability });
    setC(r, "PSv2_ownLeader", { raw: ownLeader, observed: true, reliability: h.reliability });
    setC(r, "PSv2_ownCloser", { raw: ownCloser, observed: true, reliability: h.reliability });
    const combRel = h.reliability * rivalPressureReliability;
    setC(r, "PSv2_lambda_H_ONLY", { raw: lambda, observed: true, reliability: h.reliability });
    setC(r, "PSv2_lambda_COMBINED", { raw: lambda, observed: true, reliability: combRel });
    setC(r, "PSv2_meanPressure_H_ONLY", { raw: meanPressure, observed: true, reliability: h.reliability });
    setC(r, "PSv2_meanPressure_COMBINED", { raw: meanPressure, observed: true, reliability: combRel });
    setC(r, "PSv2_LONE_A", { raw: ownLeader * Math.exp(-lambda), observed: true, reliability: combRel });
    setC(r, "PSv2_LONE_B", { raw: ownLeader * prodTerm, observed: true, reliability: combRel });
    setC(r, "PSv2_FRONT_CONFLICT_TOTAL", { raw: ownFront * lambda, observed: true, reliability: combRel });
    setC(r, "PSv2_FRONT_CONFLICT_MEAN", { raw: ownFront * meanPressure, observed: true, reliability: combRel });
    setC(r, "PSv2_CLOSER_FIT_TOTAL", { raw: ownCloser * lambda, observed: true, reliability: combRel });
    setC(r, "PSv2_CLOSER_FIT_MEAN", { raw: ownCloser * meanPressure, observed: true, reliability: combRel });
  }
}
metadata.psv2 = { note: "COMBINED reliability = ownReliability*rivalPressureReliability (basit carpim, KEYFI secilmedi ama tek aday — H_ONLY ayri saklaniyor, OOS ikisini kiyaslayacak)." };

// ═══ 14) Yeni fundamentals ═══════════════════════════════════════════════════
log("14) pistUzmaniSkoru (v2 — PIT-DOGRU, per-tarih yeniden kurulum) / atJokeyUyumu / ikramiyeZorlukDegisimi...");
const PU_K = 10, AJ_K = 10, IK_HALF_LIFE = 180;
let puFutureRowsUsed = 0, puSameTargetRaceUsed = 0;
function puBucketKur(cutoff: Date, useHipodrom: boolean) {
  const bucket = new Map<string, { paceToplam: number; sayi: number }>();
  for (const s of tjkZ) {
    if (s.tarih && s.tarih >= cutoff) continue;
    const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
    if (!saniye || !metre || saniye <= 0) continue;
    const bk = useHipodrom ? `${s.irk}|${s.hipodrom}|${metre}|${kiloKategorisi(s.cinsAdi)}` : `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
    const e = bucket.get(bk) ?? { paceToplam: 0, sayi: 0 }; e.paceToplam += metre / saniye; e.sayi++; bucket.set(bk, e);
  }
  return bucket;
}
function puGoreliPaceV2(s: TjkZen, bucket: Map<string, { paceToplam: number; sayi: number }>, key: string): number | null {
  const e = bucket.get(key); if (!e || e.sayi < 5) return null;
  const metre = mesafeyeMetre(s.mesafe); const saniye = dereceyeSaniye(s.derece);
  if (!saniye || !metre || saniye <= 0) return null;
  const expected = e.paceToplam / e.sayi;
  return ((metre / saniye - expected) / expected) * 100;
}
let puProcessedDates = 0;
for (const [dateIso, rowsOfDate] of byDate) {
  const cutoff = new Date(dateIso);
  const bucketA = puBucketKur(cutoff, true);
  const bucketB = puBucketKur(cutoff, false);
  for (const r of rowsOfDate) {
    const kayitlarA = tjkZ.filter((s) => s.atAdi === r.name && s.tarih && s.tarih < cutoff && s.hipodrom === r.hippodrome);
    const valsA = kayitlarA.map((s) => puGoreliPaceV2(s, bucketA, `${s.irk}|${s.hipodrom}|${mesafeyeMetre(s.mesafe)}|${kiloKategorisi(s.cinsAdi)}`)).filter((x): x is number => x != null);
    setC(r, "pistUzmaniSkoru_A", valsA.length > 0 ? { raw: valsA.reduce((a, b) => a + b, 0) / valsA.length, observed: true, reliability: Math.min(1, valsA.length / PU_K) } : NA);
    const valsB = kayitlarA.map((s) => puGoreliPaceV2(s, bucketB, `${s.irk}|${s.pist}|${mesafeyeMetre(s.mesafe)}|${kiloKategorisi(s.cinsAdi)}`)).filter((x): x is number => x != null);
    setC(r, "pistUzmaniSkoru_B", valsB.length > 0 ? { raw: valsB.reduce((a, b) => a + b, 0) / valsB.length, observed: true, reliability: Math.min(1, valsB.length / PU_K) } : NA);
  }
  puProcessedDates++;
  if (puProcessedDates % 50 === 0) log(`  pistUzmaniSkoru tarih ${puProcessedDates}/${byDate.size}`);
}
metadata.pistUzmaniSkoru = {
  PU_K, rebuild: "v2: per-tarih (byDate) bucket, PIT-dogru (historicalDate<targetRaceDate kesin)",
  futureRowsUsedAssertion: puFutureRowsUsed, sameTargetRaceUsedAssertion: puSameTargetRaceUsed,
  note: "v1'deki TUM-GECMIS (cutoff'suz) A/B serileri v2'de URETILMEDI (BLOCKER kapatildi, eski seri yok).",
};

const histByName = new Map<string, typeof horseHist>();
for (const h of horseHist) { const a = histByName.get(h.name) ?? []; a.push(h as any); histByName.set(h.name, a); }
for (const r of runnerRows) {
  const cutoff = r.raceDate;
  const all = (histByName.get(r.name) ?? []).filter((h) => h.tarih < cutoff && h.pos != null && h.actualOrderLen && h.actualOrderLen > 1);
  if (all.length === 0) { setC(r, "atJokeyUyumu_A", NA); setC(r, "atJokeyUyumu_B", NA); continue; }
  const withJockey = all.filter((h) => h.jockey === r.jockey);
  if (withJockey.length === 0 || !r.jockey) { setC(r, "atJokeyUyumu_A", NA); setC(r, "atJokeyUyumu_B", NA); continue; }
  const fp = (h: any) => 1 - (h.pos! - 1) / (h.actualOrderLen! - 1);
  const overallMean = all.reduce((s, h) => s + fp(h), 0) / all.length;
  const jMean = withJockey.reduce((s, h) => s + fp(h), 0) / withJockey.length;
  const diffA = jMean - overallMean;
  const shrunkA = (withJockey.length / (withJockey.length + AJ_K)) * diffA;
  setC(r, "atJokeyUyumu_A", { raw: shrunkA, observed: true, reliability: Math.min(1, withJockey.length / AJ_K) });
  function contextResid(h: any): number {
    const ctxPeers = all.filter((x) => x.breed === h.breed && x.surface === h.surface && mesafeBucket(x.distance) === mesafeBucket(h.distance));
    if (ctxPeers.length < 2) return fp(h) - overallMean;
    const ctxMean = ctxPeers.reduce((s, x) => s + fp(x), 0) / ctxPeers.length;
    return fp(h) - ctxMean;
  }
  const jCtxMean = withJockey.reduce((s, h) => s + contextResid(h), 0) / withJockey.length;
  const allCtxMean = all.reduce((s, h) => s + contextResid(h), 0) / all.length;
  const diffB = jCtxMean - allCtxMean;
  setC(r, "atJokeyUyumu_B", { raw: (withJockey.length / (withJockey.length + AJ_K)) * diffB, observed: true, reliability: Math.min(1, withJockey.length / AJ_K) });
}

for (const r of runnerRows) {
  const cutoff = r.raceDate;
  const hist = (histByName.get(r.name) ?? []).filter((h) => h.tarih < cutoff && h.ikramiye1 != null);
  if (hist.length === 0 || r.ikramiye1 == null) { setC(r, "ikramiyeZorlukDegisimi", NA); continue; }
  let sw = 0, swv = 0;
  for (const h of hist) { const w = recencyWeight(h.tarih, cutoff, IK_HALF_LIFE); sw += w; swv += w * h.ikramiye1!; }
  if (sw === 0) { setC(r, "ikramiyeZorlukDegisimi", NA); continue; }
  const expected = swv / sw;
  if (expected <= 0) { setC(r, "ikramiyeZorlukDegisimi", NA); continue; }
  const raw = (r.ikramiye1 - expected) / expected;
  setC(r, "ikramiyeZorlukDegisimi", { raw, observed: true, reliability: Math.min(1, sw) });
}
metadata.newFundamentals = { PU_K, AJ_K, IK_HALF_LIFE };

// ═══ 7 EK) zeminToleransi CURRENT vs FIX_WEIGHT_NULL — gercek diff istatistigi ══
log("Ek: zeminToleransi CURRENT vs FIX_WEIGHT_NULL diff istatistigi...");
{
  let differingRows = 0, maxAbsDiff = 0, sumAbsDiff = 0, comparedN = 0, exactEqualN = 0;
  for (const r of runnerRows) {
    const k = key(r);
    const cur = out.get(k)?.["zeminToleransi_CURRENT"];
    const fix = out.get(k)?.["zeminToleransi_FIX_WEIGHT_NULL"];
    if (!cur || !fix || cur.raw == null || fix.raw == null) continue;
    comparedN++;
    const diff = Math.abs(cur.raw - fix.raw);
    if (diff > 1e-9) differingRows++; else exactEqualN++;
    if (diff > maxAbsDiff) maxAbsDiff = diff;
    sumAbsDiff += diff;
  }
  metadata.zeminToleransiFixWeightNullDiff = {
    comparedN, differingRows, maxAbsDiff: +maxAbsDiff.toFixed(6), meanAbsDiff: comparedN ? +(sumAbsDiff / comparedN).toFixed(6) : 0,
    exactEqualPct: comparedN ? +((exactEqualN / comparedN) * 100).toFixed(2) : 0,
    note: differingRows === 0
      ? "differingRows=0: bu dondurulmus donemde bug teorik olarak mevcut (kod kesinlikle farkli) ama OLCULEBILIR feature etkisi YOK — null-kilo satirlar bu veri setinde bucket ortalamasini pratikte degistirecek kadar yogun degildi."
      : "differingRows>0: bug OLCULEBILIR etki yaratiyor, FIX_WEIGHT_NULL CURRENT'ten farkli deger uretiyor.",
  };
}

// ═══ CIKTI + RAPOR (v2) ══════════════════════════════════════════════════════
log("Cikti yaziliyor (v2 dosyalari, v1 OVERWRITE EDILMIYOR)...");
const OUT_FEATURES_NAME = process.env.CHALLENGER_OUT_NAME ?? "challenger-features-v2";
const featureRows = runnerRows.map((r) => ({ raceId: r.raceId, runnerId: r.runnerId, win: r.win, challengers: out.get(key(r)) ?? {} }));
const featuresJson = JSON.stringify(featureRows);
writeFileSync(`${MP}/${OUT_FEATURES_NAME}.json`, featuresJson);
const featuresSha = sha256(featuresJson);

const allNames = new Set<string>();
for (const row of featureRows) for (const n of Object.keys(row.challengers)) allNames.add(n);
function quantile(arr: number[], q: number) { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : null; }
const statRows: Record<string, unknown>[] = [];
let nanCount = 0, infCount = 0;
for (const name of [...allNames].sort()) {
  const vals: number[] = []; let obsN = 0, totalN = 0;
  for (const row of featureRows) {
    const c = row.challengers[name]; if (!c) continue;
    totalN++;
    if (c.observed && c.raw != null) {
      obsN++;
      if (Number.isNaN(c.raw)) nanCount++;
      else if (!Number.isFinite(c.raw)) infCount++;
      else vals.push(c.raw);
    }
  }
  statRows.push({
    name, coveragePct: totalN ? +((obsN / totalN) * 100).toFixed(2) : 0, observed: obsN, total: totalN,
    min: vals.length ? Math.min(...vals) : null, p25: quantile(vals, .25), median: quantile(vals, .5), p75: quantile(vals, .75), max: vals.length ? Math.max(...vals) : null,
  });
}
const dupKeySet = new Set<string>(); let dup = 0;
for (const r of runnerRows) { const k = key(r); if (dupKeySet.has(k)) dup++; else dupKeySet.add(k); }

const pitValidation = {
  rows: featureRows.length, races: rowsByRace.size, duplicates: dup, nan: nanCount, infinity: infCount,
  structuralPitGuarantee: {
    pistUzmaniSkoru: "puBucketKur: s.tarih>=cutoff -> continue; kayitlarA: s.tarih<cutoff — futureRowsUsed=0, sameTargetRaceUsed=0 YAPI GEREGI.",
    zeminMesafeDeneyimWeighted: "atTumKayitlari: s.tarih<cutoffTarihi filtresiyle kuruldu.",
    hizDerecesiDistance: "gaussianBaselinePace: p.tarih>=cutoff -> continue (PIT yorumuyla isaretli).",
  },
  targetResultUsage: "Target sonucu (win) yalniz 'win' alaninda LABEL olarak tasiniyor, hicbir feature hesabina girmiyor.",
};

const challengerManifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sourceFrozenManifest: "manifest-v2.json",
  v1FilesOverwritten: false,
  challengerFeaturesFile: { path: `${MP}/${OUT_FEATURES_NAME}.json`, sha256: featuresSha, bytes: featuresJson.length },
  rowCount: featureRows.length, raceCount: rowsByRace.size,
  challengerCount: allNames.size,
  stats: statRows,
  nanCount, infCount, duplicateRunnerRaceRows: dup,
  skipReasons, validationNotes,
  pitValidation,
  metadata,
  productionChanged: false, betaFit: false, oosRun: false, rescueRun: false,
};
const manifestJson = JSON.stringify(challengerManifest, null, 2);
writeFileSync(`${MP}/${OUT_FEATURES_NAME.replace("features", "manifest")}.json`, manifestJson);
log(`Tamamlandi (v2): ${featureRows.length} satir, ${allNames.size} challenger, ${Date.now() - t0}ms`);
console.log(JSON.stringify({
  featuresSha, challengerCount: allNames.size, nanCount, infCount, duplicateRunnerRaceRows: dup, rowCount: featureRows.length,
  skipReasonCount: Object.keys(skipReasons).length, remainingSkipReasons: skipReasons,
  zeminToleransiFixWeightNullDiff: metadata.zeminToleransiFixWeightNullDiff,
}, null, 2));
