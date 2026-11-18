/**
 * DELTA_HP araştırması (kullanıcı kararı 2026-11-18): Handikap yarışları için ayrı aday; ΔHP = HP_bugün − HP_önceki_yarış. SALT-OKUMA; aktif sinyal DEĞİL; SINYAL_KAYDI boş.
 * Varsayılan: KEŞİF (A/B/C dönemi, nihai doğrulama DEĞİL). `--after YYYY-MM-DD`: parametreler dondurulmuş, β yalnız ≤ tarih handikap yarışlarından, test yalnız > tarih (ileri-yönlü doğrulama).
 * Çıktı: DELTA_HP_KESIF_RAPORU.md  veya  DELTA_HP_DOGRULAMA_<tarih>.md
 */
import { deltaHp, deltaHpSonBilinen, deltaHpYonlu, deltaHpSinif } from "./src/lib/methodology/yeni-motor/adaylar/delta-hp-aday";
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
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true, surfaceConditions: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, name: true, tjkAtId: true, jockey: true, trainer: true, hp: true, weight: true } } };
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
          v.dWr = Wgor != null && pastWg.length ? Wgor - mean(pastWg) : null; v.dWa = W != null && pastW.length ? W - mean(pastW) : null; v.dHP = hpv != null && pastHp.length ? hpv - mean(pastHp) : null; v.dD = pastD.length ? Math.log(k.distance / mean(pastD)) : null; v.HSn = pastRiv.length; v.dWn = pastWg.length;
          // ÖNBELLEK SATIRININ hp'si o yarıştan SONRA atanan puandır (doğrulandı: Runner.hp(yarış k) = önceki satırın hp'si, %99); o yarışa TAŞINAN puan = bir önceki satırın hp'si
          const hg = onceki.map((x, j) => ({ tarih: x.t, hp: j > 0 ? onceki[j - 1]!.hp : null })); 
          const d1 = deltaHp(hpv, hg, t), dlk = deltaHpSonBilinen(hpv, hg, t); const yy = deltaHpYonlu(d1.delta); const sk = deltaHpSinif(d1.delta);
          v.dHP1 = d1.delta; v.dHP1pos = yy.pos; v.dHP1neg = yy.neg; v.dHPlk = dlk.delta; v.dHP1gun = d1.gunAra; v.dB0 = sk == null ? null : sk === 0 ? 1 : 0; v.dB1 = sk == null ? null : sk === 1 ? 1 : 0; v.dB3 = sk == null ? null : sk === 3 ? 1 : 0; v.dB4 = sk == null ? null : sk === 4 ? 1 : 0;
          const sonK = onceki.length ? onceki[onceki.length - 1]! : null; v.sonFp = sonK?.fp ?? null; v.sonWin = sonK?.fp != null ? (sonK.fp === 1 ? 1 : 0) : null; v.sonTop3 = sonK?.fp != null ? (sonK.fp <= 3 ? 1 : 0) : null; }
        return { raceId: k.id, no: r.no, kazandi: win.has(r.no), v, hn: hs ? hs[hi]!.nRakip : 0, hToplam: hs ? hs[hi]!.toplamRakip : 0, s6n: d?.guven.kullanilan ?? 0, s6Gun: d?.guven.sonYarisGun ?? null }; }) }); } }
  return out;
}
function hkEtkilesim(pop: Kosu[]) { for (const k of pop) { if (k.tip !== "Handikap") continue; const sv = nn(k.atlar.map((a) => a.v.S)); const sm = sv.length ? mean(sv) : null; for (const a of k.atlar) { const kc = a.v.kap == null ? null : (a.v.kap as number) - 0.5; const sc = a.v.S == null || sm == null ? null : ((a.v.S as number) - sm) / 0.1; const Wg = a.v.Wgor ?? null, hs = a.v.HS ?? null; a.v.IWK = Wg == null || kc == null ? null : Wg * kc; a.v.IWJ = Wg == null || sc == null ? null : Wg * sc; a.v.IHK = hs == null || kc == null ? null : hs * kc; a.v.IHJ = hs == null || sc == null ? null : hs * sc; } } }
// ───── ölçü cihazı
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1, ANT: 0.1, Wgor: 3, WgD: 1, WgZ: 3, Wres: 2, HS: 10, dWr: 3, dWa: 3, dHP: 5, dD: 0.3, IWK: 2, IWJ: 3, IHK: 5, IHJ: 10, dHP1: 3, dHP1pos: 3, dHP1neg: 3, dHPlk: 3, dB0: 1, dB1: 1, dB3: 1, dB4: 1 } as Record<string, number>)[c] ?? 0.3;
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

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))] ?? NaN; };
// ───── tüm yarışlar → handikap alt kümesi
const afterArg = process.argv.indexOf("--after") >= 0 ? process.argv[process.argv.indexOf("--after") + 1]! : null; const afterMs = afterArg ? Date.parse(afterArg + "T00:00:00.000Z") : null;
const ksRest = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksAll = [...new Map([...ksA, ...ksB, ...ksRest].map((k) => [k.id, k])).values()];
console.log("Özellikler (as-of)…"); const ALL = ozellikler(ksAll).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
const HK = ALL.filter((k) => k.tip === "Handikap"); console.log(`ALL ${ALL.length}; Handikap ${HK.length}`);
const ilkT = (P_: Kosu[]) => (P_.length ? new Date(Math.min(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P_: Kosu[]) => (P_.length ? new Date(Math.max(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—");

// ───── Runner.hp = yarış-zamanı hp mi? (önbellekteki aynı yarış satırıyla karşılaştırma)
let pvN = 0, pvEq = 0, pvN2 = 0, pvEq2 = 0; const pvFark: number[] = []; for (const k of ksAll) { if (kabaG(normalizeClassType(k.classType)) !== "Handikap") continue; const tk = dayMs(k.raceDay.date); const city = k.raceDay.hippodrome.name.trim().toLocaleUpperCase("tr"); const part = yarisAt.get(city + "|" + tk + "|" + String(k.raceNo)); for (const r of k.runners) { if (r.tjkAtId == null || r.hp == null) continue; const rows = (gecmis.get(r.tjkAtId) ?? []).filter((x) => x.t < tk); const prev = rows.length ? rows[rows.length - 1]! : null; if (prev && prev.hp != null) { pvN++; if (prev.hp === r.hp) pvEq++; else pvFark.push(r.hp - prev.hp); } const c = part?.find((q) => q.atId === r.tjkAtId); if (c && c.hp != null) { pvN2++; if (c.hp === r.hp) pvEq2++; } } }

// ───── modeller (hepsi Handikap yarışlarında; ΔHP v1 = kullanıcı tanımı, diğerleri ÖNCEDEN BİLDİRİLMİŞ duyarlılıklar)
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const B5: Kol[] = ["acc", "kap", "S", "S6", DEF]; const cB5: Kol[] = [...B5, ...KON];
const SETS: Record<string, { k: Kol[]; ad: string }> = { D1: { k: ["dHP1"], ad: "**ΔHP v1** (HP_bugün − önceki yarışın HP'si)" }, Dlk: { k: ["dHPlk"], ad: "ΔHP son BİLİNEN HP'ye göre (duyarlılık)" }, D3: { k: ["dHP"], ad: "Δhp son 3 yarış ortalamasına göre (önceki testteki tanım)" }, Dpm: { k: ["dHP1pos", "dHP1neg"], ad: "ΔHP yükseliş / düşüş AYRI eğim" }, Dbin: { k: ["dB0", "dB1", "dB3", "dB4"], ad: "ΔHP beş sabit sınıf (≤−3 / −2…−1 / 0 / +1…+2 / ≥+3)" } };
const MD: [string, Kol[]][] = [["B5", B5], ["cB5", cB5]]; for (const [id, s] of Object.entries(SETS)) { MD.push(["a_" + id, s.k]); MD.push(["b_" + id, [...B5, ...s.k]]); MD.push(["c_" + id, [...cB5, ...s.k]]); }
MD.push(["cR", [...cB5, "sonWin", "sonTop3"]], ["cRD", [...cB5, "sonWin", "sonTop3", "dHP1"]], ["cRDpm", [...cB5, "sonWin", "sonTop3", "dHP1pos", "dHP1neg"]]);
let R: Sonuc | null = null; let nEgit = 0, nTest = 0;
if (afterMs == null) { console.log(`KEŞİF: Handikap-only 6 blok ileri-yönlü (${MD.length} model)…`); R = degerlendir(HK, MD, ["B5", "cB5"]); nTest = R.test.length; nEgit = HK.length - nTest; }
else { const egit = HK.filter((k) => k.t <= afterMs), test = HK.filter((k) => k.t > afterMs); nEgit = egit.length; nTest = test.length; console.log(`DOĞRULAMA: eğitim ${egit.length} (≤${afterArg}), test ${test.length} (>${afterArg})`); if (test.length >= 20) R = degerlendirDis(egit, test, MD, ["B5", "cB5"]); }

const L2r: string[] = []; const P = (s = "") => L2r.push(s);
const mk = (R_: Sonuc) => ({ R: R_, ll: { ...R_.ll, "1N": R_.taban } as Record<string, number[]>, t1: { ...R_.t1, "1N": R_.r1 } as Record<string, number[]>, t3: { ...R_.t3, "1N": R_.r3 } as Record<string, number[]>, taban: R_.taban, tip: R_.test.map((i) => R_.yk[i]!.k.tip), sn: R_.test.map((i) => R_.yk[i]!.k.sn), dist: R_.test.map((i) => R_.yk[i]!.k.dist), zp: R_.test.map((i) => R_.yk[i]!.k.zp), N: R_.test.map((i) => R_.yk[i]!.k.atlar.length), yari: R_.test.map((_, j) => (j < R_.test.length / 2 ? 0 : 1)) });
type HH = ReturnType<typeof mk>; const idxOf = (h: HH, f2: (i: number) => boolean) => h.tip.map((_, i) => (f2(i) ? i : -1)).filter((i) => i >= 0); const MIN_N = 150;
type Fark = { n: number; ll: number; llLo: number; llHi: number; t1: number; t1Lo: number; t1Hi: number; t3: number; t3Lo: number; t3Hi: number; tut: string };
function fark(h: HH, a: string, b: string, idx: number[]): Fark { const m1n = mean(idx.map((i) => h.taban[i]!)); const dl = idx.map((i) => (h.ll[b]![i]! - h.ll[a]![i]!) / m1n * 100), d1 = idx.map((i) => (h.t1[a]![i]! - h.t1[b]![i]!) * 100), d3 = idx.map((i) => (h.t3[a]![i]! - h.t3[b]![i]!) * 100); const [l0, l1] = boot(dl), [a0, a1] = boot(d1), [c0, c1] = boot(d3); const tut = [0, 1].map((y) => { const q = idx.filter((i) => h.yari[i] === y); return q.length < 30 ? "·" : mean(q.map((i) => h.ll[b]![i]! - h.ll[a]![i]!)) > 0 ? "+" : "−"; }).join(""); return { n: idx.length, ll: mean(dl), llLo: l0, llHi: l1, t1: mean(d1), t1Lo: a0, t1Hi: a1, t3: mean(d3), t3Lo: c0, t3Hi: c1, tut }; }
const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`; const isaret = (lo: number, hi: number) => (lo > 0 ? "✓" : hi < 0 ? "✗" : "○"); const hucre = (x: Fark) => `${isaret(x.llLo, x.llHi)} ${fx(x.ll)}% (${x.tut})`;
const seviye = (h: HH, ad: string, idx: number[]) => { const m1 = mean(idx.map((i) => h.taban[i]!)); return { ll: (m1 - mean(idx.map((i) => h.ll[ad]![i]!))) / m1 * 100, t1: mean(idx.map((i) => h.t1[ad]![i]!)) * 100, t3: mean(idx.map((i) => h.t3[ad]![i]!)) * 100 }; };
function merkez(pop: Kosu[], kols: Kol[]): number[][] { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return rows; }
const rPar = (pop: Kosu[], x: Kol, y: Kol) => { const rows = merkez(pop, [x, y]); return rows.length < 30 ? NaN : corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)); };
function r2(pop: Kosu[], onceki: Kol[], yeni: Kol) { const rows = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50) return NaN; const Hh = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) Hh[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) Hh[a]![a] += 1e-9; const b = coz(Hh, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return 1 - sse / sst; }
const sinifGrp = (sn: number | null) => (sn == null ? "?" : sn <= 14 ? "H13–14" : sn <= 16 ? "H15–16" : "H17+"); const mesBand = (d: number) => (d <= 1300 ? "kısa (≤1300)" : d <= 1900 ? "orta (1400–1900)" : "uzun (≥2000)"); const sahaGrp = (n: number) => (n <= 9 ? "saha ≤9" : "saha ≥10");

const modTxt = afterMs == null ? "**KEŞİF (A/B/C dönemi, tekrar kullanıldı): NİHAİ DOĞRULAMA DEĞİLDİR.**" : `**İLERİ-YÖNLÜ DOĞRULAMA:** parametreler dondurulmuştur; β yalnız ≤ ${afterArg} handikap yarışlarından, test yalnız > ${afterArg} yarışlarında.`;
P("# DELTA_HP — Handikap yarışları için aday sinyal araştırması (aktif sinyal DEĞİL; `SINYAL_KAYDI` boş)");
P(modTxt);
P("");
P("## 0. Tanım ve dondurulan düzenek");
P("- **ΔHP v1 = HP_bugün − HP_önceki_yarış** (kullanıcı tanımı). HP_bugün programda ilan edilen puan; HP_önceki, atın hedef gününden KESİN önceki en son yarışındaki puan. **Önceki yarışın HP'si yoksa NULL** (eski bir yarışa sessizce geri gidilmez, sıfır sayılmaz). Pozitif ΔHP otomatik avantaj değildir. **Yalnız Handikap yarışlarında değerlendirilir.**");
P("- **Önceden bildirilmiş duyarlılıklar (hiçbiri seçilmedi):** ΔHP son BİLİNEN HP'ye göre; Δhp son 3 satır (yarış-sonrası puan) ortalamasına göre (önceki raporun tanımı; hizalama farklıdır); yükseliş/düşüş ayrı eğim; beş sabit sınıf (≤−3 / −2…−1 / 0 / +1…+2 / ≥+3 puan; 0 referans). Sonuçlara göre yeni formül seçilmedi.");
P("- **Taban B5:** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3). **Kontrollü taban cB5:** B5 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi. Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap 1000]; ✓/○/✗ aralık sıfırın üstünde/içinde/altında; (+/−) test yarışlarının 1./2. yarısında ΔLL işareti.");
P(`- **Örneklem:** ${HK.length} handikap yarışı (${ilkT(HK)}→${sonT(HK)}). ${afterMs == null ? `Keşif: 6 blok ileri-yönlü β; test ${nTest} yarış.` : `Eğitim ${nEgit}, **doğrulama testi ${nTest}** yarış.`}`);
P(`- **Giriş verisi kaynağı denetimi (kritik):** Runner.hp (programdaki puan) ile atın BİR ÖNCEKİ önbellek satırının hp'si ${pvN} at-yarışta **%${pct(pvEq / Math.max(1, pvN))} aynı**${pvFark.length ? ` (farklı ${pvFark.length}; fark medyanı ${f([...pvFark].sort((a, b) => a - b)[Math.floor(pvFark.length / 2)] ?? NaN, 1)})` : ""}; AYNI yarışın önbellek satırıyla ise yalnız %${pct(pvEq2 / Math.max(1, pvN2))} (n=${pvN2}). **Sonuç: önbellek satırındaki hp, o yarıştan SONRA atanan puandır; yarışa taşınan puan bir önceki satırın hp'sidir.** Bu yüzden her kayıtta yarış-zamanı HP = bir önceki satırın hp'si alınmıştır. (İlk çalıştırmada bu hizalama yapılmamıştı: ΔHP %99,2 sıfır çıkmıştı; o sonuç geçersizdir ve atılmıştır.) Yarışa taşınan puan ve bugünkü puan, hedef yarıştan önce bilinir (as-of).`);
P("- Birim testleri: `delta-hp-aday.test.ts` (formül, NULL kuralı, as-of, gelecek-bozma/sızıntı, bağımsız düz-döngü, saflık) vitest'te geçiyor.");
P("");
// 1. kapsam ve dağılım
const at1 = HK.flatMap((k) => k.atlar); const d1v = nn(at1.map((a) => a.v.dHP1 ?? null)); const gunv = nn(at1.map((a) => a.v.dHP1gun ?? null));
P("## 1. Kapsam ve dağılım");
P(`- ΔHP v1 olan at: ${pct(d1v.length / at1.length)}%; son BİLİNEN HP'ye göre ${pct(nn(at1.map((a) => a.v.dHPlk ?? null)).length / at1.length)}%; 3 yarış ortalamasına göre ${pct(nn(at1.map((a) => a.v.dHP ?? null)).length / at1.length)}%. Bugünkü hp yok: ${pct(at1.filter((a) => a.v.hp == null).length / at1.length)}%.`);
P(`- Dağılım (puan): p05 ${f(q(d1v, 0.05), 0)}, p25 ${f(q(d1v, 0.25), 0)}, medyan ${f(q(d1v, 0.5), 0)}, p75 ${f(q(d1v, 0.75), 0)}, p95 ${f(q(d1v, 0.95), 0)}. Değişmeyen (0): %${f(d1v.filter((x) => x === 0).length / d1v.length * 100, 1)}; yükselen: %${f(d1v.filter((x) => x > 0).length / d1v.length * 100, 1)}; düşen: %${f(d1v.filter((x) => x < 0).length / d1v.length * 100, 1)}. Önceki yarışla arası medyan ${f(q(gunv, 0.5), 0)} gün.`);
P("");
// 2. korelasyon ve R²
P("## 2. Örtüşme: ΔHP mevcut sinyallerle ve geçmiş formla");
P("Yarış içi merkezlenmiş Pearson r; **R² = ΔHP'nin listelenen değişkenlerle doğrusal açıklanabilen payı.**");
P("| Değişken | r(ΔHP v1) |\n|---|---|"); for (const [ad, c] of [["SON6", "S6"], ["ACC_HIZ", "acc"], ["J_SEVIYE", "S"], ["H2H_NET", DEF], ["GALOP_KAPASITE", "kap"], ["hp (bugünkü puan)", "hp"], ["son 10 yarış kazanma oranı", "win"], ["son 10 yarış ilk-3 oranı", "top3"], ["sınıf değişimi", "sinif"], ["önceki yarışta kazandı (0/1)", "sonWin"], ["önceki yarışta ilk 3 (0/1)", "sonTop3"], ["önceki yarış bitiş sırası", "sonFp"], ["göreli kilo (W_göreli)", "Wgor"], ["ΔW göreli", "dWr"], ["Δhp (3 yarış ort.)", "dHP"]] as [string, string][]) P(`| ${ad} | ${f(rPar(HK, c, "dHP1"), 2)} |`);
P(""); P(`**R²:** B5'in beş sinyaliyle ${f(r2(HK, B5, "dHP1"), 3)}; B5 + kontrollerle (hp, form, sınıf) ${f(r2(HK, cB5, "dHP1"), 3)}; yalnız SON6+ACC_HIZ+J_SEVIYE ile ${f(r2(HK, ["S6", "acc", "S"], "dHP1"), 3)}.`);
P("");
P("**Önceki yarıştaki sonuca göre ortalama ΔHP** (ΔHP'nin 'form göstergesi' olup olmadığını görmek için):"); P("| Önceki yarış | n at | Ort. ΔHP | Medyan |\n|---|---|---|---|");
for (const [ad, g] of [["kazandı", (a: At) => a.v.sonFp === 1], ["2.–3.", (a: At) => a.v.sonFp != null && (a.v.sonFp as number) >= 2 && (a.v.sonFp as number) <= 3], ["4. ve sonrası", (a: At) => a.v.sonFp != null && (a.v.sonFp as number) >= 4]] as [string, (a: At) => boolean][]) { const v = nn(at1.filter((a) => g(a)).map((a) => a.v.dHP1 ?? null)); P(`| ${ad} | ${v.length} | ${f(mean(v), 2)} | ${f(q(v, 0.5), 1)} |`); }
P("");
if (R == null) { P("## Sonuç"); P(`**Doğrulama testi için yeterli yarış yok:** ${afterArg} sonrası ${nTest} handikap yarışı (alt sınır 20; anlamlı sonuç için en az 300 önerilir). Aracı biriktikçe aynı komutla yeniden çalıştırın: \`node --env-file=.env node_modules/tsx/dist/cli.mjs arac-delta-hp.mts --after ${afterArg}\`.`); fs.writeFileSync(afterArg ? `DELTA_HP_DOGRULAMA_${afterArg}.md` : "DELTA_HP_KESIF_RAPORU.md", L2r.join("\n")); console.log(`YAZILDI (doğrulama verisi yetersiz: ${nTest})`); await db.$disconnect(); process.exit(0); }
const H = mk(R); const tumH = idxOf(H, () => true);
// 3. ek katkı
P("## 3. Beş sinyalli taban üzerine ek katkı (yalnız Handikap yarışları)");
P(`Test yarışı ${tumH.length}. B5: kazanç ${fx(seviye(H, "B5", tumH).ll)}%, Top1 ${fx(seviye(H, "B5", tumH).t1, 1)}%, Top3 ${fx(seviye(H, "B5", tumH).t3, 1)}%; kontrollü cB5: ${fx(seviye(H, "cB5", tumH).ll)}%.`);
P("| Aday | Tek başına ΔLL% | **B5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | **cB5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | Tut. |\n|---|---|---|---|---|---|---|---|---|");
for (const [id, s] of Object.entries(SETS)) { const a = fark(H, "a_" + id, "1N", tumH), b = fark(H, "b_" + id, "B5", tumH), c = fark(H, "c_" + id, "cB5", tumH); P(`| ${s.ad} | ${hucre(a)} | ${isaret(b.llLo, b.llHi)} ${ci(b.ll, b.llLo, b.llHi)} | ${ci(b.t1, b.t1Lo, b.t1Hi, 1)} | ${ci(b.t3, b.t3Lo, b.t3Hi, 1)} | ${isaret(c.llLo, c.llHi)} ${ci(c.ll, c.llLo, c.llHi)} | ${ci(c.t1, c.t1Lo, c.t1Hi, 1)} | ${ci(c.t3, c.t3Lo, c.t3Hi, 1)} | ${c.tut} |`); }
P("");
P("**Yükseliş ve düşüş ayrı eğimle mi, tek doğrusal terimle mi?** (ΔLL%, ayrı − tek):"); { const x = fark(H, "b_Dpm", "b_D1", tumH), y = fark(H, "c_Dpm", "c_D1", tumH), z = fark(H, "b_Dbin", "b_D1", tumH), w = fark(H, "c_Dbin", "c_D1", tumH); P(`| Karşılaştırma | B5 üzerine ΔLL% [%95] | cB5 üzerine ΔLL% [%95] |\n|---|---|---|\n| Ayrı eğim − tek terim | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${isaret(y.llLo, y.llHi)} ${ci(y.ll, y.llLo, y.llHi)} |\n| Beş sınıf − tek terim | ${isaret(z.llLo, z.llHi)} ${ci(z.ll, z.llLo, z.llHi)} | ${isaret(w.llLo, w.llHi)} ${ci(w.ll, w.llLo, w.llHi)} |`); }
P("");
// 4. alt gruplar
P("**ÖNCEKİ YARIŞ SONUCUNA göre kontrollü ek test (kritik):** ΔHP büyük ölçüde 'önceki yarışı kazandı mı' bilgisini taşıyor (bölüm 2). cR = cB5 + önceki yarışta kazandı (0/1) + önceki yarışta ilk 3 (0/1). Aşağıda ΔHP'nin BU bilgiler modeldeyken ek katkısı:");
P("| Dilim | cR üzerine ΔHP tek terim ΔLL% [%95] | ΔTop1 p | ΔTop3 p | cR üzerine yükseliş/düşüş ayrı ΔLL% [%95] | Tut. |\n|---|---|---|---|---|---|");
for (const [ad, idx] of [["Handikap (tümü)", tumH], ["H15–16", idxOf(H, (i) => sinifGrp(H.sn[i]!) === "H15–16")]] as [string, number[]][]) { const x = fark(H, "cRD", "cR", idx), y = fark(H, "cRDpm", "cR", idx); P(`| ${ad} | ${isaret(x.llLo, x.llHi)} ${ci(x.ll, x.llLo, x.llHi)} | ${ci(x.t1, x.t1Lo, x.t1Hi, 1)} | ${ci(x.t3, x.t3Lo, x.t3Hi, 1)} | ${isaret(y.llLo, y.llHi)} ${ci(y.ll, y.llLo, y.llHi)} | ${x.tut} |`); }
P(`(cR'nin cB5 üzerine katkısı: ${hucre(fark(H, "cR", "cB5", tumH))}.)`);
P("");
P("## 4. Alt gruplar (ΔHP v1, ΔLL%; H15–16 ayrıca; n ≥ " + MIN_N + " 'yeterli')");
const DIL: [string, (i: number) => string][] = [["Handikap sınıfı", (i) => sinifGrp(H.sn[i]!)], ["Mesafe", (i) => mesBand(H.dist[i]!)], ["Saha büyüklüğü", (i) => sahaGrp(H.N[i]!)], ["Zaman", (i) => (H.yari[i] === 0 ? "test 1. yarı" : "test 2. yarı")]];
P("| Dilim | n yarış | B5 üzerine ΔLL% [%95] | ΔTop1 p | ΔTop3 p | cB5 üzerine ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. |\n|---|---|---|---|---|---|---|---|---|");
const satir = (ad: string, idx: number[]) => { if (idx.length < 40) return; const b = fark(H, "b_D1", "B5", idx), c = fark(H, "c_D1", "cB5", idx); P(`| ${ad}${idx.length < MIN_N ? " (yetersiz n)" : ""} | ${idx.length} | ${isaret(b.llLo, b.llHi)} ${ci(b.ll, b.llLo, b.llHi)} | ${ci(b.t1, b.t1Lo, b.t1Hi, 1)} | ${ci(b.t3, b.t3Lo, b.t3Hi, 1)} | ${isaret(c.llLo, c.llHi)} ${ci(c.ll, c.llLo, c.llHi)} | ${ci(c.t1, c.t1Lo, c.t1Hi, 1)} | ${ci(c.t3, c.t3Lo, c.t3Hi, 1)} | ${c.tut} |`); };
satir("Handikap (tümü)", tumH); satir("**H15–16**", idxOf(H, (i) => sinifGrp(H.sn[i]!) === "H15–16")); for (const [dn, gf] of DIL) { const grp = [...new Set(tumH.map((i) => gf(i)))].sort(); for (const g of grp) { if (dn === "Handikap sınıfı" && g === "H15–16") continue; satir(`${dn}: ${g}`, idxOf(H, (i) => gf(i) === g)); } }
P("");
// 5. betimleyici doğrusal olmayan
P("## 5. ΔHP sınıflarına göre kazanma (beklenti: ΔHP'siz model; ileri-yönlü β, test yarışları)");
P("z = (kazanan − ΣP)/√ΣP(1−P). ΔHP, tabanın ötesinde bilgi taşıyorsa yükselenlerde/düşenlerde sistematik z ≠ 0 beklenir. Çok sayıda hücre var, düzeltme yok. Yükseliş ve düşüşün aynı yönde mi ters yönde mi etki ettiği buradan okunur; **formül seçmek için kullanılmadı.**");
const SINIFAD = ["≤ −3", "−2…−1", "0 (değişmedi)", "+1…+2", "≥ +3", "ΔHP yok"]; const zt = (ad: string, f2: (k: Kosu) => boolean) => { P(`**${ad}**`); P("| ΔHP sınıfı | n at | Kazanan | Beklenen B5 | z (B5) | Beklenen cB5 | z (cB5) |\n|---|---|---|---|---|---|---|"); const m = SINIFAD.map(() => ({ y: 0, p1: 0, p2: 0, v1: 0, v2: 0, n: 0 })); R!.probs["B5"]!.forEach((pr, j) => { const k = R!.yk[R!.test[j]!]!.k; if (!f2(k)) return; const pr2 = R!.probs["cB5"]![j]!; k.atlar.forEach((a, i) => { const s = deltaHpSinif((a.v.dHP1 ?? null) as number | null); const c = m[s == null ? 5 : s]!; c.n++; c.y += a.kazandi ? 1 : 0; c.p1 += pr[i]!; c.v1 += pr[i]! * (1 - pr[i]!); c.p2 += pr2[i]!; c.v2 += pr2[i]! * (1 - pr2[i]!); }); }); m.forEach((c, i) => { if (c.n < 30) return; P(`| ${SINIFAD[i]} | ${c.n} | ${c.y} | ${fx(c.p1, 1)} | ${fx((c.y - c.p1) / Math.sqrt(c.v1), 2)} | ${fx(c.p2, 1)} | ${fx((c.y - c.p2) / Math.sqrt(c.v2), 2)} |`); }); P(""); };
zt("Tüm handikap test yarışları", () => true); zt("H15–16", (k) => sinifGrp(k.sn) === "H15–16");
P("## Sınırlar ve dürüst notlar");
P("- " + (afterMs == null ? "**Keşif sonucudur.** Bu dönem (A/B/C) daha önce kullanıldığı için sonuçlar nihai doğrulama sayılmaz; parametreler ve yöntem dondurulmuştur, sonraki yarışlarla `--after` modunda kronolojik doğrulama yapılacaktır." : "Doğrulama örneklemi küçükse aralıklar geniş kalır; çoklu karşılaştırma düzeltilmedi."));
P("- ΔHP'nin yönü yorumlanmadı: yükseliş yakın dönem başarısını, düşüş daha uygun bir seviyeye gelmeyi gösterebilir; bu test nedensel yorum yapmaz. ΔHP SON6, geçmiş form ve hp ile örtüşebilir (bölüm 2); özgün katkı yalnız bölüm 3'teki cB5 üzerine satırlarından okunmalıdır.");
P("- Ölçü cihazı doğrusal-logit; ΔHP'nin hp düzeyiyle (örn. üst gruptaki atlar) etkileşimi ölçülmedi. H_APRANTI_ETKI, kilo artığı ve diğer handikap adayları bu raporun konusu değildir.");
fs.writeFileSync(afterArg ? `DELTA_HP_DOGRULAMA_${afterArg}.md` : "DELTA_HP_KESIF_RAPORU.md", L2r.join("\n"));
console.log(`YAZILDI ${afterArg ? "DELTA_HP_DOGRULAMA_" + afterArg : "DELTA_HP_KESIF_RAPORU"}.md | ${L2r.length} satır | HK ${HK.length}`);
await db.$disconnect(); process.exit(0);
