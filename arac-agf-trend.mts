/**
 * AGF_TREND araştırması (kullanıcı isteği 2026-11-18): AGF Trend'in yarışlara etkisi ve EK katkısı. SALT-OKUMA; aday sinyal DEĞİL, MOTORA/KUPONA GİRMEZ (2026-11-14 kararı), SINYAL_KAYDI boş.
 * Dört sinyalli taban / altı sinyalli taban / AGF kapanış düzeyi üzerine ek katkı; yarış tipine göre. Çıktı: AGF_TREND_RAPORU.md
 */
import { agfGelecegiBoz, agfOzellik, yarisBaslangicUtc, type AgfNokta, type AgfOzellik } from "./src/lib/methodology/yeni-motor/adaylar/agf-trend-aday";
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "./src/lib/methodology/yeni-motor/adaylar/jokey-aday";
import { DERECE_GUN_MS, DERECE_SABITLERI, DereceDeposu, dereceBilesenleri, type DereceKaydi } from "./src/lib/methodology/yeni-motor/adaylar/derece-aday";
import { ANT_GUN_MS, AntrenorDeposu, antrenorBilesenleri, type StartKaydi } from "./src/lib/methodology/yeni-motor/adaylar/antrenor-aday";
import { H2H_VARSAYILAN, H2HDeposu, h2hNetCoklu, h2hNet, type H2HKayit, type H2HPar } from "./src/lib/methodology/yeni-motor/adaylar/h2h-aday";

const TOL = 1e-9; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const SINIF_RANK: Record<string, number> = { Maiden: 1, "Şartlı": 2, "Satış": 2, Handikap: 3, KV: 3, Grup: 4 };
const jn = (j: string | null) => (j ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr"); const an = (j: string | null) => jn(j).replace(/\.\s+/g, ".");
const trTarih = (s: unknown): number | null => { const t = String(s ?? ""); let m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})/); if (m) return Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!); m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
let tohum = 1357; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── TJK geçmiş önbelleği: TÜM satırlar (referans + H2H için), GG.AA.YYYY
const YUZ_H: Record<string, string> = { K: "K", "Ç": "Ç", S: "S" }; const YUZ_R: Record<string, string> = { KUM: "K", CIM: "Ç", SENTETIK: "S" };
const sureAyir = (s: unknown): number | null => { const t = String(s ?? "").trim(); if (!t || /drc|99\.99/i.test(t)) return null; const pr = t.split("."); if (pr.length === 3) { const [m, ss, cc] = pr; const v = +m! * 60 + +ss! + +cc! / Math.pow(10, cc!.length); return isFinite(v) && v > 0 ? v : null; } return null; };
console.log("Geçmiş önbelleği okunuyor (tüm satırlar)…");
const dRows: DereceKaydi[] = []; const hRows: H2HKayit[] = []; const audit: { t: number; irk: string; yuzey: string; hip: string; mesafe: number; sure: number; tip: string }[] = []; const gecmis = new Map<number, { t: number; fp: number | null; sinif: number | null }[]>(); const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
let ham = 0, gecerliSure = 0, gecerliSira = 0, gecerliKey = 0;
for (let skip = 0; ; skip += 2000) { const parca = await db.horseRaceHistoryCache.findMany({ select: { tjkAtId: true, rowsJson: true }, orderBy: { tjkAtId: "asc" }, skip, take: 2000 }); if (!parca.length) break;
  for (const c of parca) { const liste: { t: number; fp: number | null; sinif: number | null }[] = [];
    for (const x of (c.rowsJson as Record<string, unknown>[]) ?? []) { ham++; const t = trTarih(x.date); if (t == null) continue; gEkle(c.tjkAtId, t); const fp = parseInt(String(x.finishPos ?? ""), 10); const sira = Number.isFinite(fp) && fp > 0 ? fp : null; const tip = kabaG(normalizeClassType(String(x.classType ?? ""))); liste.push({ t, fp: sira, sinif: SINIF_RANK[tip] ?? null });
      const city = String(x.city ?? "").trim().toLocaleUpperCase("tr"); const mesafe = parseInt(String(x.distance ?? ""), 10); const yuzey = YUZ_H[String(x.surface ?? "").trim().charAt(0).toLocaleUpperCase("tr")] ?? null; const gr = String(x.group ?? "").trim().toLocaleUpperCase("tr"); const irk = gr.endsWith("A") ? "ARAP" : gr.endsWith("İ") || gr.endsWith("I") ? "INGILIZ" : null; const raceNo = String(x.raceNo ?? "").trim();
      if (sira != null && city && raceNo) { gecerliSira++; hRows.push({ yarisKey: city + "|" + t + "|" + raceNo, atId: c.tjkAtId, tarih: t, sira, yuzey: yuzey ?? "?", mesafe: Number.isFinite(mesafe) ? mesafe : 0 }); }
      const sure = sureAyir(x.time); if (sure != null && city && yuzey && irk && Number.isFinite(mesafe) && mesafe >= 800 && mesafe / sure >= 10 && mesafe / sure <= 20) { gecerliSure++; dRows.push({ atId: c.tjkAtId, tarih: t, irk, yuzey, hip: city, mesafe, sure }); audit.push({ t, irk, yuzey, hip: city, mesafe, sure, tip }); } }
    gecmis.set(c.tjkAtId, liste.sort((a, b) => a.t - b.t)); } }
