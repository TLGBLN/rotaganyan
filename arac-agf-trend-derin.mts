/**
 * AGF_TREND DERİN araştırma (kullanıcı isteği 2026-11-18): aynı son AGF düzeyinde farklı hareket, doğrusal olmayan etkiler, eşit zaman pencereleri, favori düşüşü, tip. SALT-OKUMA; MOTORA GİRMEZ; SINYAL_KAYDI boş.
 * Çıktı: AGF_TREND_DERIN_RAPORU.md
 */
import { agfGelecegiBoz, agfOzellik, agfSonPencere, yarisBaslangicUtc, type AgfNokta, type AgfOzellik, type AgfPencere } from "./src/lib/methodology/yeni-motor/adaylar/agf-trend-aday";
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
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, AGF_L: 1, AGF_T: 5, AGF_TR: 0.3, AGF_TE: 5, AGF_L2: 4, Tpos: 5, Tneg: 5, b1: 1, b2: 1, b4: 1, b5: 1, TL: 20, D30: 5, D60: 5, D120: 5, D240: 5, D30pos: 5, D30neg: 5, D60pos: 5, D60neg: 5, D120pos: 5, D120neg: 5, D240pos: 5, D240neg: 5, FR: 5, RISER: 1, FAVNEG: 5 } as Record<string, number>)[c] ?? 0.3;
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
const PEN = [30, 60, 120, 240]; const pencMap = new Map<string, AgfPencere[]>(); const agfMap = new Map<string, AgfOzellik>(); const baslangicMap = new Map<string, number>(); let saatYok = 0, kapsamDusuk = 0; const ksSf: typeof ksS = [];
for (const k of ksS) { const bas = yarisBaslangicUtc(dayMs(k.raceDay.date), k.time ?? null); if (bas == null) { saatYok++; continue; } const rs = k.runners; if (rs.length < 2) continue; const oz = rs.map((r) => agfOzellik(snap.get(r.id) ?? [], bas)); const pay = oz.filter((o) => o.n >= 2).length / rs.length; if (pay < 0.8) { kapsamDusuk++; continue; } ksSf.push(k); baslangicMap.set(k.id, bas); rs.forEach((r, i) => { agfMap.set(k.id + "|" + r.no, oz[i]!); pencMap.set(k.id + "|" + r.no, PEN.map((w) => agfSonPencere(snap.get(r.id) ?? [], bas, w))); }); }
console.log(`AGF'li yarış ${ksSf.length} (saati ayrıştırılamayan ${saatYok}, ≥%80 atında ≥2 kesit olmayan ${kapsamDusuk})`);
console.log("Özellikler (as-of)…"); const S = ozellikler(ksSf).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
const BIN = (t: number) => (t <= -3 ? 0 : t <= -1 ? 1 : t < 1 ? 2 : t < 3 ? 3 : 4); // 0: ≤−3, 1: −3…−1, 2: −1…+1 (düz), 3: +1…+3, 4: ≥+3 puan (önceden bildirilen sabit sınıflar)
const raceInfo = new Map<string, { fi: number; ri: number; favT: number | null; favDrop: boolean }>();
for (const k of S) {
  const oz = k.atlar.map((a) => agfMap.get(k.raceId + "|" + a.no)!); let fi = -1; oz.forEach((o, i) => { if (o?.son != null && (fi < 0 || o.son > oz[fi]!.son!)) fi = i; });
  const favT = fi >= 0 ? oz[fi]!.trend : null; const favDrop = favT != null && favT <= -3; let ri = -1; oz.forEach((o, i) => { if (i !== fi && o?.trend != null && o.trend >= 1 && (ri < 0 || o.trend > oz[ri]!.trend!)) ri = i; });
  raceInfo.set(k.raceId, { fi, ri, favT, favDrop });
  k.atlar.forEach((a, i) => { const o = oz[i]; const L = o?.seviye ?? null; const T = o?.trend ?? null; const b = T == null ? null : BIN(T);
    a.v.AGF_L = L; a.v.AGF_L2 = L == null ? null : L * L; a.v.AGF_T = T; a.v.AGF_TR = o?.trendG ?? null; a.v.Tpos = T == null ? null : Math.max(T, 0); a.v.Tneg = T == null ? null : Math.min(T, 0);
    a.v.b1 = b == null ? null : b === 0 ? 1 : 0; a.v.b2 = b == null ? null : b === 1 ? 1 : 0; a.v.b4 = b == null ? null : b === 3 ? 1 : 0; a.v.b5 = b == null ? null : b === 4 ? 1 : 0; a.v.TL = T == null || L == null ? null : T * (L - Math.log(10));
    const PP = pencMap.get(k.raceId + "|" + a.no); PEN.forEach((w, j) => { const d = PP?.[j]?.d ?? null; a.v["D" + w] = d; a.v["D" + w + "pos"] = d == null ? null : Math.max(d, 0); a.v["D" + w + "neg"] = d == null ? null : Math.min(d, 0); });
    a.v.FR = T == null ? null : favDrop ? Math.max(T, 0) : 0; a.v.RISER = favDrop && i === ri ? 1 : 0; a.v.FAVNEG = i === fi && T != null ? Math.min(T, 0) : 0; }); }
