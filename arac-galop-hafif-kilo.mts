/**
 * GALOP_KAPASITE × hafif kilo — ÖNCEDEN BİLDİRİLMİŞ hipotez testi (kullanıcı onayı 2026-11-18; eşikler dondurulmuş). SALT-OKUMA; aday sinyal DEĞİL; SINYAL_KAYDI boş.
 * Varsayılan: KEŞİF (hipotezin bulunduğu veri; doğrulama değil). `--after YYYY-MM-DD`: β ≤ tarih, test > tarih. Çıktı: GALOP_HAFIF_KILO_KESIF.md / GALOP_HAFIF_KILO_DOGRULAMA_<tarih>.md
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
// ───── tüm yarışlar → hücre bayrakları (HANDİKAP yarışlarında; diğerlerinde null)
const afterArg = process.argv.indexOf("--after") >= 0 ? process.argv[process.argv.indexOf("--after") + 1]! : null; const afterMs = afterArg ? Date.parse(afterArg + "T00:00:00.000Z") : null;
const ksRest = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksAll = [...new Map([...ksA, ...ksB, ...ksRest].map((k) => [k.id, k])).values()];
console.log("Özellikler (as-of)…"); const ALL = ozellikler(ksAll).sort((a, b) => a.t - b.t || (a.raceId < b.raceId ? -1 : 1));
for (const k of ALL) { if (k.tip !== "Handikap") continue; const ws = nn(k.atlar.map((a) => a.v.Wgor ?? null)); if (ws.length < 4) continue; const med = [...ws].sort((a, b) => a - b)[Math.floor(ws.length / 2)]!; for (const a of k.atlar) { const w = a.v.Wgor, g = a.v.kap; if (w == null || g == null) { a.v.HAIG = null; a.v.HAZG = null; a.v.AGIG = null; a.v.AGZG = null; continue; } const hafif = (w as number) <= med, iyi = (g as number) >= 0.5; a.v.HAIG = hafif && iyi ? 1 : 0; a.v.HAZG = hafif && !iyi ? 1 : 0; a.v.AGIG = !hafif && iyi ? 1 : 0; a.v.AGZG = !hafif && !iyi ? 1 : 0; } }
const kapliG = (k: Kosu) => k.atlar.filter((a) => a.v.kap != null).length / k.atlar.length >= 0.7; const SG = ALL.filter(kapliG); console.log(`ALL ${ALL.length}; galop kapsamlı ${SG.length}`);
const ilkT = (P_: Kosu[]) => (P_.length ? new Date(Math.min(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—"), sonT = (P_: Kosu[]) => (P_.length ? new Date(Math.max(...P_.map((k) => k.t))).toISOString().slice(0, 10) : "—");
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const BASE4: Kol[] = ["acc", "S", "S6", DEF]; const BASE5: Kol[] = ["acc", "kap", "S", "S6", DEF];
const MD: [string, Kol[]][] = [["G0", BASE4], ["G1", BASE5], ["G1H", [...BASE5, "HAIG"]], ["cG1", [...BASE5, ...KON]], ["cG1H", [...BASE5, ...KON, "HAIG"]], ["G1Hall", [...BASE5, "HAIG", "HAZG", "AGIG"]], ["G1W", [...BASE5, "Wgor"]], ["G1WH", [...BASE5, "Wgor", "HAIG"]]];
let R: Sonuc | null = null; let nEgit = 0, nTest = 0;
if (afterMs == null) { console.log("KEŞİF: galop kapsamlı tüm tipler, 6 blok ileri-yönlü; handikap test yarışlarında hücre testi…"); R = degerlendir(SG, MD, ["G0"]); }
else { const egit = SG.filter((k) => k.t <= afterMs), test = SG.filter((k) => k.t > afterMs); nEgit = egit.length; nTest = test.length; console.log(`DOĞRULAMA: eğitim ${egit.length}, test ${test.length}`); if (test.length >= 20) R = degerlendirDis(egit, test, MD, ["G0"]); }
const L2r: string[] = []; const P = (s = "") => L2r.push(s); const fx = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—"); const ci = (m: number, lo: number, hi: number, d = 2) => `${fx(m, d)} [${fx(lo, d)}; ${fx(hi, d)}]`;
const modTxt = afterMs == null ? "**KEŞİF (A/B/C dönemi; hipotez bu dönemde bulundu): NİHAİ DOĞRULAMA DEĞİLDİR; yalnız mevcut değerleri gösterir.**" : `**İLERİ-YÖNLÜ DOĞRULAMA:** β ≤ ${afterArg}; test > ${afterArg}.`;
P("# GALOP_KAPASITE × hafif kilo — önceden bildirilmiş hipotez testi (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)"); P(modTxt); P("");
P("## 0. Dondurulmuş tanım ve karar kuralı (kullanıcı onayı 2026-11-18; eşikler test sonucuna göre DEĞİŞTİRİLMEZ)");
P("- **Hücreler (yalnız Handikap yarışları):** hafif = atın göreli kilosu (W − yarış ortalaması) o yarışın göreli-kilo medyanına eşit veya altında; iyi galop = GALOP_KAPASITE yarış-içi yüzdeliği ≥ 0,50; zayıf galop < 0,50. **Ana hücre = hafif ∧ iyi galop.** Karşıt hücreler: hafif ∧ zayıf, ağır ∧ iyi, ağır ∧ zayıf. Galopsuz atlar hücrelere girmez.");
P("- **Beklenti modeli G0:** galopsuz B4 (ACC_HIZ, J_SEVIYE, SON6, H2H_NET); **B5/G1** = B4 + GALOP_KAPASITE. Örneklem: galop kapsamlı (≥%70 atında GALOP_KAPASITE) yarışlar; β yalnız önceki verilerden.");
P("- **Birlikte aranan dört koşul (hepsi sağlanmadan hipotez doğrulanmış sayılmaz):** (1) ana hücrede ≥150 at ve ≥100 handikap yarışı; (2) **z ≥ +2** (z = (kazanan − ΣP)/√ΣP(1−P), P: G0); (3) **yarış bazında (küme) bootstrap %95 aralığının alt sınırı > 0** hem hücrenin beklenti üstü kazanma farkı için hem de ana − (hafif ∧ zayıf) hücre farkı için; (4) **mevcut sinyallerin (B5/G1 ve kontrollü cG1) üzerine ek katkı:** HAIG bayrağının ΔLL% %95 aralığı sıfırın üstünde.");
P(""); P(`- Örneklem: galop kapsamlı ${SG.length} yarış (${ilkT(SG)}→${sonT(SG)}). ${afterMs == null ? "Keşif (6 blok ileri-yönlü β; handikap test yarışları dilimi)." : `Eğitim ${nEgit}, test ${nTest} (tüm tipler; handikap dilimi aşağıda).`}`); P("");
if (R == null) { P("## Sonuç"); P(`**Doğrulama için yeterli yarış yok** (${afterArg} sonrası galop kapsamlı test ${nTest}). Biriktikçe \`--after ${afterArg}\` ile yeniden çalıştırın.`); fs.writeFileSync(afterArg ? `GALOP_HAFIF_KILO_DOGRULAMA_${afterArg}.md` : "GALOP_HAFIF_KILO_KESIF.md", L2r.join("\n")); console.log("YAZILDI (doğrulama verisi yetersiz)"); await db.$disconnect(); process.exit(0); }
// handikap test yarışları
const hkIdx = R.test.map((i, j) => (R!.yk[i]!.k.tip === "Handikap" ? j : -1)).filter((j) => j >= 0);
type HR = { rid: string; y: number; p: number; cell: string };
const rows: HR[] = []; for (const j of hkIdx) { const pr = R.probs["G0"]![j]!; const k = R.yk[R.test[j]!]!.k; k.atlar.forEach((a, i) => { const cell = a.v.HAIG === 1 ? "HAIG" : a.v.HAZG === 1 ? "HAZG" : a.v.AGIG === 1 ? "AGIG" : a.v.AGZG === 1 ? "AGZG" : "yok"; rows.push({ rid: k.raceId, y: a.kazandi ? 1 : 0, p: pr[i]!, cell }); }); }
const byRace = new Map<string, HR[]>(); for (const r of rows) { const a = byRace.get(r.rid) ?? []; a.push(r); byRace.set(r.rid, a); } const rids = [...byRace.keys()];
const stat = (lst: string[], cell: string) => { let y = 0, p = 0, v = 0, n = 0; for (const id of lst) for (const r of byRace.get(id)!) if (r.cell === cell) { y += r.y; p += r.p; v += r.p * (1 - r.p); n++; } return { y, p, v, n }; };
const bootEx = (fn: (lst: string[]) => number) => { const o: number[] = []; for (let b = 0; b < 600; b++) { const lst = Array.from({ length: rids.length }, () => rids[(rnd() * rids.length) | 0]!); const x = fn(lst); if (isFinite(x)) o.push(x); } o.sort((a, b) => a - b); return [o[Math.floor(o.length * 0.025)] ?? NaN, o[Math.floor(o.length * 0.975)] ?? NaN] as [number, number]; };
const HIC = ["HAIG", "HAZG", "AGIG", "AGZG"]; const ADH: Record<string, string> = { HAIG: "hafif ∧ iyi galop (ANA)", HAZG: "hafif ∧ zayıf galop", AGIG: "ağır ∧ iyi galop", AGZG: "ağır ∧ zayıf galop" };
P(`## 1. Hücre sonuçları (handikap test yarışları: ${rids.length}; beklenti G0)`);
P("| Hücre | n at | n yarış | Kazanan | Beklenen (G0) | z | Beklenti-üstü fark/at (puan) [küme %95] |\n|---|---|---|---|---|---|---|");
const cellRes: Record<string, { n: number; nr: number; y: number; p: number; z: number; lo: number; hi: number }> = {};
for (const c of HIC) { const s = stat(rids, c); const nr = rids.filter((id) => byRace.get(id)!.some((r) => r.cell === c)).length; const z = s.v > 0 ? (s.y - s.p) / Math.sqrt(s.v) : NaN; const [lo, hi] = bootEx((l) => { const t = stat(l, c); return t.n ? (t.y - t.p) / t.n * 100 : NaN; }); cellRes[c] = { n: s.n, nr, y: s.y, p: s.p, z, lo, hi }; P(`| ${ADH[c]} | ${s.n} | ${nr} | ${s.y} | ${fx(s.p, 1)} | ${fx(z, 2)} | ${s.n ? ci((s.y - s.p) / s.n * 100, lo, hi) : "—"} |`); }
P("");
const dfn = (l: string[]) => { const a = stat(l, "HAIG"), b = stat(l, "HAZG"); return a.n && b.n ? ((a.y - a.p) / a.n - (b.y - b.p) / b.n) * 100 : NaN; }; const dOb = dfn(rids); const [dLo, dHi] = bootEx(dfn);
P(`**Ana − (hafif ∧ zayıf galop) fark (beklenti-üstü kazanma, puan/at):** ${ci(dOb, dLo, dHi)} (yarış kümesi bootstrap %95).`); P("");
// model ek katkı
const mk = (R_: Sonuc) => ({ ll: R_.ll as Record<string, number[]>, taban: R_.taban }); const Hm = mk(R); const fkm = (a: string, b: string) => { const m1n = mean(hkIdx.map((j) => Hm.taban[j]!)); const d = hkIdx.map((j) => (Hm.ll[b]![j]! - Hm.ll[a]![j]!) / m1n * 100); const [lo, hi] = boot(d); return { m: mean(d), lo, hi }; };
const e1 = fkm("G1H", "G1"), e2 = fkm("cG1H", "cG1"), e3 = fkm("G1WH", "G1W"), e4 = fkm("G1", "G0");
P("## 2. Mevcut sinyallerin üzerine ek katkı (handikap test yarışları, ΔLL%)");
P("| Karşılaştırma | ΔLL% [%95] |\n|---|---|"); P(`| HAIG bayrağı, G1 (B5) üzerine | ${ci(e1.m, e1.lo, e1.hi)} |`); P(`| HAIG bayrağı, kontrollü cG1 üzerine | ${ci(e2.m, e2.lo, e2.hi)} |`); P(`| HAIG bayrağı, G1 + göreli kilo üzerine | ${ci(e3.m, e3.lo, e3.hi)} |`); P(`| (bilgi) GALOP_KAPASITE'nin kendisi, G0 üzerine | ${ci(e4.m, e4.lo, e4.hi)} |`); P("");
const a = cellRes["HAIG"]!; const k1 = a.n >= 150 && a.nr >= 100, k2 = a.z >= 2, k3 = a.lo > 0 && dLo > 0, k4 = e1.lo > 0 && e2.lo > 0;
P("## 3. Karar kuralı (dört koşulun TAMAMI gerekir)");
P("| Koşul | Değer | Sağlandı mı |\n|---|---|---|"); P(`| (1) ana hücre ≥150 at ve ≥100 yarış | ${a.n} at / ${a.nr} yarış | ${k1 ? "EVET" : "HAYIR"} |`); P(`| (2) z ≥ +2 | ${fx(a.z, 2)} | ${k2 ? "EVET" : "HAYIR"} |`); P(`| (3) küme %95 alt sınırı > 0 (hücre ve ana−zayıf fark) | hücre alt ${fx(a.lo, 2)}; fark alt ${fx(dLo, 2)} | ${k3 ? "EVET" : "HAYIR"} |`); P(`| (4) ek ΔLL% alt sınırı > 0 (G1 ve cG1 üzerine) | alt ${fx(e1.lo, 2)} / ${fx(e2.lo, 2)} | ${k4 ? "EVET" : "HAYIR"} |`);
P(""); P(`**Sonuç: ${k1 && k2 && k3 && k4 ? "dört koşul sağlandı" : "hipotez DOĞRULANMADI (koşulların tamamı sağlanmadı)"}.** ${afterMs == null ? "Bu çalışma KEŞİF dönemidir (hipotezin bulunduğu veri); sonuç doğrulama sayılmaz, yalnız ileri-yönlü modun başlangıç değerleridir." : "Bu sonuç dondurulmuş ileri-yönlü doğrulamadır."}`);
P(""); P("## Sınırlar"); P("- Çoklu karşılaştırma düzeltilmedi; hücre tanımı keşifte bulunduğu için keşif dönemindeki sonuç iyimserdir. Eşikler (≥150 at, ≥100 yarış, z≥2, küme CI, ek ΔLL) dondurulmuştur ve test sonucuna göre değiştirilmez. Galop kapsamlı dönem Temmuz 2026'dan sonrasıdır; handikap yarışı sayısı sınırlıdır.");
fs.writeFileSync(afterArg ? `GALOP_HAFIF_KILO_DOGRULAMA_${afterArg}.md` : "GALOP_HAFIF_KILO_KESIF.md", L2r.join("\n"));
console.log(`YAZILDI ${afterArg ? "GALOP_HAFIF_KILO_DOGRULAMA_" + afterArg : "GALOP_HAFIF_KILO_KESIF"}.md | ${L2r.length} satır`);
await db.$disconnect(); process.exit(0);