console.log(`satır ${ham}; geçerli resmî süre+referans alanları ${gecerliSure}; H2H için geçerli sıra+yarış anahtarı ${gecerliSira}`);
const dDep = new DereceDeposu(dRows), hDep = new H2HDeposu(hRows);

// ───── yarış listeleri, Accurace (ACC_HIZ tabanı için), galop
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, time: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { id: true, no: true, name: true, tjkAtId: true, jockey: true, trainer: true, hp: true } } };
const ksA = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksB = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date("2026-07-01T00:00:00.000Z"), lt: new Date("2026-08-16T00:00:00.000Z") }, hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
console.log(`A ${ksA.length}, B ${ksB.length} yarış`);
console.log("Accurace okunuyor…"); const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const accHam: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));
console.log("Binişler okunuyor…");
const rr = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, trainer: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
const alanN = new Map<string, number>(); for (const r of rr) alanN.set(r.race.id, (alanN.get(r.race.id) ?? 0) + 1);
const aDep = new AntrenorDeposu(rr.filter((r) => an(r.trainer)).map((r): StartKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), antrenor: an(r.trainer), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, alanN: alanN.get(r.race.id)!, pBaz: null })));
const jDep = new JokeyDeposu(rr.filter((r) => jn(r.jockey)).map((r): BinisKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: null })));


// ───── özellikler: taban (ACC, GALOP, J_SEVIYE, SON6) + kontroller + H2H ızgarası
type Kol = string; const GRID: { ad: string; par: H2HPar }[] = []; for (const hl of [90, 180, 365]) for (const lam of [1, 3, 5]) GRID.push({ ad: `H_${hl}_${lam}`, par: { yarimOmurGun: hl, lambda: lam, yuzey: "AYNI" } }); GRID.push({ ad: "HF", par: { yarimOmurGun: 180, lambda: 3, yuzey: "FARKLI" } });
const PARS = GRID.map((g) => g.par); const VARS = GRID.map((g) => g.ad); const DEF = "H_180_3"; // DEF yalnız ayrıntılı tablo için bir başlangıç; SEÇİM DEĞİL
type At = { raceId: string; no: number; kazandi: boolean; v: Record<string, number | null>; hn: number; hToplam: number; s6n: number; s6Gun: number | null };
type Kosu = { raceId: string; t: number; tip: string; ganyan: number | null; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function ozellikler(ks: typeof ksA): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gj = jDep.gorunum(t), gtr = aDep.gorunum(t), gd = dDep.gorunum(t), gh = hDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null; const hedef = { yuzey: YUZ_R[String(k.surface)] ?? "?", mesafe: k.distance }; const rakipIds = k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
      const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      out.push({ raceId: k.id, t, tip, ganyan: k.result?.ganyan ?? null, atlar: k.runners.map((r, i) => { const id = r.tjkAtId; const onceki = (id == null ? [] : gecmis.get(id) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        const d = id == null ? null : dereceBilesenleri(gd, id); const hs = id == null ? null : h2hNetCoklu(gh, id, rakipIds, hedef, PARS); const v: Record<string, number | null> = { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, S6: d?.son6 ?? null, ANT: r.trainer && an(r.trainer) ? antrenorBilesenleri(gtr, an(r.trainer)).seviye.deger : null };
        VARS.forEach((nm, q) => { v[nm] = hs ? hs[q]!.deger : null; }); const hi = VARS.indexOf(DEF);
        return { raceId: k.id, no: r.no, kazandi: win.has(r.no), v, hn: hs ? hs[hi]!.nRakip : 0, hToplam: hs ? hs[hi]!.toplamRakip : 0, s6n: d?.guven.kullanilan ?? 0, s6Gun: d?.guven.sonYarisGun ?? null }; }) }); } }
  return out;
}
// ───── ölçü cihazı
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, AGF_L: 1, AGF_T: 5, AGF_TR: 0.3, AGF_TE: 5 } as Record<string, number>)[c] ?? 0.3;
const doldur = (v: (number | null)[]) => { const a = nn(v); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
const colX = (k: Kosu, c: Kol) => doldur(k.atlar.map((a) => (a.v[c] == null ? null : (a.v[c] as number) / SK(c))));
function coz(H: number[][], g: number[]) { const K = g.length; const M = H.map((r, i) => [...r, g[i]!]); for (let c = 0; c < K; c++) { let m = c; for (let r = c + 1; r < K; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[m]![c]!)) m = r; [M[c], M[m]] = [M[m]!, M[c]!]; const d = M[c]![c]!; for (let j = c; j <= K; j++) M[c]![j]! /= d; for (let r = 0; r < K; r++) if (r !== c) { const fct = M[r]![c]!; for (let j = c; j <= K; j++) M[r]![j]! -= fct * M[c]![j]!; } } return M.map((r) => r[K]!); }
const BLOK = 6;
function fitFn(yk: { k: Kosu; w: number }[], X: (i: number, c: Kol) => number[]) { return (idx: number[], cols: Kol[]) => { const K = cols.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 30; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = Xi.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(Xi[a]!.map((v, r) => pr[r]! * v * Xi[c]![r]!)))); const w = yk[i]!.w;
      for (let a = 0; a < K; a++) g[a] += Xi[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } const d = coz(H, g); b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; }; }
