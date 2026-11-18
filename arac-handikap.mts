/**
 * HANDİKAP araştırması (kullanıcı isteği 2026-11-18): H_KILO_ETKI, H_SINIF_FARKI, H_SIKLET_DEGISIMI (H_APRANTI_ETKI veri yok), GALOP_KAPASITE özel handikap testi.
 * SALT-OKUMA; aday sinyal DEĞİL; katsayı/ağırlık kararı YOK; SINYAL_KAYDI boş. Çıktı: HANDIKAP_ARASTIRMA_RAPORU.md
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
const dRows: DereceKaydi[] = []; const hRows: H2HKayit[] = []; const audit: { t: number; irk: string; yuzey: string; hip: string; mesafe: number; sure: number; tip: string }[] = []; const gecmis = new Map<number, { t: number; fp: number | null; sinif: number | null; w: number | null; hp: number | null; d: number; key: string }[]>(); const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
let ham = 0, gecerliSure = 0, gecerliSira = 0, gecerliKey = 0; const yarisAt = new Map<string, { atId: number; hp: number | null; w: number | null }[]>();
for (let skip = 0; ; skip += 2000) { const parca = await db.horseRaceHistoryCache.findMany({ select: { tjkAtId: true, rowsJson: true }, orderBy: { tjkAtId: "asc" }, skip, take: 2000 }); if (!parca.length) break;
  for (const c of parca) { const liste: { t: number; fp: number | null; sinif: number | null; w: number | null; hp: number | null; d: number; key: string }[] = [];
    for (const x of (c.rowsJson as Record<string, unknown>[]) ?? []) { ham++; const t = trTarih(x.date); if (t == null) continue; gEkle(c.tjkAtId, t); const fp = parseInt(String(x.finishPos ?? ""), 10); const sira = Number.isFinite(fp) && fp > 0 ? fp : null; const tip = kabaG(normalizeClassType(String(x.classType ?? ""))); 
      const city = String(x.city ?? "").trim().toLocaleUpperCase("tr"); const mesafe = parseInt(String(x.distance ?? ""), 10); const yuzey = YUZ_H[String(x.surface ?? "").trim().charAt(0).toLocaleUpperCase("tr")] ?? null; const gr = String(x.group ?? "").trim().toLocaleUpperCase("tr"); const irk = gr.endsWith("A") ? "ARAP" : gr.endsWith("İ") || gr.endsWith("I") ? "INGILIZ" : null; const raceNo = String(x.raceNo ?? "").trim(); const wP = parseFloat(String(x.weight ?? "").replace(",", ".")); const hpP = parseInt(String(x.hp ?? ""), 10); const gKey = city + "|" + t + "|" + raceNo; const wOk = Number.isFinite(wP) && wP > 30 && wP < 90 ? wP : null, hpOk = Number.isFinite(hpP) && hpP > 0 ? hpP : null;
      liste.push({ t, fp: sira, sinif: SINIF_RANK[tip] ?? null, w: wOk, hp: hpOk, d: Number.isFinite(mesafe) ? mesafe : 0, key: gKey }); if (city && raceNo) { const arr = yarisAt.get(gKey) ?? []; if (!arr.some((q) => q.atId === c.tjkAtId)) arr.push({ atId: c.tjkAtId, hp: hpOk, w: wOk }); yarisAt.set(gKey, arr); }
      if (sira != null && city && raceNo) { gecerliSira++; hRows.push({ yarisKey: city + "|" + t + "|" + raceNo, atId: c.tjkAtId, tarih: t, sira, yuzey: yuzey ?? "?", mesafe: Number.isFinite(mesafe) ? mesafe : 0 }); }
      const sure = sureAyir(x.time); if (sure != null && city && yuzey && irk && Number.isFinite(mesafe) && mesafe >= 800 && mesafe / sure >= 10 && mesafe / sure <= 20) { gecerliSure++; dRows.push({ atId: c.tjkAtId, tarih: t, irk, yuzey, hip: city, mesafe, sure }); audit.push({ t, irk, yuzey, hip: city, mesafe, sure, tip }); } }
    gecmis.set(c.tjkAtId, liste.sort((a, b) => a.t - b.t)); } }
console.log(`satır ${ham}; geçerli resmî süre+referans alanları ${gecerliSure}; H2H için geçerli sıra+yarış anahtarı ${gecerliSira}`);
const dDep = new DereceDeposu(dRows), hDep = new H2HDeposu(hRows);

// ───── yarış listeleri, Accurace (ACC_HIZ tabanı için), galop
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true, surfaceConditions: true } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, name: true, tjkAtId: true, jockey: true, trainer: true, hp: true, weight: true } } };
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
type Kol = string; const GRID: { ad: string; par: H2HPar }[] = []; for (const hl of [180]) for (const lam of [3]) GRID.push({ ad: `H_${hl}_${lam}`, par: { yarimOmurGun: hl, lambda: lam, yuzey: "AYNI" } }); 
const PARS = GRID.map((g) => g.par); const VARS = GRID.map((g) => g.ad); const DEF = "H_180_3"; // DEF yalnız ayrıntılı tablo için bir başlangıç; SEÇİM DEĞİL
type At = { raceId: string; no: number; kazandi: boolean; v: Record<string, number | null>; hn: number; hToplam: number; s6n: number; s6Gun: number | null };
type Kosu = { raceId: string; t: number; tip: string; ganyan: number | null; dist: number; sn: number | null; zp: number | null; atlar: At[] };
const pistKod = (sc: unknown, yuzey: string): number | null => { const a = sc as { label?: string; detail?: string }[] | null; if (!Array.isArray(a) || !a.length) return null; const lab = yuzey === "KUM" ? "Kum" : yuzey === "CIM" ? "Çim" : "Sentetik"; const o = a.find((x) => x.label === lab); if (!o) return null; const d = String(o.detail ?? "").trim(); if (!d) return null; return /^normal/i.test(d) ? 0 : 1; };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function ozellikler(ks: typeof ksA): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gj = jDep.gorunum(t), gtr = aDep.gorunum(t), gd = dDep.gorunum(t), gh = hDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null; const hedef = { yuzey: YUZ_R[String(k.surface)] ?? "?", mesafe: k.distance }; const rakipIds = k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
      const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      const hkR = tip === "Handikap"; const snM = k.classType.match(/Handikap\s*(\d+)/i); const sn = snM ? parseInt(snM[1]!, 10) : null; const zp = pistKod(k.raceDay.surfaceConditions, String(k.surface)); const lnD = Math.log(k.distance / 1600);
      const wsAll = k.runners.map((r) => r.weight ?? null), hpsAll = k.runners.map((r) => r.hp ?? null); const Wm = nn(wsAll).length ? mean(nn(wsAll)) : null; const hpSum = sum(nn(hpsAll)), hpN = nn(hpsAll).length, hpm = hpN ? hpSum / hpN : null;
      out.push({ raceId: k.id, t, tip, ganyan: k.result?.ganyan ?? null, dist: k.distance, sn, zp, atlar: k.runners.map((r, i) => { const id = r.tjkAtId; const onceki = (id == null ? [] : gecmis.get(id) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        const d = id == null ? null : dereceBilesenleri(gd, id); const hs = id == null ? null : h2hNetCoklu(gh, id, rakipIds, hedef, PARS); const v: Record<string, number | null> = { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, S6: d?.son6 ?? null, ANT: r.trainer && an(r.trainer) ? antrenorBilesenleri(gtr, an(r.trainer)).seviye.deger : null };
        VARS.forEach((nm, q) => { v[nm] = hs ? hs[q]!.deger : null; }); const hi = VARS.indexOf(DEF);
        if (hkR) { const W = r.weight ?? null, hpv = r.hp ?? null; const Wgor = W != null && Wm != null ? W - Wm : null; v.Wgor = Wgor; v.WgD = Wgor == null ? null : Wgor * lnD; v.WgZ = Wgor == null || zp == null ? null : Wgor * zp; v.Wres = Wgor != null && hpv != null && hpm != null ? Wgor - 0.5 * (hpv - hpm) : null;
          const son3r = onceki.slice(-3); const pastRiv: number[] = [], pastWg: number[] = [], pastW: number[] = [], pastHp: number[] = [], pastD: number[] = [];
          for (const g of son3r) { const part = yarisAt.get(g.key) ?? []; const rv = nn(part.filter((q) => q.atId !== id).map((q) => q.hp)); if (rv.length >= 3) pastRiv.push(mean(rv)); const ws = nn(part.map((q) => q.w)); if (ws.length >= 4 && g.w != null) pastWg.push(g.w - mean(ws)); if (g.w != null) pastW.push(g.w); if (g.hp != null) pastHp.push(g.hp); if (g.d > 0) pastD.push(g.d); }
          const todayRiv = hpv != null && hpN >= 4 ? (hpSum - hpv) / (hpN - 1) : null; v.HS = pastRiv.length && todayRiv != null ? mean(pastRiv) - todayRiv : null;
          v.dWr = Wgor != null && pastWg.length ? Wgor - mean(pastWg) : null; v.dWa = W != null && pastW.length ? W - mean(pastW) : null; v.dHP = hpv != null && pastHp.length ? hpv - mean(pastHp) : null; v.dD = pastD.length ? Math.log(k.distance / mean(pastD)) : null; v.HSn = pastRiv.length; v.dWn = pastWg.length; }
        return { raceId: k.id, no: r.no, kazandi: win.has(r.no), v, hn: hs ? hs[hi]!.nRakip : 0, hToplam: hs ? hs[hi]!.toplamRakip : 0, s6n: d?.guven.kullanilan ?? 0, s6Gun: d?.guven.sonYarisGun ?? null }; }) }); } }
  return out;
}
function hkEtkilesim(pop: Kosu[]) { for (const k of pop) { if (k.tip !== "Handikap") continue; const sv = nn(k.atlar.map((a) => a.v.S)); const sm = sv.length ? mean(sv) : null; for (const a of k.atlar) { const kc = a.v.kap == null ? null : (a.v.kap as number) - 0.5; const sc = a.v.S == null || sm == null ? null : ((a.v.S as number) - sm) / 0.1; const Wg = a.v.Wgor ?? null, hs = a.v.HS ?? null; a.v.IWK = Wg == null || kc == null ? null : Wg * kc; a.v.IWJ = Wg == null || sc == null ? null : Wg * sc; a.v.IHK = hs == null || kc == null ? null : hs * kc; a.v.IHJ = hs == null || sc == null ? null : hs * sc; } } }
// ───── ölçü cihazı
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, Wgor: 3, WgD: 1, WgZ: 3, Wres: 2, HS: 10, dWr: 3, dWa: 3, dHP: 5, dD: 0.3, IWK: 2, IWJ: 3, IHK: 5, IHJ: 10 } as Record<string, number>)[c] ?? 0.3;
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

// ───── tüm yarışlar → handikap alt kümesi
const ksRest = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksAll = [...new Map([...ksA, ...ksB, ...ksRest].map((k) => [k.id, k])).values()];
console.log("Özellikler (as-of)…"); const ALL = ozellikler(ksAll).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1)); hkEtkilesim(ALL);
const HK = ALL.filter((k) => k.tip === "Handikap"); console.log(`ALL ${ALL.length}; Handikap ${HK.length}`);
const ilkT = (P_: Kosu[]) => (P_.length ? new Date(Math.min(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P_: Kosu[]) => (P_.length ? new Date(Math.max(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—");

// ───── modeller
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const BASE5: Kol[] = ["acc", "kap", "S", "S6", DEF]; const BASE4: Kol[] = ["acc", "S", "S6", DEF]; const cB5: Kol[] = [...BASE5, ...KON];
const SETS: Record<string, { k: Kol[]; ad: string }> = { K1: { k: ["Wgor"], ad: "H_KILO_ETKI (β1: göreli kilo)" }, K2: { k: ["Wgor", "WgD"], ad: "H_KILO_ETKI (+ mesafe etkileşimi)" }, K3: { k: ["Wgor", "WgD", "WgZ"], ad: "H_KILO_ETKI (+ mesafe + pist etkileşimi)" }, KR: { k: ["Wres"], ad: "Kilo artığı (handikap formülünden sapma)" },
  HS: { k: ["HS"], ad: "H_SINIF_FARKI" }, DW: { k: ["dWr"], ad: "H_SIKLET_DEGISIMI (göreli)" }, DWa: { k: ["dWa"], ad: "H_SIKLET_DEGISIMI (mutlak kg)" }, DW2: { k: ["dWr", "dHP", "dD"], ad: "H_SIKLET_DEGISIMI + Δhp + Δmesafe" }, DHP: { k: ["dHP"], ad: "Δhp (handikap puanı değişimi) TEK BAŞINA" }, DD: { k: ["dD"], ad: "Δmesafe (ln bugün/geçmiş) TEK BAŞINA" }, DWHP: { k: ["dWr", "dHP"], ad: "ΔW göreli + Δhp" }, DWD: { k: ["dWr", "dD"], ad: "ΔW göreli + Δmesafe" }, KS: { k: ["Wgor", "WgD", "HS"], ad: "KİLO + SINIF birlikte" }, KSD: { k: ["Wgor", "WgD", "WgZ", "HS", "dWr"], ad: "KİLO + SINIF + SIKLET DEĞİŞİMİ" } };
const MD1: [string, Kol[]][] = [["K0", KON], ["B5", BASE5], ["cB5", cB5]]; for (const [id, s] of Object.entries(SETS)) { MD1.push(["a_" + id, s.k]); MD1.push(["b_" + id, [...BASE5, ...s.k]]); MD1.push(["c_" + id, [...cB5, ...s.k]]); }
MD1.push(["c_K1+IWK", [...cB5, "Wgor", "IWK"]], ["c_K1+IWJ", [...cB5, "Wgor", "IWJ"]], ["c_HS+IHK", [...cB5, "HS", "IHK"]], ["c_HS+IHJ", [...cB5, "HS", "IHJ"]], ["b_K1+IWK", [...BASE5, "Wgor", "IWK"]], ["b_K1+IWJ", [...BASE5, "Wgor", "IWJ"]], ["b_HS+IHK", [...BASE5, "HS", "IHK"]], ["b_HS+IHJ", [...BASE5, "HS", "IHJ"]]);
console.log(`P1 modeller: ${MD1.length}; Handikap-only 6 blok ileri-yönlü…`); const R1 = degerlendir(HK, MD1, []);
const kapliG = (k: Kosu) => k.atlar.filter((a) => a.v.kap != null).length / k.atlar.length >= 0.7; const SG = ALL.filter(kapliG);
const MD2: [string, Kol[]][] = [["G0", BASE4], ["G1", BASE5], ["cG0", [...BASE4, ...KON]], ["cG1", [...BASE5, ...KON]], ["G1+W", [...BASE5, "Wgor"]], ["G1+W+IWK", [...BASE5, "Wgor", "IWK"]], ["G1+W+IWJ", [...BASE5, "Wgor", "IWJ"]], ["cG1+W", [...cB5, "Wgor"]], ["cG1+W+IWK", [...cB5, "Wgor", "IWK"]], ["G1+HS", [...BASE5, "HS"]], ["G1+HS+IHK", [...BASE5, "HS", "IHK"]]];
console.log(`P2 (galop kapsamlı ${SG.length} yarış, tüm tipler, handikap dilimi)…`); const R2 = degerlendir(SG, MD2, ["G0"]);

// ───── ortak yardımcılar
const mk = (R: Sonuc) => ({ R, ll: { ...R.ll, "1N": R.taban } as Record<string, number[]>, t1: { ...R.t1, "1N": R.r1 } as Record<string, number[]>, t3: { ...R.t3, "1N": R.r3 } as Record<string, number[]>, taban: R.taban, tip: R.test.map((i) => R.yk[i]!.k.tip), sn: R.test.map((i) => R.yk[i]!.k.sn), dist: R.test.map((i) => R.yk[i]!.k.dist), zp: R.test.map((i) => R.yk[i]!.k.zp), N: R.test.map((i) => R.yk[i]!.k.atlar.length), yari: R.test.map((_, j) => (j < R.test.length / 2 ? 0 : 1)) });
type HH = ReturnType<typeof mk>; const H1 = mk(R1), H2 = mk(R2);
const idxOf = (h: HH, f: (i: number) => boolean) => h.tip.map((_, i) => (f(i) ? i : -1)).filter((i) => i >= 0); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(h: HH, a: string, b: string, idx: number[]): Fark {
  const m1n = mean(idx.map((i) => h.taban[i]!)); const dl = idx.map((i) => (h.ll[b]![i]! - h.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (h.t1[a]![i]! - h.t1[b]![i]!) * 100), d3 = idx.map((i) => (h.t3[a]![i]! - h.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3);
  const tut = [0, 1].map((y) => { const q = idx.filter((i) => h.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => h.ll[b]![i]! - h.ll[a]![i]!)) > 0 ? "+" : "−"; }).join("");
  return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut };
}
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○"); const hucre = (x: Fark) => `${isaret(x.llLo, x.llHi)} ${fx(x.ll)}% (${x.tut})`;
const seviye = (h: HH, ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => h.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => h.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => h.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => h.t3[ad]![i]!)) * 100 }; };
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
const rPar = (pop: Kosu[], x: Kol, y: Kol) => { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); };
function r2(pop: Kosu[], onceki: Kol[], yeni: Kol) { const rows = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50) return NaN; const Hh = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) Hh[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) Hh[a]![a] += 1e-9; const b = coz(Hh, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }
const sinifGrp = (sn: number | null) => (sn == null ? "?" : sn <= 14 ? "H13–14" : sn <= 16 ? "H15–16" : "H17+"); const mesBand = (d: number) => (d <= 1300 ? "kısa (≤1300)" : d <= 1900 ? "orta (1400–1900)" : "uzun (≥2000)"); const pistGrp = (z: number | null) => (z == null ? "pist durumu yok" : z === 0 ? "Normal" : "Normal dışı"); const sahaGrp = (n: number) => (n <= 9 ? "saha ≤9" : "saha ≥10");
const DILIMLER: [string, (h: HH, i: number) => string][] = [["Handikap sınıfı", (h, i) => sinifGrp(h.sn[i]!)], ["Mesafe", (h, i) => mesBand(h.dist[i]!)], ["Pist durumu", (h, i) => pistGrp(h.zp[i]!)], ["Saha büyüklüğü", (h, i) => sahaGrp(h.N[i]!)], ["Zaman", (h, i) => (h.yari[i] === 0 ? "test 1. yarı" : "test 2. yarı")]];

// ───── RAPOR
const L2r: string[] = []; const P = (s = "") => L2r.push(s);
const at1 = HK.flatMap((k) => k.atlar); const pc = (f2: (a: At) => boolean) => pct(at1.filter(f2).length / at1.length);
P("# HANDİKAP araştırması — kilo, sınıf farkı, sıklet değişimi ve GALOP_KAPASITE etkileşimi (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)");
P("Hiçbir katsayı, ağırlık veya aktivasyon kararı verilmedi. Karşılaştırma tabanı: **ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (B5)**; ‘kontrollü’ taban ayrıca handikap puanı (hp), geçmiş kazanma/ilk-3 oranı ve sınıf değişimi içerir (ağır kilo taşıyan kaliteli atın başarısını kilo avantajı sanmamak için). H_APRANTI_ETKI mevcut veriyle **hesaplanamaz** (bölüm 0).");
P("");
P("## 0. Düzenek, veri gerçekleri, doğrulama");
P(`- **Handikap yarışları:** ${HK.length} yarış (${ilkT(HK)}→${sonT(HK)}), ${at1.length} koşan at; sınıflar H13–H21 (H14 ve H15–16 en kalabalık). **Tekrar kullanılmış dönemle örtüşür; bağımsız/ileri-yönlü doğrulama DEĞİLDİR.**`);
P(`- **Kapsam:** sıklet (Runner.weight) ${pc((a) => a.v.Wgor != null)}% ; handikap puanı ${pc((a) => a.v.hp != null)}% (Haziran 2026'da yarısı eksik, eksik değer sıfır sayılmaz); H_SINIF_FARKI ${pc((a) => a.v.HS != null)}% (geçmiş 3 yarışın rakip hp'leri yalnız önbellekteki atlardan, ≥3 rakip); H_SIKLET_DEGISIMI (göreli) ${pc((a) => a.v.dWr != null)}%; mutlak ${pc((a) => a.v.dWa != null)}%. Bugünkü pist durumu (RaceDay.surfaceConditions) yalnız ${pct(HK.filter((k) => k.zp != null).length / HK.length)}% yarışta var ve bunların çoğu 'Normal' → pist etkileşimi (WgZ) çok az varyansa sahip.`);
P("- **Apranti:** `Runner.apprentice` hiçbir kayıtta dolu değil (68.219 koşucuda 0) ve jokey adlarında işaret yok. **H_APRANTI_ETKI hesaplanamaz.** Kilo artığı (bölüm 1) apranti indirimi DEĞİLDİR: yaş/mesafe indirimleri, özel durumlar ve farklı taban kilo da aynı sapmayı üretir; apranti gerçek bayrak verisiyle (ör. programdaki işaret) ayrı toplanmalı.");
P("- **Tanımlar (kullanıcı):** W_göreli = W − yarış ortalaması. H_SINIF = geçmiş 3 yarıştaki rakiplerin (o yarıştaki kendi hp'leri) hp ortalaması − bugünkü rakiplerin hp ortalaması. ΔW = bugünkü göreli kilo − geçmiş 3 yarıştaki göreli kilo ortalaması (mutlak kg sürümü ayrıca). Kilo artığı = W_göreli − 0,5·(hp − yarış hp ortalaması) (TJK: her handikap puanı için 0,5 kg). Pist: 'Normal'=0, diğer=1.");
P("- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama (neutral). **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓/○/✗ aralık sıfırın üstünde/içinde/altında; (+/−) = ΔLL işareti test yarışlarının 1./2. yarısında. **Protokol 1:** yalnız handikap yarışlarında 6 blok ileri-yönlü β. **Protokol 2 (galop):** galop kapsamlı tüm yarışlarda eğitim, handikap test yarışlarında değerlendirme (galop verisi Temmuz 2026'dan beri var; handikap-only galop dönemi çok küçük).");
P("- Doğrulama: ACC, GALOP, J_SEVIYE, SON6, H2H için gelecek-bozma/bağımsız hesap testleri önceki raporlarda ve birim testlerinde geçmiştir (bu çalışmada yeniden koşulmadı). Geçmiş sıklet/hp/rakip alanları yalnız tarih < yarış günü satırlarından (as-of) hesaplanır. Yeni handikap özellikleri için ayrı vitest modülü yazılmadı (araç içi hesap); bağımsız yeniden hesap aşağıda.");
// bağımsız yeniden hesap (HS, dWr) — düz döngü
let bgN = 0, bgFark = 0; { const rm = new Map(ksAll.map((k) => [k.id, k])); const orn = HK.flatMap((k) => k.atlar.filter((a) => a.v.HS != null || a.v.dWr != null).map((a) => ({ k, a }))); for (let i = 0; i < 120 && orn.length; i++) { const { k, a } = orn[Math.floor(rnd() * orn.length)]!; const kr = rm.get(k.raceId)!; const r = kr.runners.find((q) => q.no === a.no)!; const id = r.tjkAtId; if (id == null) continue; bgN++;
    const on = (gecmis.get(id) ?? []).filter((x) => x.t < k.t).slice(-3); const pr: number[] = [], pw: number[] = []; for (const g of on) { const part = yarisAt.get(g.key) ?? []; const rv = part.filter((q) => q.atId !== id && q.hp != null).map((q) => q.hp!); if (rv.length >= 3) pr.push(rv.reduce((s, x) => s + x, 0) / rv.length); const ws = part.filter((q) => q.w != null).map((q) => q.w!); if (ws.length >= 4 && g.w != null) pw.push(g.w - ws.reduce((s, x) => s + x, 0) / ws.length); }
    const hpl = kr.runners.map((q) => q.hp).filter((x): x is number => x != null); const wl = kr.runners.map((q) => q.weight).filter((x): x is number => x != null); const todayRiv = r.hp != null && hpl.length >= 4 ? (hpl.reduce((s, x) => s + x, 0) - r.hp) / (hpl.length - 1) : null; const hs = pr.length && todayRiv != null ? pr.reduce((s, x) => s + x, 0) / pr.length - todayRiv : null;
    const wg = r.weight != null && wl.length ? r.weight - wl.reduce((s, x) => s + x, 0) / wl.length : null; const dwr = wg != null && pw.length ? wg - pw.reduce((s, x) => s + x, 0) / pw.length : null; const ok = (x: number | null, y: number | null | undefined) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) < 1e-9); if (!ok(hs, a.v.HS) || !ok(dwr, a.v.dWr)) bgFark++; } }
P(`- **Bağımsız yeniden hesap (düz döngü, ham önbellekten):** ${bgN} ata karşı H_SINIF_FARKI ve H_SIKLET_DEGISIMI ${bgFark} uyuşmazlık.`);
P("");
// 1. korelasyon ve formül
P("## 1. Kilo, handikap puanı ve örtüşme");
const wres = nn(at1.map((a) => a.v.Wres ?? null)); const q = (p: number) => [...wres].sort((a, b) => a - b)[Math.floor(p * (wres.length - 1))]!;
P(`**Kilo artığı** (W_göreli − 0,5·ΔHP): p05 ${fx(q(0.05), 1)}, p25 ${fx(q(0.25), 1)}, medyan ${fx(q(0.5), 1)}, p75 ${fx(q(0.75), 1)}, p95 ${fx(q(0.95), 1)} kg. Kilo yarış içinde hp farkıyla neredeyse mekanik ilişkili: **r(W_göreli, hp) = ${f(rPar(HK, "Wgor", "hp"), 2)}**. Bu yüzden 'kilo' ile 'sınıf kalitesi' ayrıştırılmadan yorumlanamaz; kontrollü taban (hp dahil) ve kilo artığı (formülün ötesindeki sıklet) ayrı raporlandı.`);
P("");
P("| Özellik | " + ["ACC_HIZ", "GALOP", "J_SEVIYE", "SON6", "H2H", "hp", "son10 kazanma", "son10 ilk-3", "sınıf değişimi"].map((x) => "r(" + x + ")").join(" | ") + " | R² (B5+kontrol) |\n|---|" + "---|".repeat(10));
for (const [nm, c] of [["W_göreli", "Wgor"], ["Kilo artığı", "Wres"], ["H_SINIF_FARKI", "HS"], ["ΔW göreli", "dWr"], ["ΔW mutlak", "dWa"], ["Δhp", "dHP"]] as [string, string][]) P(`| ${nm} | ` + ["acc", "kap", "S", "S6", DEF, "hp", "win", "top3", "sinif"].map((x) => f(rPar(HK, x, c), 2)).join(" | ") + ` | ${f(r2(HK, cB5, c), 3)} |`);
P("");
// 2. tek başına + 3. özgün katkı
P("## 2–3. Her aday: tek başına, ve mevcut sinyallerin üzerine ÖZGÜN katkı (handikap yarışları, test)");
P(`Test yarışı ${H1.tip.length}; 1/N Top1 ${fx(mean(H1.tip.map((_, i) => 1 / H1.R.yk[H1.R.test[i]!]!.k.atlar.length)) * 100, 1)}%. B5 modeli: kazanç ${fx(seviye(H1, "B5", idxOf(H1, () => true)).ll)}%, kontrollü (cB5) ${fx(seviye(H1, "cB5", idxOf(H1, () => true)).ll)}%.`);
const tumH = idxOf(H1, () => true);
P("| Aday | Tek başına ΔLL% (1/N'ye) | **B5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | **Kontrollü taban (cB5) üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | Tut. (kontrollü) |\n|---|---|---|---|---|---|---|---|---|");
for (const [id, s] of Object.entries(SETS)) { const a = fark(H1, "a_" + id, "1N", tumH), b = fark(H1, "b_" + id, "B5", tumH), c = fark(H1, "c_" + id, "cB5", tumH); P(`| ${s.ad} | ${hucre(a)} | ${isaret(b.llLo, b.llHi)} ${ci(b.ll, b.llLo, b.llHi)} | ${ci(b.t1, b.t1Lo, b.t1Hi, 1)} | ${ci(b.t3, b.t3Lo, b.t3Hi, 1)} | ${isaret(c.llLo, c.llHi)} ${ci(c.ll, c.llLo, c.llHi)} | ${ci(c.t1, c.t1Lo, c.t1Hi, 1)} | ${ci(c.t3, c.t3Lo, c.t3Hi, 1)} | ${c.tut} |`); }
P("");
// 4. alt grup tutarlılığı
P("## 4. Alt gruplarda tutarlılık (kontrollü taban üzerine ΔLL%; n ≥ " + MIN_N + " 'yeterli')");
const ADAY: [string, string][] = [["K1", "H_KILO_ETKI (β1)"], ["K3", "H_KILO_ETKI (3 terim)"], ["KR", "Kilo artığı"], ["HS", "H_SINIF_FARKI"], ["DW", "H_SIKLET_DEGISIMI"], ["DW2", "ΔW+Δhp+Δmesafe"], ["DHP", "Δhp tek başına"], ["DWHP", "ΔW+Δhp"], ["KS", "KİLO+SINIF"], ["KSD", "KİLO+SINIF+SIKLET"]];
for (const [dn, gf] of DILIMLER) { const grp = [...new Set(H1.tip.map((_, i) => gf(H1, i)))].sort(); P(`**${dn}:**`); P("| Aday | " + grp.map((g) => `${g} (n=${idxOf(H1, (i) => gf(H1, i) === g).length})`).join(" | ") + " |\n|---|" + "---|".repeat(grp.length)); for (const [id, ad] of ADAY) P(`| ${ad} | ` + grp.map((g) => { const idx = idxOf(H1, (i) => gf(H1, i) === g); if (idx.length < 40) return "—"; const x = fark(H1, "c_" + id, "cB5", idx); return `${hucre(x)}${idx.length < MIN_N ? " (yetersiz n)" : ""}`; }).join(" | ") + " |"); P(""); }
// 5. etkileşimler
P("## 5. Galop ve jokey ile etkileşim (kontrollü taban + ana etki üzerine, yalnız etkileşim terimi)");
P("Etkileşim = ana etkinin yarış-içi galop yüzdeliği (kap−0,5) veya jokey seviyesi (S − yarış ort.) ile çarpımı. Ana etki zaten modelde; ΔLL% yalnızca etkileşim terimini ölçer.");
P("| Etkileşim | ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. | B5 tabanında (kontrolsüz) ΔLL% |\n|---|---|---|---|---|---|");
for (const [ad, a, b, ba, bb] of [["Kilo × GALOP_KAPASITE", "c_K1+IWK", "c_K1", "b_K1+IWK", "b_K1"], ["Kilo × J_SEVIYE", "c_K1+IWJ", "c_K1", "b_K1+IWJ", "b_K1"], ["H_SINIF × GALOP_KAPASITE", "c_HS+IHK", "c_HS", "b_HS+IHK", "b_HS"], ["H_SINIF × J_SEVIYE", "c_HS+IHJ", "c_HS", "b_HS+IHJ", "b_HS"]] as [string, string, string, string, string][]) { const x = fark(H1, a, b, tumH), y = fark(H1, ba, bb, tumH); P(`| ${ad} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi, 1)} | ${ci(x.t3, x.t3Lo, x.t3Hi, 1)} | ${x.tut} | ${hucre(y)} |`); }
P("");
// 6. GALOP özel handikap testi
const hk2 = idxOf(H2, (i) => H2.tip[i] === "Handikap"); const tumG = idxOf(H2, () => true);
P("## 6. GALOP_KAPASITE için özel Handikap testi (Protokol 2: galop kapsamlı yarışlar)");
P(`Galop kapsamlı ${SG.length} yarışta (tüm tipler) eğitim; test yarışı ${tumG.length}, bunların **Handikap'ı ${hk2.length}**. ΔLL% = (B5 − B4) yani GALOP_KAPASITE'nin ACC+J_SEVIYE+SON6+H2H üzerine katkısı. Alt gruplarda n küçük: aralık genişse 'değersiz' değil 'doğrulanamadı' anlamına gelir.`);
P("| Dilim | n yarış | GALOP katkısı ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Kontrollü ΔLL% [%95] | Tut. |\n|---|---|---|---|---|---|---|");
const gSatir = (ad: string, idx: number[]) => { if (idx.length < 30) return; const x = fark(H2, "G1", "G0", idx), y = fark(H2, "cG1", "cG0", idx); P(`| ${ad}${idx.length < MIN_N ? " (yetersiz n)" : ""} | ${idx.length} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi, 1)} | ${ci(x.t3, x.t3Lo, x.t3Hi, 1)} | ${isaret(y.llLo, y.llHi)} ${ci(y.ll, y.llLo, y.llHi)} | ${x.tut} |`); };
gSatir("Tüm tipler", tumG); gSatir("**Handikap (tümü)**", hk2); for (const [dn, gf] of DILIMLER) { if (dn === "Zaman") continue; const grp = [...new Set(hk2.map((i) => gf(H2, i)))].sort(); for (const g of grp) gSatir(`Handikap · ${g}`, hk2.filter((i) => gf(H2, i) === g)); }
for (const t of ["Maiden", "Şartlı", "KV"]) gSatir(t + " (karşılaştırma)", idxOf(H2, (i) => H2.tip[i] === t));
P("");
P("**Kilo ve galop etkileşimi (handikap test yarışları; B5 modeli üzerine):**");
P("| Karşılaştırma | n | ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. |\n|---|---|---|---|---|---|");
for (const [ad, a, b] of [["Kilo ana etkisi (G1+W − G1)", "G1+W", "G1"], ["**Kilo × GALOP etkileşimi** (G1+W+IWK − G1+W)", "G1+W+IWK", "G1+W"], ["Kilo × J_SEVIYE (G1+W+IWJ − G1+W)", "G1+W+IWJ", "G1+W"], ["Kontrollü: kilo × GALOP", "cG1+W+IWK", "cG1+W"], ["H_SINIF × GALOP (G1+HS+IHK − G1+HS)", "G1+HS+IHK", "G1+HS"]] as [string, string, string][]) { const x = fark(H2, a, b, hk2); P(`| ${ad} | ${x.n} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi, 1)} | ${ci(x.t3, x.t3Lo, x.t3Hi, 1)} | ${x.tut} |`); }
P("");
// betimleyici 2x2
P("**Betimleyici: ağır/hafif kilo × iyi/zayıf galop** (handikap test yarışları; beklenti = GALOPSUZ model G0'ın olasılığı; z = (kazanan − ΣP)/√ΣP(1−P)). 'Ağır' = yarış medyanından fazla kilo; 'iyi galop' = GALOP_KAPASITE yüzdeliği ≥ 0,5.");
P("| Kilo | Galop | n at | Kazanan | Beklenen (G0) | z |\n|---|---|---|---|---|---|");
{ const acc = new Map<string, { y: number; p: number }[]>(); R2.probs["G0"]!.forEach((pr, j) => { const k = R2.yk[R2.test[j]!]!.k; if (k.tip !== "Handikap") return; const ws = nn(k.atlar.map((a) => a.v.Wgor ?? null)); if (ws.length < 4) return; const med = [...ws].sort((a, b) => a - b)[Math.floor(ws.length / 2)]!; k.atlar.forEach((a, i) => { if (a.v.Wgor == null) return; const wk = (a.v.Wgor as number) > med ? "ağır" : "hafif"; const gk = a.v.kap == null ? "galopsuz" : (a.v.kap as number) >= 0.5 ? "iyi galop (≥0,5)" : "zayıf galop (<0,5)"; const key = wk + "|" + gk; const arr = acc.get(key) ?? []; arr.push({ y: a.kazandi ? 1 : 0, p: pr[i]! }); acc.set(key, arr); }); });
  for (const wk of ["ağır", "hafif"]) for (const gk of ["iyi galop (≥0,5)", "zayıf galop (<0,5)", "galopsuz"]) { const h = acc.get(wk + "|" + gk) ?? []; if (h.length < 30) continue; const y = sum(h.map((x) => x.y)), p = sum(h.map((x) => x.p)); const v = sum(h.map((x) => x.p * (1 - x.p))); P(`| ${wk} | ${gk} | ${h.length} | ${y} | ${fx(p, 1)} | ${fx((y - p) / Math.sqrt(v), 2)} |`); } }
P("");
P("## Sınırlar ve dürüst notlar");
P("- **Veri:** apranti işareti yok (H_APRANTI_ETKI yapılamadı); bugünkü pist durumu çoğu handikap yarışında bilinmiyor ve çoğu 'Normal' (pist etkileşimi ölçülemez); rakiplerin geçmiş hp/sıkleti yalnız önbellekteki atlardan geliyor (kapsam kısmi); Haziran 2026 hp eksikleri sıfır sayılmadı. Handikap yarışları ~1.500; alt gruplar (özellikle H17+, uzun mesafe, Normal dışı pist) çok küçüktür.");
P("- **Kilo/hp ilişkisi mekaniktir** (TJK her handikap puanı için 0,5 kg): kilonun etkisi hp ile ayrıştırılamıyorsa 'etki var/yok' diyemeyiz. Kontrollü taban (hp dahil) ve kilo artığı bu yüzden yan yana verildi; artığın içinde yaş/mesafe indirimleri ve apranti indirimi karışıktır.");
P("- Etkileşimler doğrusal-logit içinde tek çarpım terimidir; mesafe ve zemin etkisi için bilimsel literatürün sınırlı olduğu varsayımı korunur. Çoklu karşılaştırma düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Katsayılar ölçü cihazının (ileri-yönlü β) çıktısıdır, sinyal ağırlığı kararı değildir.");
P("- GALOP için 'değersiz' veya 'değerli' hükmü verilmedi: alt gruplardaki geniş aralıklar doğrulanamadığını gösterir.");
fs.writeFileSync("HANDIKAP_ARASTIRMA_RAPORU.md", L2r.join("\n"));
console.log(`YAZILDI HANDIKAP_ARASTIRMA_RAPORU.md | ${L2r.length} satır | HK ${HK.length} | SG ${SG.length}`);
await db.$disconnect(); process.exit(0);
