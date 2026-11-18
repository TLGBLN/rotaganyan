/**
 * GALOP kalitesi yeniden inceleme (kullanıcı isteği 2026-11-18). SALT-OKUMA; aday sinyal DEĞİL, SINYAL_KAYDI boş. Yeni formül önerilmez.
 * Kapsam/seyreltme, bileşenler (hız/kapanış/efor), yarış tipine göre, B5 beklentisine göre betimleyici. Çıktı: GALOP_KALITE_RAPORU.md
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
        const d = id == null ? null : dereceBilesenleri(gd, id); const hs = id == null ? null : h2hNetCoklu(gh, id, rakipIds, hedef, PARS); const v: Record<string, number | null> = { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), kH: pH[i] ?? null, kK: pK[i] ?? null, kE: pE[i] ?? null, gGun: G[i]?.sonGalopGun ?? null, gN: G[i]?.guven.pencereGalop ?? null, hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, S6: d?.son6 ?? null, ANT: r.trainer && an(r.trainer) ? antrenorBilesenleri(gtr, an(r.trainer)).seviye.deger : null };
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
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, kH: 1, kK: 1, kE: 1 } as Record<string, number>)[c] ?? 0.3;
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

// ───── ANTRENÖR sızıntı (gelecek-bozma) + bağımsız yeniden hesap
let aDen = 0, aFark = 0; for (const t of secilen) { const g0 = aDep.gorunum(t), g1 = aDep.gelecegiBoz(t, 11 + (t / ANT_GUN_MS) % 991).gorunum(t); for (const x of new Set(A.filter((k) => k.t === t).flatMap((k) => ksA.find((q) => q.id === k.raceId)!.runners.map((r) => an(r.trainer))))) { if (!x) continue; aDen++; if (JSON.stringify(antrenorBilesenleri(g0, x)) !== JSON.stringify(antrenorBilesenleri(g1, x))) aFark++; } }
let aBag = 0, aOrn = 0; { const ornA = A.flatMap((k) => k.atlar.filter((a) => a.v.ANT != null).map((a) => ({ a, k }))); for (let i = 0; i < 150 && ornA.length; i++) { const { a, k } = ornA[Math.floor(rnd() * ornA.length)]!; aOrn++; const kr = rid.get(k.raceId)!; const tr = an(kr.runners.find((q) => q.no === a.no)!.trainer); const my = rr.filter((x) => an(x.trainer) === tr && dayMs(x.race.raceDay.date) < k.t && dayMs(x.race.raceDay.date) >= k.t - 365 * ANT_GUN_MS); const n = my.length, w = my.filter((x) => ((x.race.result?.winnerNos ?? []) as number[]).includes(x.no)).length; const p0 = mean(my.map((x) => 1 / alanN.get(x.race.id)!)); const v = (w + 8 * p0) / (n + 8); if (n === 0 || Math.abs(v - a.v.ANT!) > 1e-9) aBag++; } }


// ───── GALOP KALİTESİ YENİDEN İNCELEME (kullanıcı isteği 2026-11-18). Yeni sinyal/tanım ÖNERİLMEZ; mevcut GALOP_KAPASITE ölçülür, bileşenleri ayrı görülür.
const AY = (t: number) => new Date(t).toISOString().slice(0, 7); const ALL = [...A, ...B.filter((k) => !new Set(A.map((q) => q.raceId)).has(k.raceId)), ...C].sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
const ESIK = 0.7; const kapliAt = (k: Kosu) => k.atlar.filter((a) => a.v.kap != null).length / k.atlar.length; const kapli = (k: Kosu) => kapliAt(k) >= ESIK;
const S = ALL.filter(kapli);
console.log(`ALL ${ALL.length}; galop kapsamlı (≥%${ESIK * 100} atında galop) ${S.length}`);

// ───── veri kalitesi: ham galop kayıtları
const red = new Map<string, number>(); let hamN = 0, kabul = 0; for (const h of galopHam) { hamN++; const { kayit, red: r } = galopNormalize({ atId: h.runner.tjkAtId ?? -1, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: null, yasGrubu: null } as GalopHam); if (kayit) kabul++; else red.set(r ?? "?", (red.get(r ?? "?") ?? 0) + 1); }
const galopAy = new Map<string, number>(); for (const g of galopTek) galopAy.set(AY(g.tarih), (galopAy.get(AY(g.tarih)) ?? 0) + 1);

// ───── modeller
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const B5: Kol[] = ["acc", "S", "S6", DEF, "ANT"]; const C5: Kol[] = [...B5, ...KON]; const MD: [string, Kol[]][] = [];
const e = (ad: string, k: Kol[]) => MD.push([ad, k]);
e("G", ["kap"]); e("ACC", ["acc"]); e("ACC+G", ["acc", "kap"]);
e("B5", B5); e("B6", [...B5, "kap"]); e("B5+kH", [...B5, "kH"]); e("B5+kK", [...B5, "kK"]); e("B5+kE", [...B5, "kE"]); e("B8", [...B5, "kH", "kK", "kE"]);
e("c5", C5); e("c6", [...C5, "kap"]); e("c5+kH", [...C5, "kH"]); e("c5+kK", [...C5, "kK"]); e("c5+kE", [...C5, "kE"]);
console.log(`Modeller: ${MD.length}`); console.log("Test (galop kapsamlı yarışlar, 6 blok ileri-yönlü)…"); const R = degerlendir(S, MD, ["B5"]);
console.log("Test (TÜM yarışlar; seyreltme kontrolü)…"); const RAll = degerlendir(ALL, [["B5", B5], ["B6", [...B5, "kap"]]], []);
const mk = (R_: Sonuc) => ({ ll: { ...R_.ll, "1N": R_.taban } as Record<string, number[]>, t1: { ...R_.t1, "1N": R_.r1 } as Record<string, number[]>, t3: { ...R_.t3, "1N": R_.r3 } as Record<string, number[]>, taban: R_.taban, r1: R_.r1, r3: R_.r3, tip: R_.test.map((i) => R_.yk[i]!.k.tip), kapli: R_.test.map((i) => kapli(R_.yk[i]!.k)), yari: R_.test.map((_, j) => (j < R_.test.length / 2 ? 0 : 1)) });
const H = mk(R); const HA = mk(RAll);
type HH = ReturnType<typeof mk>;
const idxOf = (h: HH, f: (i: number) => boolean) => h.tip.map((_, i) => (f(i) ? i : -1)).filter((i) => i >= 0);
const tum = idxOf(H, () => true); const TIPLER = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"].filter((t) => H.tip.includes(t)); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(h: HH, a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => h.taban[i]!)); const dl = idx.map((i) => (h.ll[b]![i]! - h.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (h.t1[a]![i]! - h.t1[b]![i]!) * 100), d3 = idx.map((i) => (h.t3[a]![i]! - h.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1].map((y) => { const q = idx.filter((i) => h.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => h.ll[b]![i]! - h.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○");
const seviye = (h: HH, ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => h.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => h.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => h.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => h.t3[ad]![i]!)) * 100 }; };
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
const rPar = (pop: Kosu[], x: Kol, y: Kol) => { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); };
function r2(pop: Kosu[], onceki: Kol[], yeni: Kol) { const rows = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50) return NaN; const Hh = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) Hh[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) Hh[a]![a] += 1e-9; const b = coz(Hh, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }

// ───── RAPOR
const L2: string[] = []; const P = (s = "") => L2.push(s);
P("# GALOP kalitesi — yeniden inceleme (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)");
P("Kullanıcı gözlemi: galop her yarış tipinde faydalı olmalı. Önceki testlerde GALOP_KAPASITE küçük çıktı; bu rapor bunun **veri kapsamından mı, tanımdan mı, gerçekten küçük etkiden mi** kaynaklandığını ayırmaya çalışır. **Yeni formül/sinyal önerilmedi ve hiçbir parametre sonuca göre seçilmedi**; yalnız mevcut tanım (GALOP_KAPASITE = hız, kapanış, efor yüzdeliklerinin ortalaması; her biri o yarışta atlar arası yüzdelik) farklı koşullarda ölçüldü, bileşenleri ayrı gösterildi.");
P("");
P("## 0. Düzenek");
P(`- **Galop kapsamlı yarış** = atlarının ≥%${ESIK * 100}'inde yarış-öncesi (tarih < yarış günü; atın son koşusundan sonraki galoplar) GALOP_KAPASITE hesaplanabilen yarış. Bu, yarıştan ÖNCE bilinen bir koşuldur (sonuca bağlı değil). Eşik önceden belirlendi, sonuca göre ayarlanmadı.`);
P(`- **Örneklem S:** galop kapsamlı ${S.length} yarış (${S.length ? new Date(S[0]!.t).toISOString().slice(0, 10) : "—"} → ${S.length ? new Date(S[S.length - 1]!.t).toISOString().slice(0, 10) : "—"}), tek kronolojik havuz, 6 blokluk ileri-yönlü β (yalnız önceki bloklardan). Tüm yarışlar ${ALL.length}. **S, A ve B olarak tekrar kullanılan dönemle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**`);
P("- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1. ve 2. yarısında.");
P("- **B5** = ACC_HIZ + J_SEVIYE + SON6 + H2H_NET (H_180_3, seçim değil) + ANT_SEVIYE (galopsuz beş sinyal); **B6** = B5 + GALOP_KAPASITE. Kontrollü (c) = hp, geçmiş performans, sınıf değişimi eklenmiş.");
P(`- Doğrulama: H2H ızgarası gelecek-bozma testi ${farkli === 0 && denenen > 0 ? "GEÇTİ" : "SIZINTI VAR"}; ANT ${aFark === 0 && aDen > 0 ? "GEÇTİ" : "SIZINTI VAR"}; bağımsız yeniden hesap H2H ${bagH}/${nOrn}, ANT ${aBag}/${aOrn}. GALOP'un as-of/sızıntı testleri birim testlerinde (galop-aday.test.ts).`);
P("");
// 1. kapsam
P("## 1. Neden önceki testlerde etkisi küçük göründü? — kapsam");
P("Galop kaydı yılın başında seyrek, sonlara doğru dolu (referans grupları ≥30 galop gerektirdiği için ilk aylarda ayrıca hesaplanamıyor). Eksik değer yarış-içi ortalamayla doldurulduğundan, kapsamı düşük dönemlerin eklenmesi β'yı ve görünen katkıyı **seyreltir**.");
P("| Ay | Galop kaydı (galop tarihine göre) | Yarış | At kapsamı (GALOP_KAPASITE) | Galop kapsamlı yarış payı |\n|---|---|---|---|---|");
const aylar = [...new Set(ALL.map((k) => AY(k.t)))].sort(); for (const ay of aylar) { const ys = ALL.filter((k) => AY(k.t) === ay); const at = ys.flatMap((k) => k.atlar); P(`| ${ay} | ${galopAy.get(ay) ?? 0} | ${ys.length} | ${pct(at.filter((a) => a.v.kap != null).length / at.length)}% | ${pct(ys.filter(kapli).length / ys.length)}% |`); }
P("");
P(`- **Ham galop kaydı:** ${hamN}; kabul edilen ${kabul} (%${pct(kabul / hamN)}); reddedilen nedenler: ${[...red].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "yok"}. Tekilleştirme sonrası ${galopTek.length} kayıt.`);
const sSAt = S.flatMap((k) => k.atlar); const gunler = sSAt.map((a) => a.v.gGun).filter((q): q is number => q != null); const nler = sSAt.map((a) => a.v.gN).filter((q): q is number => q != null);
P(`- **Kapsamlı yarışlarda** at kapsamı ${pct(sSAt.filter((a) => a.v.kap != null).length / sSAt.length)}%; atın son galopundan yarışa kadar medyan ${f(medyan(gunler), 0)} gün; son koşudan sonraki galop sayısı medyan ${f(medyan(nler), 0)}.`);
P("");
// 2. seyreltme
P("## 2. Seyreltme kontrolü: aynı model, galop kapsamlı ve kapsamsız yarışlarda ayrı");
P("**TÜM yarışlar** (kapsamsız dahil) üzerinde 6 blok ileri-yönlü β ile B5 ve B6 eğitildi; test yarışları galop kapsamlı / kapsamsız diye ayrı değerlendirildi. Aynı modelde galop katkısı kapsamlı yarışlarda belirgin farklıysa, önceki küçük sonuç büyük ölçüde kapsam seyreltmesidir.");
P("| Test dilimi | n yarış | ΔLL% (B6 − B5) [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|---|");
for (const [ad, f2] of [["Tümü", () => true], ["Galop kapsamlı yarışlar", (i: number) => HA.kapli[i]!], ["Galop kapsamsız yarışlar", (i: number) => !HA.kapli[i]!]] as [string, (i: number) => boolean][]) { const idx = idxOf(HA, f2); if (idx.length < 40) continue; const x = fark(HA, "B6", "B5", idx); P(`| ${ad} | ${idx.length} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} | ${x.tut} |`); }
P("");
// 3. S örnekleminde katkı
const KARS: [string, string, string][] = [["GALOP_KAPASITE tek başına (1/N'ye karşı)", "G", "1N"], ["ACC_HIZ tek başına (1/N'ye karşı)", "ACC", "1N"], ["GALOP, ACC_HIZ üzerine", "ACC+G", "ACC"], ["**GALOP_KAPASITE, B5 üzerine (kapsamlı yarışlar)**", "B6", "B5"], ["  hız bileşeni, B5 üzerine", "B5+kH", "B5"], ["  kapanış bileşeni, B5 üzerine", "B5+kK", "B5"], ["  efor bileşeni, B5 üzerine", "B5+kE", "B5"], ["  üç bileşen ayrı ayrı (B8), B6 üzerine (ayrıştırmak ek katıyor mu?)", "B8", "B6"], ["GALOP_KAPASITE, kontrollü B5 üzerine", "c6", "c5"], ["  hız, kontrollü", "c5+kH", "c5"], ["  kapanış, kontrollü", "c5+kK", "c5"], ["  efor, kontrollü", "c5+kE", "c5"]];
P("## 3. Galop kapsamlı yarışlarda katkı (tüm test yarışları)");
P(`Test yarışı ${tum.length}; rastgele (1/N) Top1 ${fx(mean(tum.map((i) => H.r1[i]!)) * 100, 1)}%, Top3 ${fx(mean(tum.map((i) => H.r3[i]!)) * 100, 1)}%.`);
P("| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |\n|---|---|---|---|---|"); for (const [ad, a, b] of KARS) { const x = fark(H, a, b, tum); P(`| ${ad} (${a} − ${b}) | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} | ${x.tut} |`); }
P("");
P("**Model düzeyleri:**"); P("| Model | Kazanç % | Top1 % | Top3 % |\n|---|---|---|---|"); for (const [ad] of MD) { const s = seviye(H, ad, tum); P(`| ${ad} | ${fx(s.ll)}% | ${fx(s.t1, 1)}% | ${fx(s.t3, 1)}% |`); }
P("");
P("**Örtüşme (yarış-içi merkezlenmiş r; kapsamlı yarışlar):**"); P("| Sinyal | r(ACC_HIZ) | r(J_SEVIYE) | r(SON6) | r(H2H) | R² (B5 ile) |\n|---|---|---|---|---|---|");
for (const nm of ["kap", "kH", "kK", "kE"]) P(`| ${nm === "kap" ? "GALOP_KAPASITE" : nm === "kH" ? "hız yüzdeliği" : nm === "kK" ? "kapanış yüzdeliği" : "efor yüzdeliği"} | ${f(rPar(S, "acc", nm), 2)} | ${f(rPar(S, "S", nm), 2)} | ${f(rPar(S, "S6", nm), 2)} | ${f(rPar(S, DEF, nm), 2)} | ${f(r2(S, B5, nm), 3)} |`);
P("");
// 4. tipe göre
P("## 4. Yarış tipine göre (galop kapsamlı yarışlar; n ≥ " + MIN_N + " 'yeterli')");
P("Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). β tüm tiplerde ortak.");
const dil: [string, number[]][] = [["Tümü", tum], ...TIPLER.map((t): [string, number[]] => [t, idxOf(H, (i) => H.tip[i] === t)])];
P("| Karşılaştırma | " + dil.map(([a, idx]) => `${a} (n=${idx.length}${idx.length < MIN_N ? ", yetersiz" : ""})`).join(" | ") + " |\n|---|" + "---|".repeat(dil.length));
for (const [ad, a, b] of [["**GALOP_KAPASITE → B5**", "B6", "B5"], ["hız → B5", "B5+kH", "B5"], ["kapanış → B5", "B5+kK", "B5"], ["efor → B5", "B5+kE", "B5"], ["GALOP_KAPASITE → c5 (kontrollü)", "c6", "c5"], ["GALOP → ACC_HIZ", "ACC+G", "ACC"]] as [string, string, string][]) P(`| ${ad} | ` + dil.map(([, idx]) => { const x = fark(H, a, b, idx); return `${isaret(x.llLo, x.llHi)} ${fx(x.ll)}% (${x.tut})`; }).join(" | ") + " |");
P("");
P("**GALOP_KAPASITE → B5 tip başına ayrıntı:**"); P("| Tip | n | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |\n|---|---|---|---|---|");
for (const [ad, idx] of dil) { if (idx.length < 40) continue; const x = fark(H, "B6", "B5", idx); P(`| ${ad}${idx.length < MIN_N ? " (yetersiz n)" : ""} | ${idx.length} | ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi)} | ${ci(x.t3, x.t3Lo, x.t3Hi)} |`); }
P("");
// 5. betimleyici: B5'in ötesinde galop kazananı ayırıyor mu
P("## 5. Betimleyici: galopsuz beş sinyalin (B5) beklentisine göre kazanma");
P("B5 modelinin (ileri-yönlü β) test yarışlarındaki olasılığı P; z = (kazanan − ΣP)/√ΣP(1−P). Galop, B5'in ötesinde bilgi taşıyorsa yüksek yüzdelikli atlarda z>0, düşüklerde z<0 beklenir. Çok sayıda hücre; düzeltme yok.");
type Hc = { y: number; p: number }[]; const topla = (key: (a: At) => string | null) => { const m = new Map<string, Hc>(); R.probs["B5"]!.forEach((pr, j) => { const k = R.yk[R.test[j]!]!.k; k.atlar.forEach((a, i) => { const g = key(a); if (g == null) return; const arr = m.get(g) ?? []; arr.push({ y: a.kazandi ? 1 : 0, p: pr[i]! }); m.set(g, arr); }); }); return m; };
const tabloZ = (baslik: string, m: Map<string, Hc>, sira: string[]) => { P(`**${baslik}**`); P("| Grup | n at | Kazanan | Beklenen (B5) | z |\n|---|---|---|---|---|"); for (const g of sira) { const h = m.get(g); if (!h || h.length < 50) continue; const y = sum(h.map((q) => q.y)), p = sum(h.map((q) => q.p)); const z = (y - p) / Math.sqrt(sum(h.map((q) => q.p * (1 - q.p)))); P(`| ${g} | ${h.length} | ${y} | ${f(p, 1)} | ${f(z, 2)} |`); } P(""); };
tabloZ("GALOP_KAPASITE yüzdeliği (yarış-içi; 0=en düşük, 1=en yüksek)", topla((a) => (a.v.kap == null ? "galopsuz" : a.v.kap < 0.2 ? "0,0–0,2" : a.v.kap < 0.4 ? "0,2–0,4" : a.v.kap < 0.6 ? "0,4–0,6" : a.v.kap < 0.8 ? "0,6–0,8" : "0,8–1,0")), ["galopsuz", "0,0–0,2", "0,2–0,4", "0,4–0,6", "0,6–0,8", "0,8–1,0"]);
tabloZ("Son galopun yarıştan uzaklığı (gün)", topla((a) => (a.v.gGun == null ? "galopsuz" : a.v.gGun <= 3 ? "0–3 gün" : a.v.gGun <= 7 ? "4–7 gün" : a.v.gGun <= 14 ? "8–14 gün" : "15+ gün")), ["galopsuz", "0–3 gün", "4–7 gün", "8–14 gün", "15+ gün"]);
tabloZ("Son koşudan sonraki galop sayısı", topla((a) => (a.v.gN == null ? "galopsuz" : a.v.gN === 1 ? "1 galop" : a.v.gN === 2 ? "2 galop" : "3+ galop")), ["galopsuz", "1 galop", "2 galop", "3+ galop"]);
P("## Sınırlar ve dürüst notlar");
P("- Bu, galop için bir **tanı** çalışmasıdır: tanım değiştirilmedi, bileşenler yalnız ölçüldü. Bölüm 3'te üç bileşenin ayrı verilmesi, kullanıcı onayı olmadan yeni bir galop sinyalinin kabulü değildir.");
P("- Galop kapsamlı yarışlar seçilmiş bir altkümedir (galop verisi toplanmış dönem/hipodromlar, referans grupları dolu olanlar): bu dönemde başka koşullar da farklı olabilir; sonuç tüm yarışlara doğrudan genellenemez.");
P("- Galop bilgisi atın antrenman kayıtlarıdır: jokey/antrenör tercihleri ve koşu planlarıyla (örneğin hazırlıklı atlara daha çok galop yaptırılması) ilişkili olabilir; nedensel yorum yapılamaz.");
P("- A ve B tekrar kullanıldı; S bu dönemle örtüşür. Çoklu karşılaştırma düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Doğrusal-logit ve ortak β varsayımı geçerlidir.");
fs.writeFileSync("GALOP_KALITE_RAPORU.md", L2.join("\n"));
console.log(`YAZILDI GALOP_KALITE_RAPORU.md | ${L2.length} satır | S ${S.length}/${ALL.length}`);
await db.$disconnect(); process.exit(0);
