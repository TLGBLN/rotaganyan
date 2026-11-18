/**
 * KULVAR_ETKI araştırması (kullanıcı kararı 2026-11-18; dört başlıktan ilki). SALT-OKUMA; aday sinyal DEĞİL, SINYAL_KAYDI boş. Banko modeli değil.
 * Önce tek başına, sonra ACC_HIZ+GALOP_KAPASITE+J_SEVIYE+SON6 tabanının üzerine. Varyantlar (grup tanımı x P türü x lambda) yan yana; hiçbiri seçilmedi.
 * Çıktı: KULVAR_ETKI_RAPORU.md  (--after YYYY-MM-DD: C yalnız o tarihten sonraki yarışlarla sınırlanır)
 */
import { KulvarDeposu, KULVAR_GUN_MS, kapiBolge, kapiNormal, kulvarEtki, kulvarGrup, mesafeBandi, type KulvarKayit, type KulvarVaryant } from "./src/lib/methodology/yeni-motor/adaylar/kulvar-aday";
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
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { orderBy: { no: "asc" as const }, select: { no: true, name: true, tjkAtId: true, jockey: true, trainer: true, hp: true, startNo: true, scratched: true, disaridanStart: true } } };
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



// ───── tüm yarışlar (A ∪ B ∪ geri kalan), özellikler as-of; kulvar kayıtları kronolojik
const afterArg = process.argv.indexOf("--after") >= 0 ? process.argv[process.argv.indexOf("--after") + 1]! : null;
const ksRest = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksAll = [...new Map([...ksA, ...ksB, ...ksRest].map((k) => [k.id, k])).values()];
const idA = new Set(ksA.map((k) => k.id)), idB = new Set(ksB.map((k) => k.id));
type Kol = string;
type At = { raceId: string; no: number; kazandi: boolean; v: Record<string, number | null>; kapi: number | null; kapiPl: number | null; dis: boolean; pm: number; pu: number };
type Kosu = { raceId: string; t: number; tip: string; ganyan: number | null; hip: string; yuzey: string; mesafe: number; nKapi: number; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function ozellikler(ks: typeof ksAll): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gj = jDep.gorunum(t), gd = dDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null;
      const rs = k.runners.filter((r) => !r.scratched); if (rs.length < 2) continue; const nKapi = Math.max(0, ...k.runners.map((r) => r.startNo ?? 0));
      const G = rs.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      out.push({ raceId: k.id, t, tip, ganyan: k.result?.ganyan ?? null, hip: k.raceDay.hippodrome.name, yuzey: String(k.surface), mesafe: k.distance, nKapi, atlar: rs.map((r, i) => { const id = r.tjkAtId; const onceki = (id == null ? [] : gecmis.get(id) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        const d = id == null ? null : dereceBilesenleri(gd, id);
        const v: Record<string, number | null> = { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, S6: d?.son6 ?? null };
        return { raceId: k.id, no: r.no, kazandi: win.has(r.no), v, kapi: r.startNo ?? null, kapiPl: null, dis: r.disaridanStart, pm: 1 / rs.length, pu: 1 / rs.length }; }) }); } }
  return out;
}
console.log("Tüm yarışlar için özellikler (as-of)…");
const ALL = ozellikler(ksAll).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
console.log(`ALL ${ALL.length} yarış`);
const ilkT = (P: Kosu[]) => (P.length ? new Date(Math.min(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P: Kosu[]) => (P.length ? new Date(Math.max(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—");
// ───── ölçü cihazı
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1 } as Record<string, number>)[c] ?? 0.3;
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

// ───── kulvar etkisiz yarış-öncesi olasılık P (as-of): taban [acc, kap, S, S6]; β yalnız ÖNCEKİ aylardan; ilk aylar / az veri → 1/N
const B4: Kol[] = ["acc", "kap", "S", "S6"]; const ykAll = ALL.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) }));
const cacheXA = new Map<string, number[]>(); const XA = (i: number, c: Kol) => { const key = i + "|" + c; let v = cacheXA.get(key); if (!v) { v = colX(ykAll[i]!.k, c); cacheXA.set(key, v); } return v; };
const fitA = fitFn(ykAll, XA), olasA = olasFn(XA); const ayOf = (t: number) => new Date(t).toISOString().slice(0, 7); const aylar = [...new Set(ALL.map((k) => ayOf(k.t)))].sort(); const pBeta: string[] = [];
for (const ay of aylar) { const egit: number[] = [], bu: number[] = []; ykAll.forEach((y, i) => { const a = ayOf(y.k.t); if (a < ay && y.w >= 0) egit.push(i); if (a === ay) bu.push(i); });
  const b = egit.length >= 300 ? fitA(egit, B4) : null; pBeta.push(`${ay}: ${b ? b.map((q) => q.toFixed(2)).join("/") + " (n=" + egit.length + ")" : "1/N (az veri)"}`);
  for (const i of bu) { const k = ykAll[i]!.k; const pr = b ? olasA(i, B4, b) : k.atlar.map(() => 1 / k.atlar.length); k.atlar.forEach((a, j) => { a.pm = pr[j]!; }); } }