const olasFn = (X: (i: number, c: Kol) => number[]) => (i: number, cols: Kol[], b: number[]) => { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); return e.map((q) => q / z); };
type Sonuc = { yk: { k: Kosu; w: number }[]; test: number[]; ll: Record<string, number[]>; t1: Record<string, number[]>; t3: Record<string, number[]>; bt: Record<string, string[]>; taban: number[]; r1: number[]; r3: number[]; probs: Record<string, number[][]> };
function degerlendir(pop: Kosu[], modeller: [string, Kol[]][], probKaydet: string[]): Sonuc {
  const yk = pop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0); const bas = (b: number) => Math.floor(yk.length * b / BLOK); const cache = new Map<string, number[]>(); const X = (i: number, c: Kol) => { const key = i + "|" + c; let v = cache.get(key); if (!v) { v = colX(yk[i]!.k, c); cache.set(key, v); } return v; };
  const fit = fitFn(yk, X), olas = olasFn(X); const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
  const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {}, probs: Record<string, number[][]> = {};
  for (const [ad, cols] of modeller) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; probs[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
    for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olas(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); if (probKaydet.includes(ad)) probs[ad]!.push(pr); } } }
  return { yk, test, ll, t1, t3, bt, taban: test.map((i) => Math.log(yk[i]!.k.atlar.length)), r1: test.map((i) => 1 / yk[i]!.k.atlar.length), r3: test.map((i) => Math.min(1, 3 / yk[i]!.k.atlar.length)), probs };
}

// ───── dış (held-out) değerlendirme: β yalnız egit örnekleminden; test örnekleminde tahmin
function degerlendirDis(egitPop: Kosu[], testPop: Kosu[], modeller: [string, Kol[]][], probKaydet: string[]): Sonuc {
  const yE = egitPop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0), yT = testPop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0); const yk = [...yE, ...yT]; const cache = new Map<string, number[]>(); const X = (i: number, c: Kol) => { const key = i + "|" + c; let v = cache.get(key); if (!v) { v = colX(yk[i]!.k, c); cache.set(key, v); } return v; };
  const fit = fitFn(yk, X), olas = olasFn(X); const egitIdx = yE.map((_, i) => i); const test = yT.map((_, i) => yE.length + i);
  const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {}, probs: Record<string, number[][]> = {};
  for (const [ad, cols] of modeller) { ll[ad] = []; t1[ad] = []; t3[ad] = []; probs[ad] = []; const b = fit(egitIdx, cols); bt[ad] = [b.map((q) => q.toFixed(2)).join("/")];
    for (const i of test) { const pr = olas(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); if (probKaydet.includes(ad)) probs[ad]!.push(pr); } }
  return { yk, test, ll, t1, t3, bt, taban: test.map((i) => Math.log(yk[i]!.k.atlar.length)), r1: test.map((i) => 1 / yk[i]!.k.atlar.length), r3: test.map((i) => Math.min(1, 3 / yk[i]!.k.atlar.length)), probs };
}