const ilkT = (P: Kosu[]) => (P.length ? new Date(Math.min(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P: Kosu[]) => (P.length ? new Date(Math.max(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—");
console.log(`S ${S.length} yarış (${ilkT(S)}→${sonT(S)})`);

// ───── sızıntı (gelecek-bozma) + bağımsız yeniden hesap — GERÇEK veride
let agfDen = 0, agfFark = 0, agfBag = 0; { const rs = new Map(ksSf.map((k) => [k.id, k])); const adaylar = S.flatMap((k) => k.atlar.map((a) => ({ k, a })));
  for (let i = 0; i < 400 && adaylar.length; i++) { const { k, a } = adaylar[Math.floor(rnd() * adaylar.length)]!; const kr = rs.get(k.raceId)!; const runner = kr.runners.find((r) => r.no === a.no)!; const bas = baslangicMap.get(k.raceId)!; const nk = snap.get(runner.id) ?? []; agfDen++; if (JSON.stringify(agfOzellik(agfGelecegiBoz(nk, bas, 5 + i), bas)) !== JSON.stringify(agfOzellik(nk, bas))) agfFark++;
    const on = nk.filter((x) => x.t < bas).sort((x, y) => x.t - y.t); const tr = on.length >= 2 ? Math.round((on[on.length - 1]!.agf - on[0]!.agf) * 1e6) / 1e6 : null; const got = a.v.AGF_T ?? null; if (!((tr == null && got == null) || (tr != null && got != null && Math.abs(tr - got) < 1e-9))) agfBag++; } }


// ───── modeller (hepsi AGF_L'yi İÇERİR: soru, kapanış düzeyi bilinirken hareketin ek bilgisi; L2 = düzeyin doğrusal olmayan hâli)
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const B4: Kol[] = ["acc", "kap", "S", "S6"]; const LL2: Kol[] = ["AGF_L", "AGF_L2"]; const MD: [string, Kol[]][] = []; const e = (ad: string, k: Kol[]) => MD.push([ad, k]);
e("L", ["AGF_L"]); e("L2", LL2); e("L+T", ["AGF_L", "AGF_T"]); e("L2+T", [...LL2, "AGF_T"]); e("L2+Tpm", [...LL2, "Tpos", "Tneg"]); e("L2+Tbin", [...LL2, "b1", "b2", "b4", "b5"]); e("L2+TL", [...LL2, "AGF_T", "TL"]);
for (const w of PEN) { e(`L2+D${w}`, [...LL2, "D" + w]); e(`L2+D${w}pm`, [...LL2, `D${w}pos`, `D${w}neg`]); }
e("L2+FR", [...LL2, "FR"]); e("L2+RISER", [...LL2, "RISER"]); e("L2+FAVNEG", [...LL2, "FAVNEG"]); e("L2+FAV3", [...LL2, "FR", "RISER", "FAVNEG"]);
e("B4L2", [...B4, ...LL2]); e("B4L2+Tpm", [...B4, ...LL2, "Tpos", "Tneg"]); e("B4L2+Tbin", [...B4, ...LL2, "b1", "b2", "b4", "b5"]); e("B4L2+D60pm", [...B4, ...LL2, "D60pos", "D60neg"]); e("B4L2+FAV3", [...B4, ...LL2, "FR", "RISER", "FAVNEG"]);
console.log(`Modeller: ${MD.length}`); console.log("Test (6 blok ileri-yönlü)…"); const R = degerlendir(S, MD, ["L2"]);
const H = { ll: R.ll as Record<string, number[]>, t1: R.t1 as Record<string, number[]>, t3: R.t3 as Record<string, number[]>, taban: R.taban, r1: R.r1, r3: R.r3, tip: R.test.map((i) => R.yk[i]!.k.tip), yari: R.test.map((_, j) => (j < R.test.length / 2 ? 0 : 1)) };
const idxOf = (f: (i: number) => boolean) => H.tip.map((_, i) => (f(i) ? i : -1)).filter((i) => i >= 0); const tum = idxOf(() => true); const TIPLER = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"].filter((t) => H.tip.includes(t)); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => H.taban[i]!)); const dl = idx.map((i) => (H.ll[b]![i]! - H.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (H.t1[a]![i]! - H.t1[b]![i]!) * 100), d3 = idx.map((i) => (H.t3[a]![i]! - H.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1].map((y) => { const q = idx.filter((i) => H.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => H.ll[b]![i]! - H.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○");
const seviye = (ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => H.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => H.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => H.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => H.t3[ad]![i]!)) * 100 }; };

// ───── betimleyici veri: piyasa olasılığı p = AGF / yarış toplamı (son ve ilk)
type Hr = { raceId: string; tip: string; i: number; y: number; ps: number | null; pi: number | null; son: number | null; ilk: number | null; T: number | null; TR: number | null; ri: number; fi: number };
const HR: Hr[] = []; for (const k of S) { const oz = k.atlar.map((a) => agfMap.get(k.raceId + "|" + a.no)!); const sS = sum(oz.map((o) => (o?.son != null && o.son > 0 ? o.son : 0))), sI = sum(oz.map((o) => (o?.ilk != null && o.ilk > 0 ? o.ilk : 0))); const ri = raceInfo.get(k.raceId)!;
  k.atlar.forEach((a, i) => { const o = oz[i]; HR.push({ raceId: k.raceId, tip: k.tip, i, y: a.kazandi ? 1 : 0, ps: o?.son != null && o.son > 0 && sS > 0 ? o.son / sS : null, pi: o?.ilk != null && o.ilk > 0 && sI > 0 ? o.ilk / sI : null, son: o?.son ?? null, ilk: o?.ilk ?? null, T: o?.trend ?? null, TR: o?.trendG ?? null, ri: ri.ri, fi: ri.fi }); }); }
const zH = (q: { y: number; p: number }[]) => { const v = sum(q.map((x) => x.p * (1 - x.p))); return { n: q.length, w: sum(q.map((x) => x.y)), e: sum(q.map((x) => x.p)), z: v > 0 ? (sum(q.map((x) => x.y)) - sum(q.map((x) => x.p))) / Math.sqrt(v) : NaN }; };

// ───── RAPOR
const L2r: string[] = []; const P = (s = "") => L2r.push(s);
P("# AGF_TREND — derin araştırma (aday sinyal DEĞİL; MOTORA/KUPONA GİRMEZ; `SINYAL_KAYDI` boş)");
P("Kullanıcının itirazı kabul edildi: trend ile kapanış düzeyi arasındaki yarış-içi korelasyon 0,08'dir; yani aynı bilgiyi ölçmüyorlar. Önceki rapordaki yargı yalnızca şuydu: **son AGF modelde varken, DOĞRUSAL bir modelde trendin ek katkısı gösterilemedi.** Bu rapor doğrusal olmayan etkileri, eşit uzunluklu zaman pencerelerini, aynı kapanış düzeyindeki atların karşılaştırmasını, favori düşüşü senaryosunu ve yarış tiplerini ayrıca sınar. AGF yalnız değerlendirmede kullanılır (2026-11-14 kararı).");
P("");
P("## 0. Düzenek ve veri gerçekleri");
P(`- **Örneklem S:** ${S.length} yarış (${ilkT(S)}→${sonT(S)}); ≥%80 atında ≥2 yarış-öncesi kesit. Tek kronolojik havuz, 6 blokluk ileri-yönlü β. **A ve B dönemiyle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**`);
P("- **Kesitler yalnız yarış GÜNÜ içindedir** (ilk kesit yarıştan medyan ~6,5 saat önce; önceki günün AGF'si yok). 'Trend' bu yüzden günün içindeki harekettir; 'ilk AGF' yarış başına farklı zamanda alınmıştır (3–10 saat önce). Kesit aralığı düzensiz (medyan ~43 dk; son kesit medyan ~1,15 saat önce).");
P("- **AGF toplam havuzdaki payıdır:** gerçek TL girişi bilinmez; havuz hacmi veride yoktur. Payın düşmesi 'para çıktı' değil, 'başkalarına daha çok girdi' de olabilir.");
P("- **Eşit zaman pencereleri:** son kesite sabitli 30/60/120/240 dk pencereleri (D30…D240 = son AGF − son kesitten en az o kadar önceki en son kesit; yoksa NULL). Kesit aralığı düzensiz olduğundan gerçek aralık ≥ pencere uzunluğudur; bölüm 4'te raporlanır.");
P("- **Sabit sınıflar (önceden bildirildi, sonuca göre ayarlanmadı):** trend sınıfları ≤−3 / −3…−1 / −1…+1 (düz) / +1…+3 / ≥+3 puan; kapanış düzeyi (son AGF %) <3 / 3–6 / 6–10 / 10–15 / 15–25 / ≥25; favori düşüşü: yarışın en yüksek son AGF'li atının trendi ≤ −3 puan.");
P(`- **Doğrulama:** gelecek-bozma testi (gerçek veri, ${agfDen} at) ${agfFark === 0 && agfDen > 0 ? "GEÇTİ" : "SIZINTI VAR (" + agfFark + ")"}; bağımsız yeniden hesap ${agfBag}/${agfDen} uyuşmaz. Pencere fonksiyonu birim testlerinde (sızıntı dahil). Ölçü cihazı: yarış-içi softmax, ridge 0,02, eksik → yarış-içi ortalama; **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; [%95 bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1./2. yarısında.`);
P("");
// 1. aynı son AGF, farklı trend
const SEV = ["<3", "3–6", "6–10", "10–15", "15–25", "≥25"]; const sevOf = (s: number) => (s < 3 ? 0 : s < 6 ? 1 : s < 10 ? 2 : s < 15 ? 3 : s < 25 ? 4 : 5); const SINIF = ["≤ −3", "−3…−1", "düz (−1…+1)", "+1…+3", "≥ +3"];
P("## 1. AYNI son AGF düzeyi, FARKLI para hareketi (kullanıcının asıl sorusu)");
P("p = piyasa olasılığı (AGF/yarış toplamı). z = (kazanan − Σp)/√Σp(1−p). Aynı kapanış düzeyinde düşen ve yükselen atlar aynı sıklıkla mı kazanıyor? Çok hücre var, düzeltme yok.");
P("| Son AGF % | Trend sınıfı (puan) | n at | Kazanan | Kazanma % | Piyasa beklentisi % | z |\n|---|---|---|---|---|---|---|");
for (let s = 0; s < SEV.length; s++) for (let c = 0; c < 5; c++) { const q = HR.filter((h) => h.son != null && h.T != null && h.ps != null && sevOf(h.son) === s && BIN(h.T) === c); if (q.length < 40) { if (q.length) P(`| ${SEV[s]} | ${SINIF[c]} | ${q.length} | (n<40) | | | |`); continue; } const z = zH(q.map((h) => ({ y: h.y, p: h.ps! }))); P(`| ${SEV[s]} | ${SINIF[c]} | ${z.n} | ${z.w} | ${fx(z.w / z.n * 100, 1)} | ${fx(z.e / z.n * 100, 1)} | ${fx(z.z, 2)} |`); }
P("");
// eşleştirilmiş fark (küme bootstrap)
type Cell = { s: number; c: 0 | 1; y: number; p: number }; const byRace = new Map<string, Cell[]>(); for (const h of HR) { if (h.son == null || h.T == null || h.ps == null) continue; const c = BIN(h.T); if (c === 2) continue; const a = byRace.get(h.raceId) ?? []; a.push({ s: sevOf(h.son), c: c >= 3 ? 1 : 0, y: h.y, p: h.ps }); byRace.set(h.raceId, a); }
const tipOf = new Map(S.map((k) => [k.raceId, k.tip])); const raceIds = [...byRace.keys()];
function eslesme(ids: string[], guclu: boolean) { const stat = (lst: string[]) => { const acc = Array.from({ length: SEV.length }, () => ({ nR: 0, yR: 0, pR: 0, nF: 0, yF: 0, pF: 0 })); for (const id of lst) for (const x of byRace.get(id)!) { const a = acc[x.s]!; if (x.c === 1) { a.nR++; a.yR += x.y; a.pR += x.p; } else { a.nF++; a.yF += x.y; a.pF += x.p; } } let w = 0, d = 0, dx = 0; for (const a of acc) { if (a.nR < 15 || a.nF < 15) continue; const wi = (a.nR * a.nF) / (a.nR + a.nF); w += wi; d += wi * (a.yR / a.nR - a.yF / a.nF); dx += wi * ((a.yR - a.pR) / a.nR - (a.yF - a.pF) / a.nF); } return w > 0 ? { d: d / w, dx: dx / w } : { d: NaN, dx: NaN }; };
  const o = stat(ids); const bd: number[] = [], bx: number[] = []; for (let b = 0; b < 400; b++) { const lst = Array.from({ length: ids.length }, () => ids[(rnd() * ids.length) | 0]!); const r = stat(lst); if (isFinite(r.d)) { bd.push(r.d); bx.push(r.dx); } } bd.sort((a, b) => a - b); bx.sort((a, b) => a - b); const q = (a: number[], p: number) => a[Math.floor(p * (a.length - 1))] ?? NaN; return { d: o.d, dLo: q(bd, 0.025), dHi: q(bd, 0.975), x: o.dx, xLo: q(bx, 0.025), xHi: q(bx, 0.975), n: ids.length }; }
P("**Eşleştirilmiş fark (aynı son-AGF düzeyi içinde; yükselen − düşen; düz olanlar dışarıda):** düzey hücrelerinde yükselen (≥+1) ve düşen (≤−1) atların kazanma yüzdesi farkı; ağırlık n_R·n_D/(n_R+n_D); **yarış kümesi bootstrap'ı** (aynı yarıştaki atlar bağımlı). 'Piyasaya göre' sütunu (kazanma − beklenen) farkıdır; ilk sütun ham kazanma yüzdesi farkıdır.");
P("| Dilim | n yarış | Ham fark (puan) [%95] | Piyasaya göre fark (puan) [%95] |\n|---|---|---|---|");
for (const [ad, f2] of [["Tümü", () => true], ...TIPLER.map((t): [string, (id: string) => boolean] => [t, (id: string) => tipOf.get(id) === t])] as [string, (id: string) => boolean][]) { const ids = raceIds.filter((id) => f2(id)); if (ids.length < 100) continue; const r = eslesme(ids, false); P(`| ${ad}${ids.length < MIN_N ? " (yetersiz n)" : ""} | ${r.n} | ${ci(r.d * 100, r.dLo * 100, r.dHi * 100)} | ${ci(r.x * 100, r.xLo * 100, r.xHi * 100)} |`); }
P("");
// 2. büyüklük
P("## 2. Hareketin büyüklüğü: doğrusal mı, yoksa büyük hareketlerde farklı mı?");
P("Piyasa beklentisine (son AGF'ye) göre kazanma. Doğrusal bir etki z'nin hareketle monoton artmasını gerektirir; basamaklı/eşikli davranış farklı görünür.");
P("**Mutlak hareket (puan):**"); P("| Trend aralığı | n at | Kazanan | Beklenen | z (son AGF) |\n|---|---|---|---|---|");
const MB: [string, (t: number) => boolean][] = [["≤ −6", (t) => t <= -6], ["−6…−3", (t) => t > -6 && t <= -3], ["−3…−1", (t) => t > -3 && t <= -1], ["−1…+1", (t) => t > -1 && t < 1], ["+1…+3", (t) => t >= 1 && t < 3], ["+3…+6", (t) => t >= 3 && t < 6], ["≥ +6", (t) => t >= 6]];
for (const [ad, g] of MB) { const q = HR.filter((h) => h.T != null && h.ps != null && g(h.T)); if (q.length < 30) continue; const z = zH(q.map((h) => ({ y: h.y, p: h.ps! }))); P(`| ${ad} | ${z.n} | ${z.w} | ${fx(z.e, 1)} | ${fx(z.z, 2)} |`); }
P(""); P("**Göreli hareket ln(son/ilk):**"); P("| Aralık | n at | Kazanan | Beklenen | z (son AGF) |\n|---|---|---|---|---|");
const RB: [string, (t: number) => boolean][] = [["≤ −0,5 (yarıya düşüş)", (t) => t <= -0.5], ["−0,5…−0,15", (t) => t > -0.5 && t <= -0.15], ["−0,15…+0,15", (t) => t > -0.15 && t < 0.15], ["+0,15…+0,5", (t) => t >= 0.15 && t < 0.5], ["≥ +0,5 (1,6 kat+)", (t) => t >= 0.5]];
for (const [ad, g] of RB) { const q = HR.filter((h) => h.TR != null && h.ps != null && g(h.TR)); if (q.length < 30) continue; const z = zH(q.map((h) => ({ y: h.y, p: h.ps! }))); P(`| ${ad} | ${z.n} | ${z.w} | ${fx(z.e, 1)} | ${fx(z.z, 2)} |`); }
P("");
// 3. model testi
P("## 3. Doğrusal olmayan modeller (kapanış düzeyi doğrusal olmayan hâliyle modelde; her satır KARŞILAŞTIRMA)");
const KARS: [string, string, string][] = [["Düzeyin doğrusal olmayan hâli (L²) ekliyor mu?", "L2", "L"], ["T (doğrusal), L² üzerine", "L2+T", "L2"], ["**T, yükseliş/düşüş AYRI eğimle (Tpos, Tneg)**", "L2+Tpm", "L2"], ["Asimetri: ayrı eğim vs tek eğim", "L2+Tpm", "L2+T"], ["**T, beş sabit sınıf (basamaklı)**", "L2+Tbin", "L2"], ["T × düzey etkileşimi, T üzerine", "L2+TL", "L2+T"],
  ["**D30 (son 30 dk penceresi)**, L² üzerine", "L2+D30", "L2"], ["D30 ayrı eğim", "L2+D30pm", "L2"], ["**D60 (son 60 dk)**", "L2+D60", "L2"], ["D60 ayrı eğim", "L2+D60pm", "L2"], ["D120", "L2+D120", "L2"], ["D120 ayrı eğim", "L2+D120pm", "L2"], ["D240", "L2+D240", "L2"], ["D240 ayrı eğim", "L2+D240pm", "L2"],
  ["**Favori düşerken diğerlerinin yükselişi (FR)**", "L2+FR", "L2"], ["Favori düşerken en büyük yükselen (RISER)", "L2+RISER", "L2"], ["Favorinin düşüşü (FAVNEG)", "L2+FAVNEG", "L2"], ["Üçü birlikte (FAV3)", "L2+FAV3", "L2"],
  ["Dört sinyalli taban + L²: T ayrı eğim", "B4L2+Tpm", "B4L2"], ["Dört sinyalli taban + L²: beş sınıf", "B4L2+Tbin", "B4L2"], ["Dört sinyalli taban + L²: D60 ayrı eğim", "B4L2+D60pm", "B4L2"], ["Dört sinyalli taban + L²: FAV3", "B4L2+FAV3", "B4L2"]];
P(`Test yarışı ${tum.length}. Model düzeyleri: L ${fx(seviye("L", tum).ll)}%, L² ${fx(seviye("L2", tum).ll)}% (1/N log-loss'un kapatılan yüzdesi).`);
P("| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|"); for (const [ad, a, b] of KARS) { const x = fark(a, b, tum); P(`| ${ad} (${a} − ${b}) | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} | ${x.tut} |`); }
P("");
// 4. pencere kapsamı
P("## 4. Eşit zaman pencereleri: kapsam ve gerçek aralık");
P("| Pencere | D'si olan at | Gerçek aralık medyan (dk) | p10 | p90 | Pencere için yarış payı (≥%80 atta D var) |\n|---|---|---|---|---|---|");
for (const [j, w] of PEN.entries()) { const all = S.flatMap((k) => k.atlar.map((a) => pencMap.get(k.raceId + "|" + a.no)?.[j])); const ok = all.filter((q) => q?.d != null); const sp = ok.map((q) => q!.spanDk!); const yp = S.filter((k) => k.atlar.filter((a) => pencMap.get(k.raceId + "|" + a.no)?.[j]?.d != null).length / k.atlar.length >= 0.8).length / S.length; const qq = (p: number) => [...sp].sort((a, b) => a - b)[Math.floor(p * (sp.length - 1))] ?? NaN; P(`| ${w} dk | ${pct(ok.length / all.length)}% | ${fx(medyan(sp), 0)} | ${fx(qq(0.1), 0)} | ${fx(qq(0.9), 0)} | ${pct(yp)}% |`); }
P("");
P("**Pencere hareketine göre kazanma (piyasa beklentisi = son AGF; yalnız D'si olan atlar):**"); P("| Pencere | Hareket (puan) | n at | Kazanan | Beklenen | z |\n|---|---|---|---|---|---|");
const DB: [string, (t: number) => boolean][] = [["≤ −3", (t) => t <= -3], ["−3…−1", (t) => t > -3 && t <= -1], ["−1…+1", (t) => t > -1 && t < 1], ["+1…+3", (t) => t >= 1 && t < 3], ["≥ +3", (t) => t >= 3]];
for (const [j, w] of PEN.entries()) for (const [ad, g] of DB) { const q: { y: number; p: number }[] = []; for (const k of S) { for (const h of HR.filter((x) => x.raceId === k.raceId)) { const d = pencMap.get(k.raceId + "|" + k.atlar[h.i]!.no)?.[j]?.d; if (d != null && h.ps != null && g(d)) q.push({ y: h.y, p: h.ps }); } } if (q.length < 30) continue; const z = zH(q); P(`| ${w} dk | ${ad} | ${z.n} | ${z.w} | ${fx(z.e, 1)} | ${fx(z.z, 2)} |`); }
P("");
// 5. favori düşüşü
P("## 5. Ters hareket: favorinin AGF'si düşerken başka bir at yükseliyor mu — kazananı bulmaya yardım ediyor mu?");
P("Favori = yarışta en yüksek son AGF'li at. 'Favori düştü' = favorinin trendi ≤ −3 puan. 'En büyük yükselen' = favori dışında trendi en yüksek (≥ +1) at.");
const favRows = (kosul: (r: { favDrop: boolean; favT: number | null }) => boolean) => { const fav: { y: number; p: number }[] = [], ris: { y: number; p: number }[] = []; let nR = 0; for (const k of S) { const ri = raceInfo.get(k.raceId)!; if (ri.fi < 0 || !kosul(ri)) continue; nR++; const hs = HR.filter((h) => h.raceId === k.raceId); const f = hs[ri.fi]; if (f?.ps != null) fav.push({ y: f.y, p: f.ps }); const r = ri.ri >= 0 ? hs[ri.ri] : null; if (r?.ps != null) ris.push({ y: r.y, p: r.ps }); } return { nR, fav: zH(fav), ris: zH(ris) }; };
P("| Yarış grubu | n yarış | Favori kazandı (n / % / beklenen %) | z (favori) | En büyük yükselen kazandı (n / % / beklenen %) | z (yükselen) |\n|---|---|---|---|---|---|");
for (const [ad, kz] of [["Favori düştü (≤ −3)", (r: { favDrop: boolean; favT: number | null }) => r.favDrop], ["Favori düz (−1…+1)", (r: { favDrop: boolean; favT: number | null }) => r.favT != null && r.favT > -1 && r.favT < 1], ["Favori yükseldi (≥ +1)", (r: { favDrop: boolean; favT: number | null }) => r.favT != null && r.favT >= 1]] as [string, (r: { favDrop: boolean; favT: number | null }) => boolean][]) { const r = favRows(kz); P(`| ${ad} | ${r.nR} | ${r.fav.w} / ${fx(r.fav.w / Math.max(1, r.fav.n) * 100, 1)} / ${fx(r.fav.e / Math.max(1, r.fav.n) * 100, 1)} | ${fx(r.fav.z, 2)} | ${r.ris.w} / ${fx(r.ris.w / Math.max(1, r.ris.n) * 100, 1)} / ${fx(r.ris.e / Math.max(1, r.ris.n) * 100, 1)} (n=${r.ris.n}) | ${fx(r.ris.z, 2)} |`); }
P("");
// 6. tip bazında
P("## 6. Yarış tipine göre (n ≥ " + MIN_N + " 'yeterli')");
const dil: [string, number[]][] = [["Tümü", tum], ...TIPLER.map((t): [string, number[]] => [t, idxOf((i) => H.tip[i] === t)])];
P("Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti); hepsi L² üzerine.");
P("| Karşılaştırma | " + dil.map(([a, idx]) => `${a} (n=${idx.length}${idx.length < MIN_N ? ", yetersiz" : ""})`).join(" | ") + " |\n|---|" + "---|".repeat(dil.length));
for (const [ad, a, b] of [["T doğrusal", "L2+T", "L2"], ["**T ayrı eğim**", "L2+Tpm", "L2"], ["T beş sınıf", "L2+Tbin", "L2"], ["D60 ayrı eğim", "L2+D60pm", "L2"], ["D30 ayrı eğim", "L2+D30pm", "L2"], ["Favori düşüşü (FAV3)", "L2+FAV3", "L2"]] as [string, string, string][]) P(`| ${ad} | ` + dil.map(([, idx]) => { const x = fark(a, b, idx); return `${isaret(x.llLo, x.llHi)} ${fx(x.ll)}% (${x.tut})`; }).join(" | ") + " |");
P("");
P("**L² modelinin kalıntısı: trend sınıfına göre (L² olasılığı beklenti; test yarışları).** Modelde kalan sistematik yapı varsa z ≠ 0:");
P("| Dilim | " + SINIF.join(" | ") + " |\n|---|" + "---|".repeat(5)); const zres = (f2: (k: Kosu) => boolean) => { const m = Array.from({ length: 5 }, () => [] as { y: number; p: number }[]); R.probs["L2"]!.forEach((pr, j) => { const k = R.yk[R.test[j]!]!.k; if (!f2(k)) return; k.atlar.forEach((a, i) => { const T = a.v.AGF_T; if (T == null) return; m[BIN(T)]!.push({ y: a.kazandi ? 1 : 0, p: pr[i]! }); }); }); return m.map((h) => (h.length < 30 ? "—" : `${fx(zH(h).z, 2)} (n=${h.length})`)); };
for (const [ad, f2] of [["Tümü", () => true], ...TIPLER.map((t): [string, (k: Kosu) => boolean] => [t, (k: Kosu) => k.tip === t])] as [string, (k: Kosu) => boolean][]) P(`| ${ad} | ${zres(f2).join(" | ")} |`);
P("");
P("## Sınırlar ve dürüst notlar");
P("- **Yalnız yarış-günü içi hareket:** kesitler yarış gününden önce başlamıyor; 'ilk AGF' yarışlara göre farklı zamanda alınmış. D pencereleri bunu eşitlemeye çalışır ama kesit aralığı düzensizdir (bölüm 4); 30 dk penceresinde gerçek aralık sıklıkla 30 dk'dan uzundur.");
P("- **AGF toplam havuz payıdır, TL girişi değildir.** 'Ani para girişi' ile 'başka atlara girişin payı düşürmesi' ayrılamaz; havuz hacmi veride yok.");
P("- **Eşleştirme/kalıntı tabloları betimleyicidir;** çok sayıda hücre düzeltilmedi. S, A ve B dönemiyle örtüşür (tekrar kullanıldı). Kalıntı tablosu yalnız ileri-yönlü β ile tahmin edilen test yarışlarındadır.");
P("- Piyasa kapanışına yakın bilgi (son kesit medyan 1,15 saat önce) gerçek kapanış değildir; son kesitten sonraki hareket görünmez.");
P("- Katkı çıksa bile AGF'nin motora girmesi gerektiği anlamına gelmez (2026-11-14 kararı); trend başarılı sinyal olarak kabul EDİLMEDİ.");
fs.writeFileSync("AGF_TREND_DERIN_RAPORU.md", L2r.join("\n"));
console.log(`YAZILDI AGF_TREND_DERIN_RAPORU.md | ${L2r.length} satır | sızıntı ${agfFark === 0 ? "YOK" : "VAR"} | bağımsız ${agfBag}/${agfDen}`);
await db.$disconnect(); process.exit(0);