// ───── plasebo kapı: yarış içinde kapı numaraları rastgele yer değiştirilir (kapı etkisi YOKSA gerçek kapıyla aynı sonuç beklenir)
for (const k of ALL) { const ok = k.atlar.filter((a) => a.kapi != null && !a.dis); const kp = ok.map((a) => a.kapi!); for (let i = kp.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [kp[i], kp[j]] = [kp[j]!, kp[i]!]; } ok.forEach((a, i) => { a.kapiPl = kp[i]!; }); }

// ───── kulvar kayıtları ve deposu: varyant × P türü (M = model P, U = 1/N); λ yalnız okuma sırasında
const KV: KulvarVaryant[] = ["V1", "V2", "V3", "V4"]; const LAMS = [5, 20]; type Var = { ad: string; v: KulvarVaryant; pk: "M" | "U"; lam: number; plasebo: boolean };
const VARY: Var[] = []; for (const v of KV) for (const pk of ["M", "U"] as const) for (const lam of LAMS) VARY.push({ ad: `KE_${v}_${pk}_${lam}`, v, pk, lam, plasebo: false }); VARY.push({ ad: "KE_PLASEBO_V3_M_20", v: "V3", pk: "M", lam: 20, plasebo: true });
const kayitlar = new Map<string, KulvarKayit[]>(); const depo = new Map<string, KulvarDeposu>(); const gk = (dKey: string, v: KulvarVaryant, k: Kosu, a: At, plasebo: boolean) => { if (a.dis) return null; return kulvarGrup(v, { hip: k.hip, yuzey: k.yuzey, mesafe: k.mesafe, n: k.atlar.length, kapi: plasebo ? a.kapiPl : a.kapi, nKapi: k.nKapi }); };
const depoAnahtar = (x: Var) => `${x.v}|${x.pk}|${x.plasebo ? "PL" : "G"}`;
for (const x of VARY) { const dk = depoAnahtar(x); if (kayitlar.has(dk)) continue; const L3: KulvarKayit[] = []; for (const k of ALL) for (const a of k.atlar) { const g = gk(dk, x.v, k, a, x.plasebo); if (g == null) continue; L3.push({ tarih: k.t, grup: g, y: a.kazandi ? 1 : 0, p: x.pk === "M" ? a.pm : a.pu }); } kayitlar.set(dk, L3); depo.set(dk, new KulvarDeposu(L3)); }
// değerler (as-of: gün bazında görünüm)
const gunlerAll = [...new Set(ALL.map((k) => k.t))].sort((a, b) => a - b); const gv = new Map<string, Map<number, ReturnType<KulvarDeposu["gorunum"]>>>(); for (const [dk, d] of depo) { const m = new Map<number, ReturnType<KulvarDeposu["gorunum"]>>(); for (const t of gunlerAll) m.set(t, d.gorunum(t)); gv.set(dk, m); }
for (const k of ALL) for (const a of k.atlar) { a.v.KH = a.dis ? null : kapiNormal(a.kapi, k.nKapi); for (const x of VARY) { const dk = depoAnahtar(x); const g = gk(dk, x.v, k, a, x.plasebo); const e = kulvarEtki(gv.get(dk)!.get(k.t)!, g, x.lam); a.v[x.ad] = e.deger; a.v[x.ad + "#n"] = e.n; } }

// ───── örneklemler (A, B tekrar kullanılmış; C = geri kalan, held-out)
const A = ALL.filter((k) => idA.has(k.raceId)), B = ALL.filter((k) => idB.has(k.raceId) && !idA.has(k.raceId)); const afterMs = afterArg ? Date.parse(afterArg + "T00:00:00.000Z") : -Infinity; const C = ALL.filter((k) => !idA.has(k.raceId) && !idB.has(k.raceId) && k.t > afterMs);
console.log(`A ${A.length}, B ${B.length}, C ${C.length}`);

