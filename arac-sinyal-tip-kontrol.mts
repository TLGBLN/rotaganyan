/**
 * SİNYAL SON KONTROL — YARIŞ TİPİNE GÖRE (kullanıcı kararı 2026-11-18). SALT-OKUMA; aktif sinyal DEĞİL, SINYAL_KAYDI boş.
 * Sıralı ekleme + tam modelden çıkarma, A/B/C test yarışları tek havuzda, Maiden/Şartlı/Handikap/KV/Grup/Satış/Diğer olarak AYRI ayrı (yüzdesel).
 * Çıktı: SINYAL_TIP_KONTROL_RAPORU.md
 */
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
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, name: true, tjkAtId: true, jockey: true, trainer: true, hp: true } } };
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
const idAB = new Set([...ksA, ...ksB].map((k) => k.id));
const afterArg = process.argv.indexOf("--after") >= 0 ? process.argv[process.argv.indexOf("--after") + 1]! : null;
const ksC = await db.race.findMany({ where: { id: { notIn: [...idAB] }, conditions: null, result: { isNot: null }, raceDay: { ...(afterArg ? { date: { gt: new Date(afterArg + "T00:00:00.000Z") } } : {}), hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
console.log(`C (A∪B dışı${afterArg ? ", " + afterArg + " sonrası" : ""}) ${ksC.length} yarış`);
console.log("Örneklem A…"); const A = ozellikler(ksA); console.log("Örneklem B…"); const B = ozellikler(ksB); console.log("Örneklem C…"); const C = ozellikler(ksC);
const ilkT = (P: Kosu[]) => (P.length ? new Date(Math.min(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P: Kosu[]) => (P.length ? new Date(Math.max(...P.map((k) => k.t))).toISOString().slice(0, 10) : "—");

// ───── sızıntı + bağımsız yeniden hesap (ızgaranın TÜM parametreleri)
const gunlerA = [...new Set(A.map((k) => k.t))].sort((a, b) => a - b); const secilen = gunlerA.filter((_, i) => i % Math.ceil(gunlerA.length / 5) === 0).slice(0, 5); let denenen = 0, farkli = 0;
for (const t of secilen) { const h0 = hDep.gorunum(t), h1 = hDep.gelecegiBoz(t, 17 + (t / DERECE_GUN_MS) % 991).gorunum(t);
  for (const k of A.filter((x) => x.t === t)) { const ids = ksA.find((q) => q.id === k.raceId)!.runners.map((a) => a.tjkAtId).filter((x): x is number => x != null); const kr = ksA.find((q) => q.id === k.raceId)!; const hedef = { yuzey: YUZ_R[String(kr.surface)] ?? "?", mesafe: kr.distance }; for (const id of ids) { denenen++; if (JSON.stringify(h2hNetCoklu(h0, id, ids, hedef, PARS)) !== JSON.stringify(h2hNetCoklu(h1, id, ids, hedef, PARS))) farkli++; } } }
let bagH = 0, nOrn = 0; const ornek = A.flatMap((k) => k.atlar.filter((a) => a.v[DEF] != null).map((a) => ({ a, k }))); const rid = new Map(ksA.map((k) => [k.id, k]));
for (let i = 0; i < 80 && ornek.length; i++) { const { a, k } = ornek[Math.floor(rnd() * ornek.length)]!; nOrn++; const t = k.t; const kr = rid.get(k.raceId)!; const hedefY = YUZ_R[String(kr.surface)] ?? "?"; const atId = kr.runners.find((q) => q.no === a.no)!.tjkAtId!; const rak = kr.runners.map((q) => q.tjkAtId).filter((x): x is number => x != null && x !== atId); const mine = hRows.filter((x) => x.atId === atId && x.tarih < t); const cv: number[] = [];
  for (const j of rak) { let sw = 0, swx = 0, n = 0; for (const m of mine) { if (m.yuzey === "?" || m.yuzey !== hedefY) continue; const b = hRows.find((x) => x.atId === j && x.tarih < t && x.yarisKey === m.yarisKey); if (!b) continue; const x = m.sira < b.sira ? 1 : m.sira > b.sira ? -1 : 0; const w = Math.pow(0.5, (t - m.tarih) / DERECE_GUN_MS / 180) * (Math.min(m.mesafe, kr.distance) / Math.max(m.mesafe, kr.distance)); sw += w; swx += w * x; n++; } if (n > 0) cv.push(swx / (sw + 3)); }
  const h = cv.length ? mean(cv) : null; if (!((h == null && a.v[DEF] == null) || (h != null && a.v[DEF] != null && Math.abs(h - a.v[DEF]!) < 1e-9))) bagH++; }

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
const KON: Kol[] = ["hp", "win", "top3", "sinif"];

// ───── ANTRENÖR sızıntı (gelecek-bozma) + bağımsız yeniden hesap
let aDen = 0, aFark = 0; for (const t of secilen) { const g0 = aDep.gorunum(t), g1 = aDep.gelecegiBoz(t, 11 + (t / ANT_GUN_MS) % 991).gorunum(t); for (const x of new Set(A.filter((k) => k.t === t).flatMap((k) => ksA.find((q) => q.id === k.raceId)!.runners.map((r) => an(r.trainer))))) { if (!x) continue; aDen++; if (JSON.stringify(antrenorBilesenleri(g0, x)) !== JSON.stringify(antrenorBilesenleri(g1, x))) aFark++; } }
let aBag = 0, aOrn = 0; { const ornA = A.flatMap((k) => k.atlar.filter((a) => a.v.ANT != null).map((a) => ({ a, k }))); for (let i = 0; i < 150 && ornA.length; i++) { const { a, k } = ornA[Math.floor(rnd() * ornA.length)]!; aOrn++; const kr = rid.get(k.raceId)!; const tr = an(kr.runners.find((q) => q.no === a.no)!.trainer); const my = rr.filter((x) => an(x.trainer) === tr && dayMs(x.race.raceDay.date) < k.t && dayMs(x.race.raceDay.date) >= k.t - 365 * ANT_GUN_MS); const n = my.length, w = my.filter((x) => ((x.race.result?.winnerNos ?? []) as number[]).includes(x.no)).length; const p0 = mean(my.map((x) => 1 / alanN.get(x.race.id)!)); const v = (w + 8 * p0) / (n + 8); if (n === 0 || Math.abs(v - a.v.ANT!) > 1e-9) aBag++; } }

// ───── sinyal sırası ve modeller (sıralı ekleme + tam modelden çıkarma; plain ve kontrollü)
const AD: Record<string, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", S6: "SON6", H: "H2H_NET", ANT: "ANT_SEVIYE" };
const ORD = ["acc", "kap", "S", "S6", "H", "ANT"]; const kolAd = (s: string) => (s === "H" ? DEF : s); const dizi = (ids: string[]) => ids.map(kolAd);
const MD: [string, Kol[]][] = [["K0", KON]]; ORD.forEach((_, i) => { MD.push(["M" + (i + 1), dizi(ORD.slice(0, i + 1))]); MD.push(["cM" + (i + 1), [...dizi(ORD.slice(0, i + 1)), ...KON]]); });
for (const s of ORD) { const k = ORD.filter((x) => x !== s); MD.push(["L-" + s, dizi(k)]); MD.push(["cL-" + s, [...dizi(k), ...KON]]); }
console.log(`Modeller: ${MD.length}`);
console.log("Test A…"); const RA = degerlendir(A, MD, []); const birA = new Set(A.map((k) => k.raceId)); const egitAB = [...A, ...B.filter((k) => !birA.has(k.raceId))].sort((a, b) => a.t - b.t);
console.log("Test B…"); const RB = degerlendir(B, MD, []); console.log("Test C (dış)…"); const RC = C.length ? degerlendirDis(egitAB, C, MD, []) : null;

// ───── üç örneklemin TEST yarışları tek havuzda; her yarışın tipi, örneklemi ve tüm model log-loss/Top1/Top3 değerleri hizalı
const SN = ["A", "B", "C"]; const H = { ll: {} as Record<string, number[]>, t1: {} as Record<string, number[]>, t3: {} as Record<string, number[]>, taban: [] as number[], r1: [] as number[], r3: [] as number[], tip: [] as string[], orn: [] as number[] };
[RA, RB, RC].forEach((R, si) => { if (!R) return; for (const [ad] of MD) { (H.ll[ad] ??= []).push(...R.ll[ad]!); (H.t1[ad] ??= []).push(...R.t1[ad]!); (H.t3[ad] ??= []).push(...R.t3[ad]!); } H.taban.push(...R.taban); H.r1.push(...R.r1); H.r3.push(...R.r3); R.test.forEach((i) => { H.tip.push(R.yk[i]!.k.tip); H.orn.push(si); }); });
const TIPLER = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"].filter((t) => H.tip.includes(t)); const MIN_N = 150;
const idxTip = (t: string | null) => H.tip.map((x, i) => (t == null || x === t ? i : -1)).filter((i) => i >= 0);
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
/** a = geniş model, b = dar model. ll: 1/N log-loss'un yüzdesi olarak iyileşme (dar−geniş)/1N; t1/t3: yüzde puan. */
function fark(a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => H.taban[i]!)); const dl = idx.map((i) => (H.ll[b]![i]! - H.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (H.t1[a]![i]! - H.t1[b]![i]!) * 100), d3 = idx.map((i) => (H.t3[a]![i]! - H.t3[b]![i]!) * 100);
  const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1, 2].map((s) => { const q = idx.filter((i) => H.orn[i] === s); return q.length < 30 ? "·" : mean(q.map((i) => H.ll[b]![i]! - H.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`;
const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○"); // ✓ CI sıfırın üstünde, ✗ altında, ○ sıfırı içeriyor
const seviye = (ad: string, idx: number[]) => ({ ll: (mean(idx.map((i) => H.taban[i]!)) - mean(idx.map((i) => H.ll[ad]![i]!))) / mean(idx.map((i) => H.taban[i]!)) * 100, t1: mean(idx.map((i) => H.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => H.t3[ad]![i]!)) * 100 });

// ───── RAPOR
const L2: string[] = []; const P = (s = "") => L2.push(s);
const dilimler: [string, number[]][] = [["Tümü", idxTip(null)], ...TIPLER.map((t): [string, number[]] => [t, idxTip(t)])];
P("# Son kontrol — sinyaller yarış tiplerine göre AYRI AYRI (yüzdesel)");
P("**Bu bir üretim ağırlıklandırması değil; aktif sinyal sayısı 0, `SINYAL_KAYDI` boş.** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET ve ANT_SEVIYE'nin katkısı her yarış tipinde ayrı ölçüldü.");
P("");
P("## 0. Düzenek");
P("- **Test havuzu:** A (6 blok ileri-yönlü β), B (6 blok ileri-yönlü β) ve C (β yalnız A∪B'den; held-out) örneklemlerinin tamamen TEST (tahmin edilen) yarışları tek havuzda birleştirildi; her yarış tipine göre dilimlendi. β TÜM tiplerde ortak eğitildi (her tip için ayrı model eğitilmedi); bu, sinyallerin her tipte aynı katsayıyla işe yarayıp yaramadığını sınar.");
P("- **Yüzdesel ölçüler:** (1) **ΔLL%** = (dar model log-loss − geniş model log-loss) / (o tipteki rastgele 1/N log-loss) × 100: yani sinyalin 1/N'ye göre toplam log-loss kazancının yüzde kaçını eklediği. (2) **Top1% / Top3%**: gerçek kazananın modelin 1./ilk 3 seçimi içinde olma yüzdesi (kesirli beraberlik). (3) **ΔTop1 / ΔTop3**: yüzde puan farkı. Köşeli parantez eşleştirilmiş bootstrap %95. İşaretler: ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ sıfırın altında. 'Tutarlılık' sütunu ΔLL'nin A/B/C örneklemlerinde işaretidir (+ artı, − eksi, · yetersiz örnek <30).");
P(`- **H2H_NET** başlangıç ${DEF} (SEÇİM DEĞİL). ANT_SEVIYE k=8 geçici sabit. **Sıralı ekleme** sırası sabit: ACC_HIZ → +GALOP → +J_SEVIYE → +SON6 → +H2H → +ANT. **Tam modelden çıkarma** = 6 sinyalli model − o sinyalsiz model (sıradan bağımsız).`);
P(`- **Örneklem boyu:** n < ${MIN_N} olan tipler **'yetersiz'** işaretlendi; onlardaki sonuçlar yorumlanmamalı.`);
P(`- **Doğrulama:** H2H ızgarası gelecek-bozma testi ${farkli === 0 && denenen > 0 ? "GEÇTİ" : "SIZINTI VAR"} (${denenen} at); ANTRENÖR ${aFark === 0 && aDen > 0 ? "GEÇTİ" : "SIZINTI VAR"} (${aDen}); bağımsız yeniden hesap uyuşmaz: H2H ${bagH}/${nOrn}, ANT ${aBag}/${aOrn}.`);
P("");
P("### Test yarışı sayıları (tipe göre)");
P("| Tip | Toplam | A | B | C | 1/N Top1 % | 1/N Top3 % | Durum |\n|---|---|---|---|---|---|---|---|");
for (const [ad, idx] of dilimler) P(`| ${ad} | ${idx.length} | ${idx.filter((i) => H.orn[i] === 0).length} | ${idx.filter((i) => H.orn[i] === 1).length} | ${idx.filter((i) => H.orn[i] === 2).length} | ${fx(mean(idx.map((i) => H.r1[i]!)) * 100, 1)} | ${fx(mean(idx.map((i) => H.r3[i]!)) * 100, 1)} | ${idx.length < MIN_N ? "yetersiz" : "yeterli"} |`);
P("");
const durum = (idx: number[]) => (idx.length < MIN_N ? " (yetersiz n)" : "");
// ÖZET matrisler
const matris = (baslik: string, aciklama: string, kaynak: (s: string, idx: number[]) => Fark, alan: "ll" | "t1" | "t3") => {
  P(baslik); P(aciklama); P("| Sinyal | " + dilimler.map(([a, idx]) => a + durum(idx)).join(" | ") + " |\n|---|" + "---|".repeat(dilimler.length));
  for (const s of ORD) P(`| ${AD[s]} | ` + dilimler.map(([, idx]) => { const x = kaynak(s, idx); const lo = alan === "ll" ? x.llLo : alan === "t1" ? x.t1Lo : x.t3Lo, hi = alan === "ll" ? x.llHi : alan === "t1" ? x.t1Hi : x.t3Hi, m = alan === "ll" ? x.ll : alan === "t1" ? x.t1 : x.t3; return `${isaret(lo, hi)} ${fx(m)}${alan === "ll" ? "%" : " p"}${alan === "ll" ? " (" + x.tut + ")" : ""}`; }).join(" | ") + " |");
  P("");
};
const kaynakLOO = (pre: string) => (s: string, idx: number[]) => fark(pre + "M6", pre + "L-" + s, idx);
const kaynakSIRA = (pre: string) => (s: string, idx: number[]) => { const i = ORD.indexOf(s); return fark(pre + "M" + (i + 1), i === 0 ? (pre === "c" ? "K0" : "K0") : pre + "M" + i, idx); };
P("## 1. ÖZET — tam modelden çıkarma (sıradan bağımsız net katkı)");
matris("### 1a. ΔLL% (1/N log-loss kazancına göre yüzde)", "Hücre: işaret + ΔLL% (parantez: A/B/C örneklem işaretleri). Pozitif = sinyal çıkarılınca model kötüleşiyor.", kaynakLOO(""), "ll");
matris("### 1b. ΔTop1 (yüzde puan)", "Tam model Top1% − sinyalsiz model Top1%.", kaynakLOO(""), "t1");
matris("### 1c. ΔTop3 (yüzde puan)", "Tam model Top3% − sinyalsiz model Top3%.", kaynakLOO(""), "t3");
matris("### 1d. KONTROLLÜ ΔLL% (hp, geçmiş performans, sınıf değişimi kontrolleri eklenmiş modelde)", "Aynı çıkarma testi; at kalitesi kontrolleri her iki modelde de var.", kaynakLOO("c"), "ll");
P("## 2. ÖZET — sıralı ekleme (sinyalin KENDİ aşamasındaki katkısı)");
matris("### 2a. ΔLL%", "ACC_HIZ için karşılaştırma tabanı 1/N'dir (yalnız at-kalitesi kontrolsüz).", (s, idx) => { const i = ORD.indexOf(s); if (i === 0) { const m1n = mean(idx.map((j) => H.taban[j]!)); const dl = idx.map((j) => (H.taban[j]! - H.ll["M1"]![j]!) / m1n * 100); const [lo, hi] = boot(dl); const x = fark("M1", "M1", idx); return { ...x, ll: mean(dl), llLo: lo, llHi: hi, tut: [0, 1, 2].map((sm) => { const q = idx.filter((j) => H.orn[j] === sm); return q.length < 30 ? "·" : mean(q.map((j) => H.taban[j]! - H.ll["M1"]![j]!)) > 0 ? "+" : "−"; }).join("") }; } return fark("M" + (i + 1), "M" + i, idx); }, "ll");
matris("### 2b. KONTROLLÜ ΔLL% (ACC_HIZ için taban: yalnız kontroller)", "", (s, idx) => { const i = ORD.indexOf(s); return fark("cM" + (i + 1), i === 0 ? "K0" : "cM" + i, idx); }, "ll");
matris("### 2c. ΔTop3 (yüzde puan; kontrolsüz sıralı)", "ACC_HIZ için kıyas tabanı 1/N Top3'tür değil, kontrolsüz model M1 − K0'dır; bu satırı yorumlamayın, ilk satır yalnız referans.", (s, idx) => { const i = ORD.indexOf(s); return fark("M" + (i + 1), i === 0 ? "K0" : "M" + i, idx); }, "t3");
// SİNYAL BAŞINA TİP TUTARLILIĞI
P("## 3. Tip tutarlılığı (n ≥ " + MIN_N + " olan tiplerde)");
P("Her sinyal için, tam modelden çıkarmada ΔLL%'nin işareti: kaç tipte ✓ (sıfırın üstü), ○ (belirsiz), ✗ (sıfırın altı).");
P("| Sinyal | ✓ | ○ | ✗ | Tip dökümü (kontrolsüz) | Kontrollü ✓/○/✗ |\n|---|---|---|---|---|---|");
for (const s of ORD) { const yeter = dilimler.filter(([a, idx]) => a !== "Tümü" && idx.length >= MIN_N); const r = yeter.map(([a, idx]) => ({ a, x: fark("M6", "L-" + s, idx), y: fark("cM6", "cL-" + s, idx) })); const say = (g: (z: { x: Fark; y: Fark }) => Fark) => { const o = [0, 0, 0]; for (const z of r) { const q = g(z); o[q.llLo > 0 ? 0 : q.llHi < 0 ? 2 : 1]!++; } return o; }; const o1 = say((z) => z.x), o2 = say((z) => z.y); P(`| ${AD[s]} | ${o1[0]} | ${o1[1]} | ${o1[2]} | ${r.map((z) => z.a + " " + isaret(z.x.llLo, z.x.llHi)).join(", ")} | ${o2.join("/")} |`); }
P("");
// AYRINTILI TİP TABLOLARI
P("## 4. Tip başına ayrıntılı tablolar");
for (const [ad, idx] of dilimler) { if (ad === "Tümü") continue; P(`### ${ad} — ${idx.length} test yarışı${durum(idx)}`); if (idx.length < 40) { P("Örneklem çok küçük; tablo verilmedi."); P(""); continue; }
  P(`1/N: Top1 ${fx(mean(idx.map((i) => H.r1[i]!)) * 100, 1)}%, Top3 ${fx(mean(idx.map((i) => H.r3[i]!)) * 100, 1)}%.`); P("**Sıralı ekleme (kontrolsüz):**"); P("| Aşama | Log-loss kazancı (1/N'ye göre %) | ΔLL% [%95] | Top1 % | ΔTop1 p [%95] | Top3 % | ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|---|---|---|");
  ORD.forEach((s, i) => { const lev = seviye("M" + (i + 1), idx); const x = i === 0 ? null : fark("M" + (i + 1), "M" + i, idx); P(`| ${i + 1}. ${i ? "+" : ""}${AD[s]} | ${fx(lev.ll)}% | ${x ? ci(x.ll, x.llLo, x.llHi) : "—"} | ${fx(lev.t1, 1)}% | ${x ? ci(x.t1, x.t1Lo, x.t1Hi) : "—"} | ${fx(lev.t3, 1)}% | ${x ? ci(x.t3, x.t3Lo, x.t3Hi) : "—"} | ${x ? x.tut : "—"} |`); });
  P(""); P("**Tam modelden çıkarma (kontrolsüz | kontrollü):**"); P("| Çıkarılan | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Kontrollü ΔLL% [%95] | Kontrollü ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|---|---|");
  for (const s of ORD) { const x = fark("M6", "L-" + s, idx), y = fark("cM6", "cL-" + s, idx); P(`| ${AD[s]} | ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} | ${ci(y.ll, y.llLo, y.llHi)} | ${ci(y.t3, y.t3Lo, y.t3Hi)} | ${x.tut} |`); } P(""); }
P("## Sınırlar ve dürüst notlar");
P("- **Ortak β:** Modeller tipten bağımsız eğitildi; bir tipte sinyalin zayıf çıkması 'o tipte işe yaramaz' değil, 'ortak katsayıyla yeterince iyi değil' anlamına gelebilir. Tipe özel eğitim yapılmadı (Handikap/ŞARTLI segmentlerine ve canlı motora dokunulmadı).");
P("- **Küçük tipler:** KV, Grup, Satış gibi tiplerde n küçüktür; aralıklar geniştir ve çok sayıda hücre düzeltilmeden karşılaştırılmıştır. Tek hücredeki ✓/✗ kanıt sayılmamalı; matrislerdeki desen ve A/B/C tutarlılığı önemlidir.");
P("- A ve B tekrar kullanılmış örneklemlerdir; C held-out ama ileri-yönlü değildir. Hiçbiri bağımsız nihai doğrulama olarak sunulmaz. H2H ve ANT için kapsam kısmidir (eksik değer yarış-içi nötr doldurulur).");
P("- Tip, TJK sınıf adından kaba gruplanmıştır (Maiden / Şartlı / Handikap / KV / Grup / Satış / Diğer); 'Diğer' karışık bir kutudur.");
fs.writeFileSync("SINYAL_TIP_KONTROL_RAPORU.md", L2.join("\n"));
console.log(`YAZILDI SINYAL_TIP_KONTROL_RAPORU.md | ${L2.length} satır | tipler: ${TIPLER.map((t) => t + ":" + idxTip(t).length).join(" ")}`);
await db.$disconnect(); process.exit(0);
