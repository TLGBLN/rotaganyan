/**
 * SİNYAL ÖZGÜN KATKI VE GÖLGELENME — AGF'siz ve AGF kontrollü ayrı ölçüm (kullanıcı kararı 2026-11-18). SALT-OKUMA; AGF sinyal havuzunda DEĞİL, ayrı karşılaştırma katmanı; SINYAL_KAYDI boş.
 * Çıktı: SINYAL_GOLGE_RAPORU.md
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
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, AGF_L: 1, AGF_T: 5, AGF_TR: 0.3, AGF_TE: 5, AGF_L2: 4 } as Record<string, number>)[c] ?? 0.3;
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


// ───── ÖRNEKLEM: AGF'li ∧ galop kapsamlı yarışlar (aynı yarışlarda tüm karşılaştırmalar; kapsam koşulları yarıştan ÖNCE bilinir)
for (const k of S) for (const a of k.atlar) a.v.AGF_L2 = a.v.AGF_L == null ? null : (a.v.AGF_L as number) ** 2;
const kapliG = (k: Kosu) => k.atlar.filter((a) => a.v.kap != null).length / k.atlar.length >= 0.7; const SS = S.filter(kapliG); console.log(`SS (AGF'li ∧ galop kapsamlı) ${SS.length}/${S.length}`);

// ───── modeller
const SIG = ["acc", "kap", "S6", "S", DEF]; const AD: Record<string, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S6: "SON6", S: "J_SEVIYE", [DEF]: "H2H_NET" }; const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const LL2: Kol[] = ["AGF_L", "AGF_L2"]; const nm = (s: string) => AD[s]!;
const MD: [string, Kol[]][] = []; const e = (ad: string, k: Kol[]) => MD.push([ad, k]);
for (const s of SIG) e("alone_" + s, [s]);
for (let i = 0; i < SIG.length; i++) for (let j = i + 1; j < SIG.length; j++) e(`pair_${SIG[i]}_${SIG[j]}`, [SIG[i]!, SIG[j]!]);
SIG.forEach((_, i) => e("F" + (i + 1), SIG.slice(0, i + 1))); for (const s of SIG) e("F-" + s, SIG.filter((x) => x !== s));
e("A0", LL2); for (const s of SIG) e("A_" + s, [...LL2, s]); SIG.forEach((_, i) => e("A" + (i + 1), [...LL2, ...SIG.slice(0, i + 1)])); for (const s of SIG) e("A-" + s, [...LL2, ...SIG.filter((x) => x !== s)]);
e("cF5", [...SIG, ...KON]); for (const s of SIG) e("cF-" + s, [...SIG.filter((x) => x !== s), ...KON]); e("cA0", [...LL2, ...KON]); e("cA5", [...LL2, ...SIG, ...KON]); for (const s of SIG) e("cA-" + s, [...LL2, ...SIG.filter((x) => x !== s), ...KON]);
console.log(`Modeller: ${MD.length}`); console.log("Test (6 blok ileri-yönlü)…"); const R = degerlendir(SS, MD, []);
const H = { ll: { ...R.ll, "1N": R.taban } as Record<string, number[]>, t1: { ...R.t1, "1N": R.r1 } as Record<string, number[]>, t3: { ...R.t3, "1N": R.r3 } as Record<string, number[]>, taban: R.taban, r1: R.r1, r3: R.r3, tip: R.test.map((i) => R.yk[i]!.k.tip), yari: R.test.map((_, j) => (j < R.test.length / 2 ? 0 : 1)) };
const idxOf = (f: (i: number) => boolean) => H.tip.map((_, i) => (f(i) ? i : -1)).filter((i) => i >= 0); const tum = idxOf(() => true); const TIPLER = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"].filter((t) => H.tip.includes(t)); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => H.taban[i]!)); const dl = idx.map((i) => (H.ll[b]![i]! - H.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (H.t1[a]![i]! - H.t1[b]![i]!) * 100), d3 = idx.map((i) => (H.t3[a]![i]! - H.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1].map((y) => { const q = idx.filter((i) => H.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => H.ll[b]![i]! - H.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○");
const seviye = (ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => H.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => H.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => H.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => H.t3[ad]![i]!)) * 100 }; };
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
const rPar = (pop: Kosu[], x: Kol, y: Kol) => { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); };
function r2(pop: Kosu[], onceki: Kol[], yeni: Kol) { const rows = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50) return NaN; const Hh = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) Hh[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) Hh[a]![a] += 1e-9; const b = coz(Hh, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }
const hucre = (x: Fark, d = 2) => `${isaret(x.llLo, x.llHi)} ${fx(x.ll, d)}%`;

// ───── RAPOR
const L2r: string[] = []; const P = (s = "") => L2r.push(s);
P("# Sinyallerin özgün katkısı ve gölgelenmesi — AGF'siz ve AGF kontrollü ayrı ölçüm (aktif sinyal 0; AGF sinyal havuzunda DEĞİL)");
P("Kullanıcı kararı: AGF motorun sinyal havuzuna katılmaz; ayrı bir **karşılaştırma katmanı**dır. İki ayrı ölçüm: **(1) AGF'siz:** ACC_HIZ, GALOP_KAPASITE, SON6, J_SEVIYE, H2H_NET birbirlerine göre özgün katkı ve gölgeleme. **(2) AGF kontrollü:** aynı sinyaller, AGF'nin son düzeyi (L ve doğrusal olmayan L²) modeldeyken piyasanın bildiğinin ötesinde bilgi veriyor mu. AGF hareketi (trend) bu çalışmada KULLANILMADI.");
P("");
P("## 0. Düzenek");
P(`- **Örneklem SS:** AGF'li (≥%80 atında ≥2 yarış-öncesi kesit) ve galop kapsamlı (≥%70 atında GALOP_KAPASITE var) ${SS.length} yarış (${ilkT(SS)}→${sonT(SS)}). Her karşılaştırma AYNI yarışlarda (AGF'siz ve AGF'li modeller birebir aynı test yarışlarında). Tek kronolojik havuz, 6 blokluk ileri-yönlü β. **A ve B dönemiyle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**`);
P("- **AGF katmanı:** L = ln(son AGF) ve L² (kapanışa yakın piyasa düzeyi, yaklaşık; son kesit yarıştan medyan ~1,15 saat önce). AGF altılı ganyan favorisi yüzdesidir, TL girişi değildir. H2H_NET başlangıç H_180_3 (seçim değil).");
P("- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1./2. yarısında. **Özgün katkı (LOO)** = beş sinyalli model − o sinyalsiz model. **Gölgelenme oranı** = LOO ÷ tek başına katkı (1'e yakın: sinyal bağımsız bilgi veriyor; 0'a yakın: diğerleri/piyasa tarafından gölgeleniyor).");
P(`- Doğrulama: AGF gelecek-bozma testi (gerçek veri, ${agfDen} at) ${agfFark === 0 && agfDen > 0 ? "GEÇTİ" : "SIZINTI VAR"}, bağımsız yeniden hesap ${agfBag}/${agfDen} uyuşmaz. H2H, GALOP, ACC, SON6, J_SEVIYE için gelecek-bozma/bağımsız hesap testleri önceki raporlarda ve birim testlerinde (vitest) geçmiştir; bu çalışmada yeniden koşulmadı.`);
P("");
P(`Test yarışı ${tum.length}; 1/N Top1 ${fx(mean(tum.map((i) => H.r1[i]!)) * 100, 1)}%, Top3 ${fx(mean(tum.map((i) => H.r3[i]!)) * 100, 1)}%.`);
P("");
// 1. örtüşme
P("## 1. Örtüşme (yarış içi merkezlenmiş)");
P("| Sinyal | " + SIG.map((s) => "r(" + nm(s) + ")").join(" | ") + " | r(AGF_L) | r(AGF trend) | R² (diğer dört sinyal) | R² (AGF_L, L² ile) |\n|---|" + "---|".repeat(SIG.length + 4));
for (const s of SIG) P(`| ${nm(s)} | ` + SIG.map((q) => (q === s ? "—" : f(rPar(SS, q, s), 2))).join(" | ") + ` | ${f(rPar(SS, "AGF_L", s), 2)} | ${f(rPar(SS, "AGF_T", s), 2)} | ${f(r2(SS, SIG.filter((x) => x !== s), s), 3)} | ${f(r2(SS, LL2, s), 3)} |`);
P("");
P(`**AGF seviyesi sinyallerle ne kadar açıklanıyor?** AGF_L'nin beş sinyalle doğrusal R²'si: ${f(r2(SS, SIG, "AGF_L"), 3)} (yarış-içi sapmalar). AGF trendinin beş sinyalle R²'si: ${f(r2(SS, SIG, "AGF_T"), 3)}. Bu, piyasa hareketinin (trend) bu sinyallerden kaynaklandığına dair bir kanıt ARAMAK içindir; düşük R² 'galop AGF'yi hareket ettiriyor' hipotezini desteklemez (ama çürütmez: nedensel yön bu testle bilinemez).`);
P("");
// 2. AGF'siz
P("## 2. AGF'SİZ ölçüm: sinyaller birbirini gölgeliyor mu?");
P("| Sinyal | Tek başına ΔLL% (1/N'ye) | Sıralı ekleme (listelenen sıra) ΔLL% | **Özgün katkı (LOO) ΔLL% [%95]** | Gölgelenme oranı (LOO ÷ tek) | LOO ΔTop1 p | LOO ΔTop3 p | Tut. |\n|---|---|---|---|---|---|---|---|");
for (let i = 0; i < SIG.length; i++) { const s = SIG[i]!; const alone = fark("alone_" + s, "1N", tum); const seq = i === 0 ? fark("F1", "1N", tum) : fark("F" + (i + 1), "F" + i, tum); const loo = fark("F5", "F-" + s, tum); P(`| ${nm(s)} | ${hucre(alone)} | ${hucre(seq)}${i === 0 ? " (1/N'ye)" : ""} | ${isaret(loo.llLo, loo.llHi)} ${ci(loo.ll, loo.llLo, loo.llHi)} | ${fx(loo.ll / alone.ll, 2)} | ${ci(loo.t1, loo.t1Lo, loo.t1Hi, 1)} | ${ci(loo.t3, loo.t3Lo, loo.t3Hi, 1)} | ${loo.tut} |`); }
P(""); P(`Beş sinyalli model (F5): kazanç ${fx(seviye("F5", tum).ll)}%, Top1 ${fx(seviye("F5", tum).t1, 1)}%, Top3 ${fx(seviye("F5", tum).t3, 1)}%.`); P("");
P("**İkili gölgeleme matrisi:** hücre = SÜTUN sinyalinin SATIR sinyaline eklenmesinin ΔLL%'si (✓ sıfırın üstü). Tek başına katkıya göre ne kadar düşüyorsa o ikili gölgeleniyor.");
P("| Satır (taban) \\ Eklenen | " + SIG.map(nm).join(" | ") + " |\n|---|" + "---|".repeat(SIG.length));
for (const a of SIG) P(`| ${nm(a)} | ` + SIG.map((b) => { if (a === b) return "—"; const nmP = SIG.indexOf(a) < SIG.indexOf(b) ? `pair_${a}_${b}` : `pair_${b}_${a}`; const x = fark(nmP, "alone_" + a, tum); return hucre(x); }).join(" | ") + " |");
P("");
// 3. AGF kontrollü
P("## 3. AGF KONTROLLÜ ölçüm: piyasanın bildiğinin ötesinde bilgi veriyor mu?");
P(`AGF düzeyi (L, L²) tek başına: kazanç ${fx(seviye("A0", tum).ll)}%, Top1 ${fx(seviye("A0", tum).t1, 1)}%, Top3 ${fx(seviye("A0", tum).t3, 1)}%. Beş sinyalli AGF'siz model (F5): ${fx(seviye("F5", tum).ll)}%. AGF + beş sinyal (A5): ${fx(seviye("A5", tum).ll)}%, Top1 ${fx(seviye("A5", tum).t1, 1)}%, Top3 ${fx(seviye("A5", tum).t3, 1)}%.`);
const a5 = fark("A5", "A0", tum), f5a = fark("A5", "F5", tum); P(`- **Beş sinyal, AGF üzerine (A5 − A0):** ΔLL% ${ci(a5.ll, a5.llLo, a5.llHi)}; ΔTop1 ${ci(a5.t1, a5.t1Lo, a5.t1Hi, 1)}; ΔTop3 ${ci(a5.t3, a5.t3Lo, a5.t3Hi, 1)}. **AGF, beş sinyal üzerine (A5 − F5):** ΔLL% ${ci(f5a.ll, f5a.llLo, f5a.llHi)}.`);
P("");
P("| Sinyal | AGF üzerine tek başına ΔLL% [%95] | **AGF + diğer dört üzerine (özgün katkı) ΔLL% [%95]** | AGF'siz özgün katkı | **Korunma oranı** (AGF'li ÷ AGF'siz) | ΔTop1 p | ΔTop3 p | Tut. |\n|---|---|---|---|---|---|---|---|");
for (const s of SIG) { const t = fark("A_" + s, "A0", tum), loo = fark("A5", "A-" + s, tum), free = fark("F5", "F-" + s, tum); P(`| ${nm(s)} | ${isaret(t.llLo, t.llHi)} ${ci(t.ll, t.llLo, t.llHi)} | ${isaret(loo.llLo, loo.llHi)} ${ci(loo.ll, loo.llLo, loo.llHi)} | ${hucre(free)} | ${fx(loo.ll / free.ll, 2)} | ${ci(loo.t1, loo.t1Lo, loo.t1Hi, 1)} | ${ci(loo.t3, loo.t3Lo, loo.t3Hi, 1)} | ${loo.tut} |`); }
P("");
P("**At kalitesi kontrolleriyle (hp, geçmiş performans, sınıf değişimi) aynı iki ölçüm — özgün katkı ΔLL%:**");
P("| Sinyal | AGF'siz, kontrollü [%95] | AGF kontrollü, kontrollü [%95] |\n|---|---|---|"); for (const s of SIG) { const x = fark("cF5", "cF-" + s, tum), y = fark("cA5", "cA-" + s, tum); P(`| ${nm(s)} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${isaret(y.llLo, y.llHi)} ${ci(y.ll, y.llLo, y.llHi)} |`); }
P("");
// 4. tipe göre
P("## 4. Yarış tipine göre özgün katkı (n ≥ " + MIN_N + " 'yeterli')");
const dil: [string, number[]][] = [["Tümü", tum], ...TIPLER.map((t): [string, number[]] => [t, idxOf((i) => H.tip[i] === t)])];
P("Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). **Üst blok AGF'siz (F5 − F−s), alt blok AGF kontrollü (A5 − A−s).**");
P("| Sinyal | " + dil.map(([a, idx]) => `${a} (n=${idx.length}${idx.length < MIN_N ? ", yetersiz" : ""})`).join(" | ") + " |\n|---|" + "---|".repeat(dil.length));
for (const s of SIG) P(`| ${nm(s)} — AGF'siz | ` + dil.map(([, idx]) => { const x = fark("F5", "F-" + s, idx); return `${hucre(x)} (${x.tut})`; }).join(" | ") + " |");
for (const s of SIG) P(`| ${nm(s)} — **AGF kontrollü** | ` + dil.map(([, idx]) => { const x = fark("A5", "A-" + s, idx); return `${hucre(x)} (${x.tut})`; }).join(" | ") + " |");
P("");
P("## Sınırlar ve dürüst notlar");
P("- **AGF'li ölçümde 'özgün katkının düşmesi' iki şekilde yorumlanabilir:** (a) sinyalin bilgisi piyasaya önceden yansımış olabilir (örneğin iyi galopu bahisçiler de görmüş olabilir); (b) AGF, sinyallerin kullanmadığı ama onlarla ilişkili başka bilgileri taşıyor olabilir. Bu test hangisi olduğunu ayıramaz; AGF yükselişinin galoptan kaynaklandığına dair doğrudan kanıt yoktur (bölüm 1 yalnız ilişkiyi gösterir).");
P("- AGF altılı ganyan favorisi yüzdesidir, kapanışa yakın görüşü yaklaşık gösterir; TL girişi, havuz hacmi ve son kesitten sonraki hareket bilinmez. Gerçek kapanış oranıyla (ganyan) karşılaştırma yapılmadı.");
P("- S ve dolayısıyla SS, A ve B olarak tekrar kullanılan dönemle örtüşür; çoklu karşılaştırma düzeltilmedi. Doğrusal-logit ve ortak β varsayımı; L² ile düzeyin doğrusal olmayan etkisi kısmen yakalanır, tam esneklik değildir.");
P("- Hedef AGF'nin aynısını tahmin etmek değil, AGF'nin henüz yakalayamadığı bilgiyi bulmaktır: bu yüzden bölüm 3'teki 'AGF üzerine özgün katkı' sütunu asıl göstergedir.");
fs.writeFileSync("SINYAL_GOLGE_RAPORU.md", L2r.join("\n"));
console.log(`YAZILDI SINYAL_GOLGE_RAPORU.md | ${L2r.length} satır | SS ${SS.length}`);
await db.$disconnect(); process.exit(0);