// ───── sızıntı (gelecek-bozma) + bağımsız yeniden hesap — GERÇEK veride
let denen = 0, fark = 0; { const gA = [...new Set(A.map((k) => k.t))].sort((a, b) => a - b); const gunSec = gA.filter((_, i) => i % Math.ceil(gA.length / 5) === 0).slice(0, 5);
  for (const t of gunSec) for (const [dk, d] of depo) { const g0 = d.gorunum(t), g1 = d.gelecegiBoz(t, 5 + (t / KULVAR_GUN_MS) % 991).gorunum(t); const gruplar = new Set(A.filter((k) => k.t === t).flatMap((k) => k.atlar.map((a) => gk(dk, dk.split("|")[0] as KulvarVaryant, k, a, dk.endsWith("PL"))))); for (const g of gruplar) { if (g == null) continue; for (const lam of LAMS) { denen++; if (JSON.stringify(kulvarEtki(g0, g, lam)) !== JSON.stringify(kulvarEtki(g1, g, lam))) fark++; } } } }
let bag = 0, nOrn = 0; { const orn = A.flatMap((k) => k.atlar.filter((a) => a.v[VARY[0]!.ad] != null).map((a) => ({ a, k }))); for (let i = 0; i < 200 && orn.length; i++) { const { a, k } = orn[Math.floor(rnd() * orn.length)]!; const x = VARY[(i * 5) % (VARY.length - 1)]!; const dk = depoAnahtar(x); const g = gk(dk, x.v, k, a, false); if (g == null) continue; nOrn++; let sy = 0, sp = 0, sv = 0, n = 0; for (const r of kayitlar.get(dk)!) if (r.grup === g && r.tarih < k.t) { sy += r.y; sp += r.p; sv += r.p * (1 - r.p); n++; } const val = n > 0 ? (sy - sp) / (sv + x.lam) : null; const got = a.v[x.ad] ?? null; if (!((val == null && got == null) || (val != null && got != null && Math.abs(val - got) < 1e-9))) bag++; } }

// ───── modeller
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const ADLAR = [...VARY.map((x) => x.ad), "KH"]; const MD: [string, Kol[]][] = [["M4", B4], ["c4", [...B4, ...KON]], ["K0", KON]];
for (const nm of ADLAR) { MD.push(["alone_" + nm, [nm]]); MD.push(["b+" + nm, [...B4, nm]]); MD.push(["c+" + nm, [...B4, ...KON, nm]]); }
console.log(`Modeller: ${MD.length}`);
console.log("Test A…"); const RA = degerlendir(A, MD, []); const birA = new Set(A.map((k) => k.raceId)); const egitAB = [...A, ...B.filter((k) => !birA.has(k.raceId))].sort((a, b) => a.t - b.t);
console.log("Test B…"); const RB = degerlendir(B, MD, []); console.log("Test C (dış)…"); const RC = C.length ? degerlendirDis(egitAB, C, MD, []) : null;
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (R: Sonuc, a: string, b: string) => ({ ll: farkCI(R.ll[b]!, R.ll[a]!), t1: farkCI(R.t1[a]!, R.t1[b]!, 100, 2), t3: farkCI(R.t3[a]!, R.t3[b]!, 100, 2) });
const ekT = (R: Sonuc, a: string) => ({ ll: farkCI(R.taban, R.ll[a]!), t1: farkCI(R.t1[a]!, R.r1, 100, 2), t3: farkCI(R.t3[a]!, R.r3, 100, 2) });

// ───── korelasyon / R² (yarış içi merkezlenmiş)
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
function rPar(pop: Kosu[], x: Kol, y: Kol) { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); }
function r2B4(pop: Kosu[], yeni: Kol) { const rows = merkez(pop, [...B4, yeni]); const K = B4.length; if (rows.length < 50) return NaN; const H = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) H[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) H[a]![a] += 1e-9; const b = coz(H, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }

// ───── RAPOR
const L2: string[] = []; const P = (s = "") => L2.push(s);
const SMP: [string, Sonuc | null, Kosu[]][] = [["A (tekrar kullanılmış; 6 blok ileri-yönlü β)", RA, A], ["B (daha az kullanılmış; 6 blok ileri-yönlü β)", RB, B], ["C (A∪B dışı; β yalnız A∪B'den; held-out, ileri-yönlü DEĞİL)", RC, C]];
const tumAt = ALL.flatMap((k) => k.atlar.map((a) => ({ k, a })));
P("# KULVAR_ETKI — araştırma raporu (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)");
P("Önce tek başına, sonra **ACC_HIZ + GALOP_KAPASITE + J_SEVIYE + SON6** tabanının üzerine. Üretim ağırlığı veya banko modeli değildir; hiçbir parametre örneklem sonucuna göre SEÇİLMEDİ (tüm varyantlar yan yana).");
P("");
P("## 0. Tanım, veri, doğrulama");
P("- **Kapı = fiziksel start kapısı (`Runner.startNo`)**, at numarası değil (at numarası yalnız " + pct(tumAt.filter((x) => x.a.kapi != null && x.a.kapi === x.a.no).length / tumAt.filter((x) => x.a.kapi != null).length) + "% atta kapıya eşit). Kapı sayısı = ilan edilen en yüksek kapı (**koşmayan atların kapıları / boş kapılar dahil**). K_h = (kapı−1)/(kapı sayısı−1). **Dışarıdan start** eden atlar (kapıda değil) kayıt dışı bırakıldı ve değerleri 'veri yok'.");
P("- **B_g = Σ(Y−P) / (ΣP(1−P) + λ)** (kullanıcı formülü). P: kulvar etkisi İÇERMEYEN yarış-öncesi kazanma olasılığı. İki tür: **M** = taban modeli (ACC+GALOP+J+SON6, β yalnız önceki aylardan; ilk aylarda/az veride 1/N), **U** = 1/N (kapı kurayla verildiği için kapıdan bağımsızdır; en yalın ölçü). Grupta geçmiş kayıt yoksa değer NULL.");
P("- **Grup varyantları (hiçbiri seçilmedi):** V1 hipodrom|yüzey|mesafe|saha bandı|kapı (kullanıcının yazdığı tanım; hücreler çok seyrek); V2 hipodrom|yüzey|mesafe|kapı; V3 hipodrom|yüzey|mesafe bandı|K_h üçte biri (iç/orta/dış); V4 yüzey|mesafe bandı|saha bandı|K_h üçte biri (tüm hipodromlar). Saha bandı: ≤7 / 8–10 / ≥11; mesafe bandı: ≤1300 / 1400–1900 / ≥2000. **λ ∈ {5, 20}** (geçici; onaya tabi). KH = K_h'nin kendisi (tek global doğrusal katsayılı basit karşılaştırma).");
P("- **Plasebo kontrolü (KE_PLASEBO_V3_M_20):** her yarışta kapı numaraları rastgele yer değiştirilir; kulvar gerçekten bir şey ölçüyorsa gerçek kapılı V3_M_20'den belirgin kötü, aksi hâlde benzer çıkar (ölçü cihazı sahte sinyal üretiyor mu testi).");
P(`- **Örneklemler:** A ${A.length} yarış (${ilkT(A)}→${sonT(A)}), B ${B.length} (${ilkT(B)}→${sonT(B)}), C ${C.length} (${ilkT(C)}→${sonT(C)})${afterArg ? ` (--after ${afterArg})` : ""}. A ve B tekrar kullanılmıştır; C model kararlarında kullanılmadı ama zamanca iç içedir (**ileri-yönlü değildir**). Veritabanı 2026-01-01'de başlıyor: kulvar geçmişi yalnız ~11 ay.`);
P(`- **Gelecek-bozma testi (gerçek veri, ${denen} grup-λ okuması):** ${fark === 0 && denen > 0 ? "GEÇTİ — sızıntı yok" : "SIZINTI VAR (" + fark + ")"}. **Bağımsız yeniden hesap:** ${nOrn} örnekte ${bag} uyuşmaz. Birim testleri (formül, as-of, sızıntı, düz-döngü, saflık) vitest'te geçiyor.`);
P("- **P için aylık β (as-of):** " + pBeta.join("; ") + ".");
P("");
// 1. kapı kapsamı
const yarisKapiTam = ALL.filter((k) => k.atlar.every((a) => a.kapi != null)).length; const disAt = tumAt.filter((x) => x.a.dis).length; const kapiYok = tumAt.filter((x) => x.a.kapi == null).length;
P("## 1. Kapı verisi kapsamı");
P(`Toplam ${ALL.length} yarış, ${tumAt.length} koşan at. Tüm koşanların kapısı bilinen yarış: ${ALL.length ? pct(yarisKapiTam / ALL.length) : "—"}%. Kapısı eksik at: ${kapiYok}. Dışarıdan start: ${disAt} (${pct(disAt / tumAt.length)}%). Kapı sayısı > koşan sayısı (boş kapı) olan yarış: ${pct(ALL.filter((k) => k.nKapi > k.atlar.length).length / ALL.length)}%.`);
P("");
// 2. betimleyici (as-of DEĞİL)
const zH = (hs: { y: number; p: number }[]) => { const sv = sum(hs.map((q) => q.p * (1 - q.p))); return { n: hs.length, w: sum(hs.map((q) => q.y)), e: sum(hs.map((q) => q.p)), z: sv > 0 ? (sum(hs.map((q) => q.y)) - sum(hs.map((q) => q.p))) / Math.sqrt(sv) : NaN }; };
const hucreler = new Map<string, { y: number; pm: number; pu: number }[]>(); const ekH = (key: string, y: number, pm: number, pu: number) => { const a = hucreler.get(key) ?? []; a.push({ y, pm, pu }); hucreler.set(key, a); };
for (const { k, a } of tumAt) { const kn = a.dis ? null : kapiNormal(a.kapi, k.nKapi); if (kn == null) continue; const b = kapiBolge(kn); const y = a.kazandi ? 1 : 0; ekH(`Tümü|${b}`, y, a.pm, a.pu); ekH(`${k.yuzey}|${mesafeBandi(k.mesafe)}|${b}`, y, a.pm, a.pu); ekH(`${k.hip}|${b}`, y, a.pm, a.pu); }
P("## 2. Betimleyici: kulvar gerçekten fark ediyor mu? (TÜM örnek, as-of DEĞİL — yalnız bilgi, doğrulama değil)");
P("Hücre = gruptaki atların kazanma sayısı − beklenen; **z = (Y−ΣP)/√ΣP(1−P)**, P = 1/N (U) ve taban modeli (M). Çok sayıda hücre var, düzeltme uygulanmadı: |z|>2 tek başına kanıt değildir.");
P("| Grup | n at | Kazanan | Beklenen (1/N) | z (1/N) | z (taban model P) |\n|---|---|---|---|---|---|");
const sirH = (a: string, b: string) => { const o = (s: string) => (s.startsWith("Tümü") ? 0 : s.split("|").length === 3 ? 1 : 2); return o(a) - o(b) || (a < b ? -1 : 1); };
for (const key of [...hucreler.keys()].sort(sirH)) { const h = hucreler.get(key)!; if (h.length < 300) continue; const u = zH(h.map((q) => ({ y: q.y, p: q.pu }))), m = zH(h.map((q) => ({ y: q.y, p: q.pm }))); P(`| ${key.replace(/\|/g, " · ")} | ${u.n} | ${u.w} | ${f(u.e, 1)} | ${f(u.z, 2)} | ${f(m.z, 2)} |`); }
P("");
// 3. kapsam + korelasyon
P("## 3. Veri kapsamı ve örtüşme (taban dört sinyalle)");
P("Kapsam = değeri olan (grupta ≥1 geçmiş kayıt) at payı; n≥10 / n≥30: grupta o kadar geçmiş at-kaydı olan pay (düşükse λ değeri sıfıra çeker). r = yarış-içi merkezlenmiş Pearson; **R² = KE'nin dört taban sinyalle doğrusal açıklanabilen payı**.");
P("| Örneklem | Varyant | Kapsam | n≥10 | n≥30 | Medyan n | r(ACC_HIZ) | r(GALOP) | r(J_SEVIYE) | r(SON6) | R² (taban 4) |\n|---|---|---|---|---|---|---|---|---|---|---|");
for (const [ad, , pop] of SMP) { if (!pop.length) continue; const atlar = pop.flatMap((k) => k.atlar); for (const nm of [...ADLAR]) { const v = atlar.filter((a) => a.v[nm] != null); const ns = atlar.map((a) => (a.v[nm + "#n"] as number | undefined) ?? 0); P(`| ${ad.split(" (")[0]} | ${nm} | ${pct(v.length / atlar.length)}% | ${pct(ns.filter((q) => q >= 10).length / atlar.length)}% | ${pct(ns.filter((q) => q >= 30).length / atlar.length)}% | ${nm === "KH" ? "—" : f(medyan(ns.filter((q) => q > 0)), 0)} | ${f(rPar(pop, "acc", nm), 2)} | ${f(rPar(pop, "kap", nm), 2)} | ${f(rPar(pop, "S", nm), 2)} | ${f(rPar(pop, "S6", nm), 2)} | ${f(r2B4(pop, nm), 3)} |`); } }
P("");
const tablo = (baslik: string, aciklama: string, satir: (R: Sonuc, nm: string) => string, bas: string) => { P(baslik); P(aciklama); for (const [ad, R] of SMP) { if (!R) { P(`**${ad}** — boş.`); continue; } P(`### ${ad}`); P(`Test yarışı ${R.test.length}.`); P(bas); for (const nm of ADLAR) P(satir(R, nm)); P(""); } };
tablo("## 4. KE tek başına (yalnız o sinyal; 1/N'ye karşı)", "ΔLL = 1/N log-loss − model log-loss; Top1/Top3 farkı 1/N'ye göre yüzde puan; [%95 eşleştirilmiş bootstrap]. **Plasebo satırı gerçek kapılı V3_M_20 ile kıyaslanmalı.**", (R, nm) => { const x = ekT(R, "alone_" + nm); return `| ${nm} | ${x.ll} | ${x.t1} | ${x.t3} |`; }, "| Sinyal | ΔLL [%95] | ΔTop1 [%95] | ΔTop3 [%95] |\n|---|---|---|---|");
tablo("## 5. Dört sinyalli tabana (ACC_HIZ+GALOP_KAPASITE+J_SEVIYE+SON6) ek katkı", "ΔLL = taban − (taban+KE); sağ üç sütun at-kalitesi kontrolleri (hp, geçmiş performans, sınıf değişimi) eklenmiş tabana katkı.", (R, nm) => { const x = ek(R, "b+" + nm, "M4"), y = ek(R, "c+" + nm, "c4"); return `| ${nm} | ${x.ll} | ${x.t1} | ${x.t3} | ${y.ll} | ${y.t1} | ${y.t3} |`; }, "| Sinyal | ΔLL [%95] | ΔTop1 [%95] | ΔTop3 [%95] | Kontrollü ΔLL [%95] | Kontrollü ΔTop1 [%95] | Kontrollü ΔTop3 [%95] |\n|---|---|---|---|---|---|---|");
P("## Sınırlar ve dürüst notlar");
P("- **Veri yalnız Ocak 2026'dan:** her hipodrom+yüzey+mesafe+kapı hücresinde birkaç yarış/at var; V1/V2 çok seyrek (λ değeri sıfıra çeker, kapsam tablosuna bakın). Kulvar etkisi gerçek olsa bile bu veride ölçülemeyebilir; 'sinyal yok' ile 'ölçülemedi' ayrımı yapılmalı.");
P("- Kapı kurayla verildiği varsayımıyla U (1/N) ölçüsü yanlılıksızdır; M (model P) gürültüyü azaltır ama taban modelin hatasını taşır. Tek varyantın sonucu seçim sayılmaz; örneklemler arası tutarlılığa bakın.");
P("- Çok sayıda karşılaştırma (varyant × λ × örneklem × ölçüt) düzeltilmedi. A ve B tekrar kullanıldı; C held-out ama ileri-yönlü değildir (`--after <tarih>`).");
P("- Kapı sayısı (boş kapılar) ilan edilmiş en yüksek kapıdan alındı; kapılar yarıştan önce yeniden numaralandırılmışsa K_h hafif kayabilir. Pist durumu (ıslak/ağır), kapının iç/dış korkuluğa göre fiziksel konumu ve hipodrom pist geometrisi dahil değildir.");
P("- KULVAR_STIL_UYUM, ZEMIN_TOLERANSI ve HIPODROM_UYUM bu raporun konusu değildir.");
fs.writeFileSync("KULVAR_ETKI_RAPORU.md", L2.join("\n"));
console.log(`YAZILDI KULVAR_ETKI_RAPORU.md | ${L2.length} satır | sızıntı ${fark === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan ${bag}/${nOrn}`);
await db.$disconnect(); process.exit(0);