// ───── AGF dönemi: kesitler (AgfSnapshot) — yarış başlangıcından ÖNCEKİ kesitler (Race.time TR duvar saati UTC+3)
const ksS = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date("2026-07-01T00:00:00.000Z") }, hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
console.log(`AGF dönemi aday yarış ${ksS.length}; kesitler okunuyor…`);
const snap = new Map<string, AgfNokta[]>(); let nSnap = 0;
for (let i = 0; i < ksS.length; i += 150) { const ids = ksS.slice(i, i + 150).map((k) => k.id); const rows = await db.agfSnapshot.findMany({ where: { runner: { raceId: { in: ids } } }, select: { runnerId: true, agf: true, capturedAt: true } }); for (const r of rows) { nSnap++; const a = snap.get(r.runnerId) ?? []; a.push({ t: r.capturedAt.getTime(), agf: r.agf }); snap.set(r.runnerId, a); } }
console.log(`kesit ${nSnap}`);
type AgfAt = AgfOzellik & { key: string };
const agfMap = new Map<string, AgfOzellik>(); const baslangicMap = new Map<string, number>(); let saatYok = 0, kapsamDusuk = 0; const ksSf: typeof ksS = [];
for (const k of ksS) { const bas = yarisBaslangicUtc(dayMs(k.raceDay.date), k.time ?? null); if (bas == null) { saatYok++; continue; } const rs = k.runners; if (rs.length < 2) continue; const oz = rs.map((r) => agfOzellik(snap.get(r.id) ?? [], bas)); const pay = oz.filter((o) => o.n >= 2).length / rs.length; if (pay < 0.8) { kapsamDusuk++; continue; } ksSf.push(k); baslangicMap.set(k.id, bas); rs.forEach((r, i) => agfMap.set(k.id + "|" + r.no, oz[i]!)); }
console.log(`AGF'li yarış ${ksSf.length} (saati ayrıştırılamayan ${saatYok}, ≥%80 atında ≥2 kesit olmayan ${kapsamDusuk})`);
console.log("Özellikler (as-of)…"); const S = ozellikler(ksSf).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
for (const k of S) for (const a of k.atlar) { const o = agfMap.get(k.raceId + "|" + a.no); a.v.AGF_L = o?.seviye ?? null; a.v.AGF_T = o?.trend ?? null; a.v.AGF_TR = o?.trendG ?? null; a.v.AGF_TE = o?.trendE ?? null; }
const ilkT = (P: Kosu[]) => (P.length ? new Date(Math.min(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P: Kosu[]) => (P.length ? new Date(Math.max(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—");
console.log(`S ${S.length} yarış (${ilkT(S)}→${sonT(S)})`);

// ───── sızıntı (gelecek-bozma) + bağımsız yeniden hesap — GERÇEK veride
let agfDen = 0, agfFark = 0, agfBag = 0; { const rs = new Map(ksSf.map((k) => [k.id, k])); const adaylar = S.flatMap((k) => k.atlar.map((a) => ({ k, a })));
  for (let i = 0; i < 400 && adaylar.length; i++) { const { k, a } = adaylar[Math.floor(rnd() * adaylar.length)]!; const kr = rs.get(k.raceId)!; const runner = kr.runners.find((r) => r.no === a.no)!; const bas = baslangicMap.get(k.raceId)!; const nk = snap.get(runner.id) ?? []; agfDen++; if (JSON.stringify(agfOzellik(agfGelecegiBoz(nk, bas, 5 + i), bas)) !== JSON.stringify(agfOzellik(nk, bas))) agfFark++;
    const on = nk.filter((x) => x.t < bas).sort((x, y) => x.t - y.t); const tr = on.length >= 2 ? Math.round((on[on.length - 1]!.agf - on[0]!.agf) * 1e6) / 1e6 : null; const got = a.v.AGF_T ?? null; if (!((tr == null && got == null) || (tr != null && got != null && Math.abs(tr - got) < 1e-9))) agfBag++; } }

// ───── modeller
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const B4: Kol[] = ["acc", "kap", "S", "S6"]; const B6: Kol[] = [...B4, DEF, "ANT"]; const MD: [string, Kol[]][] = [];
const e = (ad: string, k: Kol[]) => MD.push([ad, k]);
e("L", ["AGF_L"]); e("L+T", ["AGF_L", "AGF_T"]); e("L+TR", ["AGF_L", "AGF_TR"]); e("L+TE", ["AGF_L", "AGF_TE"]);
e("B4", B4); e("B4+T", [...B4, "AGF_T"]); e("B4+TR", [...B4, "AGF_TR"]); e("B4+TE", [...B4, "AGF_TE"]); e("B4+L", [...B4, "AGF_L"]); e("B4+L+T", [...B4, "AGF_L", "AGF_T"]); e("B4+L+TR", [...B4, "AGF_L", "AGF_TR"]); e("B4+L+TE", [...B4, "AGF_L", "AGF_TE"]);
e("B6", B6); e("B6+T", [...B6, "AGF_T"]); e("B6+L", [...B6, "AGF_L"]); e("B6+L+T", [...B6, "AGF_L", "AGF_T"]); e("B6+L+TR", [...B6, "AGF_L", "AGF_TR"]);
e("c4", [...B4, ...KON]); e("c4+T", [...B4, ...KON, "AGF_T"]); e("c4+L", [...B4, ...KON, "AGF_L"]); e("c4+L+T", [...B4, ...KON, "AGF_L", "AGF_T"]);
console.log(`Modeller: ${MD.length}`); console.log("Test (6 blok ileri-yönlü)…"); const R = degerlendir(S, MD, []);
const H = { ll: R.ll, t1: R.t1, t3: R.t3, taban: R.taban, r1: R.r1, r3: R.r3, tip: R.test.map((i) => R.yk[i]!.k.tip), yari: R.test.map((_, j) => (j < R.test.length / 2 ? 0 : 1)) };
const idxTip = (t: string | null) => H.tip.map((x, i) => (t == null || x === t ? i : -1)).filter((i) => i >= 0); const TIPLER = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"].filter((t) => H.tip.includes(t)); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => H.taban[i]!)); const dl = idx.map((i) => (H.ll[b]![i]! - H.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (H.t1[a]![i]! - H.t1[b]![i]!) * 100), d3 = idx.map((i) => (H.t3[a]![i]! - H.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1].map((y) => { const q = idx.filter((i) => H.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => H.ll[b]![i]! - H.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○");
const seviye = (ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => H.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => H.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => H.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => H.t3[ad]![i]!)) * 100 }; };

// ───── korelasyon / R²
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
const rPar = (pop: Kosu[], x: Kol, y: Kol) => { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); };
function r2(pop: Kosu[], onceki: Kol[], yeni: Kol) { const rows = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50) return NaN; const Hh = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) Hh[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) Hh[a]![a] += 1e-9; const b = coz(Hh, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }

// ───── RAPOR
const L2: string[] = []; const P = (s = "") => L2.push(s);
P("# AGF_TREND — ek katkı araştırması (aday sinyal DEĞİL; MOTORA/KUPONA GİRMEZ; `SINYAL_KAYDI` boş)");
P("Soru: **AGF Trend (yarış öncesi kesitlerde son − ilk AGF) yarışın kazananını bulmaya, (a) dört sinyalli tabana, (b) AGF'nin son düzeyine (piyasanın kapanışa yakın görüşü) ve (c) altı sinyalli tabana EK bilgi katıyor mu?** AGF yalnız değerlendirmede kullanılır (kullanıcı kararı 2026-11-14); bu çalışma salt-okuma bir ölçümdür.");
P("");
P("## 0. Tanım, veri, doğrulama");
P("- **Kesitler:** `AgfSnapshot` (günde ~4 kez). Yarış başlangıcı = `Race.time` (TR duvar saati, UTC+3) + yarış günü; **yalnız başlangıçtan KESİN önceki kesitler** kullanılır (mevcut `getAgfTrendForRace` ile aynı kural). Saat ayrıştırılamayan yarış dışarıda (sessiz varsayım yok).");
P("- **AGF_TREND (T)** = son − ilk (yüzde puan; koddaki mevcut tanım). Tek kesitli atta NULL. Karşılaştırma: **TR** = ln(son/ilk) (göreli; küçük paydada gürültülü), **TE** = başlangıçtan ≥2 saat önceki son kesit − ilk (kapanışa yakın bilgiyi dışarıda bırakan duyarlılık). **L** = ln(son AGF) (piyasanın kapanışa yakın düzeyi; yalnız karşılaştırma için).");
P("- Hiçbir tanım sonuca göre SEÇİLMEDİ: T asıl tanımdır (koddaki), TR ve TE duyarlılık olarak yan yana.");
P(`- **Örneklem S:** 2026-07-01 sonrası, ≥%80 atında ≥2 yarış-öncesi kesit olan ${S.length} yarış (${ilkT(S)}→${sonT(S)}; AGF kesitleri ancak Temmuz 2026'dan beri birikiyor). Tek kronolojik örneklem, 6 blokluk ileri-yönlü β (β yalnız önceki bloklardan; ilk blok yalnız eğitim). **S, daha önce A ve B olarak tekrar kullanılan dönemle örtüşür; bağımsız/ileri-yönlü doğrulama DEĞİLDİR.**`);
P(`- **Gelecek-bozma testi (gerçek veri, ${agfDen} at):** ${agfFark === 0 && agfDen > 0 ? "GEÇTİ — sızıntı yok" : "SIZINTI VAR (" + agfFark + ")"} (başlangıç ve sonrası kesitler bozulur, sahte uç kesitler eklenir). **Bağımsız yeniden hesap:** ${agfDen} atta ${agfBag} uyuşmaz. Birim testleri vitest'te geçiyor.`);
P("- **Ölçü cihazı:** yarış-içi softmax (koşullu logit), ridge 0,02; eksik → yarış-içi ortalama. **ΔLL%** = (dar model log-loss − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]. ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ sıfırın altında. 'Tut.' = ΔLL işareti test yarışlarının 1. ve 2. yarısında.");
P("");
// 1. kapsam ve kesit zamanlaması
const tumAt = S.flatMap((k) => k.atlar.map((a) => ({ k, a, o: agfMap.get(k.raceId + "|" + a.no)! }))); const lag = tumAt.map((x) => x.o?.sonGecikmeSaat).filter((q): q is number => q != null); const nKes = tumAt.map((x) => x.o?.n ?? 0);
P("## 1. Kapsam ve kesit zamanlaması");
P(`- Koşan at ${tumAt.length}. AGF seviyesi (≥1 kesit) olan at ${pct(tumAt.filter((x) => x.o?.seviye != null).length / tumAt.length)}%; **trendi (≥2 kesit) olan at ${pct(tumAt.filter((x) => x.o?.trend != null).length / tumAt.length)}%**; erken trendi (başlangıçtan ≥2 saat önce ≥2 kesit) olan ${pct(tumAt.filter((x) => x.o?.trendE != null).length / tumAt.length)}%.`);
P(`- At başına kesit sayısı: medyan ${f(medyan(nKes), 0)}, ortalama ${f(mean(nKes), 1)}. **Son kesitin yarış başlangıcından uzaklığı (saat):** medyan ${f(medyan(lag), 2)}; ≤1 saat ${pct(lag.filter((q) => q <= 1).length / lag.length)}%; ≤3 saat ${pct(lag.filter((q) => q <= 3).length / lag.length)}%; >6 saat ${pct(lag.filter((q) => q > 6).length / lag.length)}%.`);
P(`- Trend dağılımı (yüzde puan): medyan ${f(medyan(tumAt.map((x) => x.o?.trend).filter((q): q is number => q != null)), 2)}; |trend|≥1 puan olan at ${pct(tumAt.filter((x) => x.o?.trend != null && Math.abs(x.o.trend) >= 1).length / tumAt.filter((x) => x.o?.trend != null).length)}%.`);
P("");
// 2. betimleyici
P("## 2. Betimleyici: trend, kapanış düzeyine rağmen kazananı gösteriyor mu? (TÜM S örnekleme, as-of özellik; yalnız bilgi)");
P("Her at için piyasa olasılığı p = AGF / (yarıştaki AGF toplamı). z = (kazanan − Σp)/√Σp(1−p). **'z (son AGF)'**: kapanışa yakın düzeyin ima ettiği beklentiye göre; **'z (ilk AGF)'**: açılış düzeyine göre. Trend kapanış düzeyinde zaten fiyatlanmışsa 'z (son AGF)' ≈ 0 beklenir. Çok sayıda hücre var; düzeltme yok.");
P("| Trend aralığı (puan) | n at | Kazanan | Beklenen (son AGF) | z (son AGF) | Beklenen (ilk AGF) | z (ilk AGF) |\n|---|---|---|---|---|---|---|");
const bins: [string, (t: number) => boolean][] = [["≤ −3", (t) => t <= -3], ["−3 … −1", (t) => t > -3 && t <= -1], ["−1 … +1", (t) => t > -1 && t < 1], ["+1 … +3", (t) => t >= 1 && t < 3], ["≥ +3", (t) => t >= 3]];
const yarisSon = new Map<string, number>(), yarisIlk = new Map<string, number>(); for (const x of tumAt) { yarisSon.set(x.k.raceId, (yarisSon.get(x.k.raceId) ?? 0) + (x.o?.son ?? 0)); yarisIlk.set(x.k.raceId, (yarisIlk.get(x.k.raceId) ?? 0) + (x.o?.ilk ?? 0)); }
for (const [ad, g] of bins) { const q = tumAt.filter((x) => x.o?.trend != null && x.o.son != null && x.o.ilk != null && g(x.o.trend) && (yarisSon.get(x.k.raceId) ?? 0) > 0 && (yarisIlk.get(x.k.raceId) ?? 0) > 0); const ps = q.map((x) => x.o.son! / yarisSon.get(x.k.raceId)!), pi = q.map((x) => x.o.ilk! / yarisIlk.get(x.k.raceId)!); const y = q.map((x) => (x.a.kazandi ? 1 : 0)); const z = (p: number[]) => (sum(y) - sum(p)) / Math.sqrt(sum(p.map((v) => v * (1 - v)))); P(`| ${ad} | ${q.length} | ${sum(y)} | ${f(sum(ps), 1)} | ${f(z(ps), 2)} | ${f(sum(pi), 1)} | ${f(z(pi), 2)} |`); }
P("");
// 3. korelasyon
P("## 3. Örtüşme (yarış içi merkezlenmiş)");
P("| Sinyal | r(AGF_L) | r(ACC_HIZ) | r(GALOP) | r(J_SEVIYE) | r(SON6) | R² (taban 4 + AGF_L) | R² (yalnız taban 4) |\n|---|---|---|---|---|---|---|---|");
for (const nm of ["AGF_T", "AGF_TR", "AGF_TE"]) P(`| ${nm} | ${f(rPar(S, "AGF_L", nm), 2)} | ${f(rPar(S, "acc", nm), 2)} | ${f(rPar(S, "kap", nm), 2)} | ${f(rPar(S, "S", nm), 2)} | ${f(rPar(S, "S6", nm), 2)} | ${f(r2(S, [...B4, "AGF_L"], nm), 3)} | ${f(r2(S, B4, nm), 3)} |`);
P(`| AGF_L (karşılaştırma) | — | ${f(rPar(S, "acc", "AGF_L"), 2)} | ${f(rPar(S, "kap", "AGF_L"), 2)} | ${f(rPar(S, "S", "AGF_L"), 2)} | ${f(rPar(S, "S6", "AGF_L"), 2)} | — | ${f(r2(S, B4, "AGF_L"), 3)} |`);
P("");
// 4. model düzeyleri
const tum = idxTip(null);
P("## 4. Model düzeyleri (test yarışları; aynı yarışlarda)");
P(`Test yarışı ${tum.length}; rastgele (1/N) Top1 ${fx(mean(tum.map((i) => H.r1[i]!)) * 100, 1)}%, Top3 ${fx(mean(tum.map((i) => H.r3[i]!)) * 100, 1)}%. 'Kazanç %' = 1/N log-loss'un yüzde kaçı kapatıldı.`);
P("| Model | Kazanç % | Top1 % | Top3 % |\n|---|---|---|---|"); for (const [ad] of MD) { const s = seviye(ad, tum); P(`| ${ad} | ${fx(s.ll)}% | ${fx(s.t1, 1)}% | ${fx(s.t3, 1)}% |`); }
P("");
// 5. ek katkı
const KARS: [string, string, string][] = [
  ["AGF_L (kapanış düzeyi) dört sinyalli tabana", "B4+L", "B4"], ["**AGF_T dört sinyalli tabana**", "B4+T", "B4"], ["AGF_TR dört sinyalli tabana", "B4+TR", "B4"], ["AGF_TE dört sinyalli tabana", "B4+TE", "B4"],
  ["**AGF_T, taban 4 + AGF_L üzerine (asıl soru)**", "B4+L+T", "B4+L"], ["AGF_TR, taban 4 + AGF_L üzerine", "B4+L+TR", "B4+L"], ["AGF_TE, taban 4 + AGF_L üzerine", "B4+L+TE", "B4+L"],
  ["AGF_T, AGF_L tek başına üzerine (yalnız piyasa)", "L+T", "L"], ["AGF_TE, AGF_L tek başına üzerine", "L+TE", "L"], ["Dört sinyalli taban, AGF_L üzerine (bizim sinyaller piyasaya ek katıyor mu?)", "B4+L", "L"],
  ["AGF_T altı sinyalli tabana", "B6+T", "B6"], ["AGF_L altı sinyalli tabana", "B6+L", "B6"], ["**AGF_T, altı sinyal + AGF_L üzerine**", "B6+L+T", "B6+L"], ["AGF_TR, altı sinyal + AGF_L üzerine", "B6+L+TR", "B6+L"],
  ["AGF_T, kontrollü taban (c4) üzerine", "c4+T", "c4"], ["AGF_T, kontrollü taban + AGF_L üzerine", "c4+L+T", "c4+L"]];
P("## 5. Ek katkı (tüm test yarışları)");
P("| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|"); for (const [ad, a, b] of KARS) { const x = fark(a, b, tum); P(`| ${ad} (${a} − ${b}) | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} | ${x.tut} |`); }
P("");
// 6. tipe göre
P("## 6. Yarış tipine göre (n ≥ " + MIN_N + " 'yeterli')");
P("Her hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). β tüm tiplerde ortak eğitildi.");
const TK: [string, string, string][] = [["AGF_L → taban 4", "B4+L", "B4"], ["AGF_T → taban 4", "B4+T", "B4"], ["**AGF_T → taban 4 + AGF_L**", "B4+L+T", "B4+L"], ["AGF_TE → taban 4 + AGF_L", "B4+L+TE", "B4+L"], ["AGF_T → altı sinyal + AGF_L", "B6+L+T", "B6+L"]];
const dil: [string, number[]][] = [["Tümü", tum], ...TIPLER.map((t): [string, number[]] => [t, idxTip(t)])];
P("| Karşılaştırma | " + dil.map(([a, idx]) => `${a} (n=${idx.length}${idx.length < MIN_N ? ", yetersiz" : ""})`).join(" | ") + " |\n|---|" + "---|".repeat(dil.length)); for (const [ad, a, b] of TK) P(`| ${ad} | ` + dil.map(([, idx]) => { const x = fark(a, b, idx); return `${isaret(x.llLo, x.llHi)} ${fx(x.ll)}% (${x.tut})`; }).join(" | ") + " |");
P("");
P("**Asıl karşılaştırma (AGF_T → taban 4 + AGF_L) tip başına ayrıntı:**"); P("| Tip | n | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |\n|---|---|---|---|---|");
for (const [ad, idx] of dil) { if (idx.length < 40) continue; const x = fark("B4+L+T", "B4+L", idx); P(`| ${ad}${idx.length < MIN_N ? " (yetersiz n)" : ""} | ${idx.length} | ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} |`); }
P("");
P("## Sınırlar ve dürüst notlar");
P("- **AGF kesitleri yalnız Temmuz 2026'dan beri** birikiyor; S, A ve B olarak tekrar kullanılan dönemle örtüşür. Bağımsız ileri-yönlü doğrulama için yeni yarışlarla aynı aracın yeniden çalıştırılması gerekir.");
P("- **Piyasa kapanışa yakın bilgi taşır:** son kesit yarışa saatler kala olabilir (bölüm 1). AGF_L ile kıyas piyasanın kapanış görüşünü yaklaşık gösterir; gerçek kapanış oranı değildir (AGF altılı ganyan favorisi yüzdesidir, ganyan oranı değildir). TE duyarlılığı kapanışa yakın bilgiyi çıkarır.");
P("- **Trend yönü iki yönlü yorumlanabilir:** AGF yükselen at 'paranın aktığı' at olabilir; ama sinyalin yarış-öncesi bilgi mi yoksa piyasanın zaten bilinen verileri fiyatlaması mı olduğu bu testle ayrılamaz. Katkı varsa bile bu, AGF'nin motora girmesi gerektiği anlamına gelmez (2026-11-14 kararı geçerli).");
P("- Çok sayıda karşılaştırma (model × tip × ölçüt) düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Doğrusal-logit ve ortak β varsayımı geçerlidir.");
fs.writeFileSync("AGF_TREND_RAPORU.md", L2.join("\n"));
console.log(`YAZILDI AGF_TREND_RAPORU.md | ${L2.length} satır | sızıntı ${agfFark === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan ${agfBag}/${agfDen}`);
await db.$disconnect(); process.exit(0);
