/**
 * SİNYAL EKLEME SIRASI (kullanıcı kararı 2026-11-18): ACC_HIZ → +GALOP_KAPASITE → +J_SEVIYE → +SON6 → +H2H_NET → +ANT_SEVIYE.
 * SALT-OKUMA. Üretim ağırlıklandırması DEĞİL; her yeni sinyalin öncekilerin üzerine katkısını izole eden ölçüm. Banko modeli DEĞİL. Aktif sinyal 0 kalır.
 * H2H parametreleri SEÇİLMEDİ: başlangıç H_180_3 yalnız sıralı tablo için; 9'lu ızgara duyarlılık olarak ayrı raporlanır.
 * Örneklemler: A (tekrar kullanılmış), B (daha az kullanılmış), C (A∪B dışı, held-out; ileri-yönlü DEĞİL; --after ile ileri-yönlü).
 * Çıktı: SINYAL_EKLEME_SIRASI_RAPORU.md
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

// ───── sinyal sırası ve modeller
const AD: Record<string, string> = { acc: "ACC_HIZ", kap: "GALOP_KAPASITE", S: "J_SEVIYE", S6: "SON6", H: "H2H_NET", ANT: "ANT_SEVIYE" };
const ORD = ["acc", "kap", "S", "S6", "H", "ANT"]; const kolAd = (s: string) => (s === "H" ? DEF : s); const dizi = (ids: string[]) => ids.map(kolAd);
const MD: [string, Kol[]][] = []; const ekle = (ad: string, ids: Kol[]) => MD.push([ad, ids]);
ORD.forEach((_, i) => { ekle("M" + (i + 1), dizi(ORD.slice(0, i + 1))); ekle("cM" + (i + 1), [...dizi(ORD.slice(0, i + 1)), ...KON]); });
ekle("K0", KON); ekle("acc+S6", ["acc", "S6"]);
for (const s of ORD) { const k = ORD.filter((x) => x !== s); ekle("L-" + s, dizi(k)); ekle("cL-" + s, [...dizi(k), ...KON]); }
for (const v of VARS.filter((x) => x !== "HF")) { ekle("v5_" + v, ["acc", "kap", "S", "S6", v]); ekle("v6_" + v, ["acc", "kap", "S", "S6", v, "ANT"]); }
console.log(`Modeller: ${MD.length}`);
console.log("Test A…"); const RA = degerlendir(A, MD, []);
const birA = new Set(A.map((k) => k.raceId)); const egitAB = [...A, ...B.filter((k) => !birA.has(k.raceId))].sort((a, b) => a.t - b.t);
console.log("Test B…"); const RB = degerlendir(B, MD, []); console.log("Test C (dış)…"); const RC = C.length ? degerlendirDis(egitAB, C, MD, []) : null;
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (R: Sonuc, a: string, b: string) => { const I = R.test.map((_, j) => j); const s = (x: number[]) => I.map((j) => x[j]!); return { ll: farkCI(s(R.ll[b]!), s(R.ll[a]!)), t1: farkCI(s(R.t1[a]!), s(R.t1[b]!), 100, 2), t3: farkCI(s(R.t3[a]!), s(R.t3[b]!), 100, 2) }; };
const mLL = (R: Sonuc, ad: string) => mean(R.ll[ad]!); const dBaz = (R: Sonuc, ad: string) => mean(R.taban) - mean(R.ll[ad]!);

// ───── korelasyonlar (yarış içi merkezlenmiş) ve çoklu R²
function merkez(pop: Kosu[], kols: Kol[]): { rows: number[][] } { const rows: number[][] = []; for (const k of pop) { const at = k.atlar.filter((a) => kols.every((c) => a.v[c] != null)); if (at.length < 2) continue; const mu = kols.map((c) => mean(at.map((a) => a.v[c] as number))); for (const a of at) rows.push(kols.map((c, j) => (a.v[c] as number) - mu[j]!)); } return { rows }; }
function rPar(pop: Kosu[], x: Kol, y: Kol) { const { rows } = merkez(pop, [x, y]); if (rows.length < 30) return { r: NaN, n: rows.length }; return { r: corr(rows.map((q) => q[0]!), rows.map((q) => q[1]!)), n: rows.length }; }
function r2Coklu(pop: Kosu[], onceki: Kol[], yeni: Kol) { const { rows } = merkez(pop, [...onceki, yeni]); const K = onceki.length; if (rows.length < 50 || K === 0) return { r2: NaN, n: rows.length }; const H = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0); for (const q of rows) for (let a = 0; a < K; a++) { g[a] += q[a]! * q[K]!; for (let c = 0; c < K; c++) H[a]![c] += q[a]! * q[c]!; } for (let a = 0; a < K; a++) H[a]![a] += 1e-9; const b = coz(H, g); let sse = 0, sst = 0; for (const q of rows) { const pr = sum(b.map((bk, a) => bk * q[a]!)); sse += (q[K]! - pr) ** 2; sst += q[K]! ** 2; } return { r2: 1 - sse / sst, n: rows.length }; }

// ───── RAPOR
const L2: string[] = []; const P = (s = "") => L2.push(s);
const SMP: [string, Sonuc | null, Kosu[]][] = [["A (tekrar kullanılmış; 6 blok ileri-yönlü β)", RA, A], ["B (daha az kullanılmış; 6 blok ileri-yönlü β)", RB, B], ["C (A∪B dışı, kullanılmamış; β yalnız A∪B'den; held-out, ileri-yönlü DEĞİL)", RC, C]];
P("# Sinyal ekleme sırası — ACC_HIZ → +GALOP_KAPASITE → +J_SEVIYE → +SON6 → +H2H_NET → +ANT_SEVIYE");
P("**Bu bir üretim ağırlıklandırması ve banko modeli DEĞİL; her yeni sinyalin öncekilerin üzerine katkısını izole eden ölçümdür. Aktif sinyal sayısı 0; `SINYAL_KAYDI` boş.**");
P("");
P("## 0. Düzenek, veri, doğrulama");
P("- **Ölçü cihazı (model önerisi değil):** yarış-içi softmax (koşullu logit), ridge 0,02, 6 blokluk ileri-yönlü kronolojik β (β yalnız ÖNCEKİ bloklardan); eksik değer → yarış-içi ortalama (nötr). **ΔLL = (önceki model log-loss) − (yeni model log-loss); pozitif = iyileşme.** Top1/Top3 kesirli beraberlik kredisiyle; köşeli parantez eşleştirilmiş bootstrap %95 (1000). Her aşamada TÜM modeller AYNI test yarışlarında değerlendirilir.");
P("- **Sıra sabittir** (kullanıcı kararı). 'Kontrollü' = aynı modele at-kalitesi kontrolleri eklenmiş hali (handikap puanı, son 10 kazanma oranı, son 10 ilk-3 oranı, sınıf değişimi).");
P(`- **H2H_NET parametreleri SEÇİLMEDİ.** Sıralı tablolarda başlangıç ${DEF} (yarı ömür 180 gün, λ 3, yalnız aynı yüzey, oransal mesafe) kullanıldı; bu SEÇİM DEĞİLDİR. 9'lu ızgara bölüm 6'da duyarlılık olarak verilir. ANT_SEVIYE: k=8 geçici sabit, 365 gün penceresi (öğrenilmedi).`);
P(`- **Örneklemler:** A ${A.length} yarış (${ilkT(A)}→${sonT(A)}), B ${B.length} (${ilkT(B)}→${sonT(B)}), C ${C.length} (${ilkT(C)}→${sonT(C)})${afterArg ? ` (--after ${afterArg})` : ""}. A ve B tekrar kullanılmıştır; C model kararlarında kullanılmadı ama zamanca A∪B ile iç içedir (**ileri-yönlü doğrulama değildir**). Hiçbiri bağımsız nihai doğrulama olarak sunulmaz.`);
P(`- **Gelecek-bozma testi:** H2H ızgarası ${farkli === 0 && denenen > 0 ? "GEÇTİ" : "SIZINTI VAR (" + farkli + ")"} (${denenen} at); ANTRENÖR ${aFark === 0 && aDen > 0 ? "GEÇTİ" : "SIZINTI VAR (" + aFark + ")"} (${aDen} antrenör-gün). **Bağımsız yeniden hesap:** H2H ${nOrn} örnekte ${bagH} uyuşmaz; ANTRENÖR ${aOrn} örnekte ${aBag} uyuşmaz. Diğer sinyallerin (ACC, GALOP, JOKEY, SON6) sızıntı/bağımsız testleri birim testlerinde (vitest) geçiyor.`);
P("");
P("## 1. Veri kapsamı (sinyal başına)");
P("Yarış-içi nötr doldurma nedeniyle kapsam düşükse sinyalin görünen katkısı da küçülür; kapsam bu yüzden her sinyal için verilir.");
P("| Örneklem | Sinyal | At kapsamı | Tüm atları değeri olan yarış payı |\n|---|---|---|---|");
for (const [ad, , pop] of SMP) { if (!pop.length) continue; const atlar = pop.flatMap((k) => k.atlar); for (const s of ORD) { const c = kolAd(s); const var_ = atlar.filter((a) => a.v[c] != null).length / atlar.length; const yar = pop.filter((k) => k.atlar.every((a) => a.v[c] != null)).length / pop.length; P(`| ${ad.split(" (")[0]} | ${AD[s]} | ${pct(var_)}% (${atlar.length} at) | ${pct(yar)}% |`); } }
P("");
P("## 2. Korelasyon ve örtüşme (yarış içi merkezlenmiş; havuz = örneklemdeki tüm atlar)");
P("Satır = yeni eklenen sinyal; sütunlar = öncekilerle Pearson r (yarış-içi sapmalar); **R² = yeni sinyalin, kendinden ÖNCEKİ tüm sinyallerle doğrusal olarak açıklanabilen payı** (yüksek = büyük ölçüde tekrar).");
for (const [ad, , pop] of SMP) { if (!pop.length) continue; P(`### ${ad.split(" (")[0]}`); P("| Yeni sinyal | " + ORD.slice(0, 5).map((s) => "r(" + AD[s] + ")").join(" | ") + " | R² (öncekilerle) | n at |\n|---|" + "---|".repeat(7));
  for (let i = 1; i < ORD.length; i++) { const yeni = kolAd(ORD[i]!); const onc = dizi(ORD.slice(0, i)); const cells = ORD.slice(0, 5).map((s, j) => (j < i ? f(rPar(pop, kolAd(s), yeni).r, 2) : "·")); const q = r2Coklu(pop, onc, yeni); P(`| ${AD[ORD[i]!]} | ${cells.join(" | ")} | ${f(q.r2, 3)} | ${q.n} |`); } P(""); }
const seqTablo = (on: string, etiket: string) => { for (const [ad, R] of SMP) { if (!R) { P(`**${ad}** — örneklem boş.`); continue; } P(`### ${ad} — ${etiket}`); P(`Test yarışı ${R.test.length}. Rastgele (1/N) log-loss ${f(mean(R.taban))}; Top1 ${pct(mean(R.r1))}%; Top3 ${pct(mean(R.r3))}%.`); P("| Aşama | Log-loss | ΔLL (1/N'ye göre) | **ΔLL (önceki aşamaya göre) [%95]** | Top1 | **ΔTop1 [%95]** | Top3 | **ΔTop3 [%95]** |\n|---|---|---|---|---|---|---|---|");
  const m0 = on === "c" ? "K0" : null; for (let i = 0; i < ORD.length; i++) { const ad2 = on + "M" + (i + 1); const onceki = i === 0 ? m0 : on + "M" + i; const x = onceki ? ek(R, ad2, onceki) : null; P(`| ${i + 1}. ${i === 0 ? "" : "+"}${AD[ORD[i]!]} | ${f(mLL(R, ad2))} | ${f(dBaz(R, ad2))} | ${x ? x.ll : "—"} | ${pct(mean(R.t1[ad2]!))}% | ${x ? x.t1 : "—"} | ${pct(mean(R.t3[ad2]!))}% | ${x ? x.t3 : "—"} |`); } P(""); } };
P("## 3. Sıralı ekleme — yalnız sinyaller");
P("İlk satırın 'önceki aşama' farkı yoktur (1/N'ye göre ΔLL verilmiştir).");
seqTablo("", "sinyaller");
P("## 4. Sıralı ekleme — at-kalitesi kontrolleriyle (hp, geçmiş performans, sınıf değişimi)");
P("İlk satırın karşılaştırma tabanı 'yalnız kontroller' (K0) modelidir.");
seqTablo("c", "kontrollü");
P("## 5. SON6'nın katkısı: üç bağlamda + her sinyal için 'çıkarma' testi");
P("**SON6 için (ana soru):** (a) yalnız ACC_HIZ üzerine; (b) ACC+GALOP+J_SEVIYE üzerine (sıralı 4. aşama); (c) TAM modelde (6 sinyal) SON6 çıkarılınca kaybedilen. ΔLL = geniş model − dar model.");
P("| Örneklem | (a) ACC → ACC+SON6 ΔLL [%95] | (b) ACC+GALOP+J → +SON6 ΔLL [%95] | (c) tam model: SON6 çıkarma kaybı ΔLL [%95] | (c) Top1 [%95] | (c) Top3 [%95] | (c) kontrollü ΔLL [%95] |\n|---|---|---|---|---|---|---|");
for (const [ad, R] of SMP) { if (!R) continue; const a = ek(R, "acc+S6", "M1"), b = ek(R, "M4", "M3"), c = ek(R, "M6", "L-S6"), cc = ek(R, "cM6", "cL-S6"); P(`| ${ad.split(" (")[0]} | ${a.ll} | ${b.ll} | ${c.ll} | ${c.t1} | ${c.t3} | ${cc.ll} |`); }
P("");
P("**Her sinyal için 'tam modelden çıkarma' (6 sinyalli model − o sinyalsiz model; sıradan bağımsız, ortak bilgiyi diğerlerine karşı net katkı gösterir):**");
for (const [ad, R] of SMP) { if (!R) continue; P(`### ${ad}`); P("| Çıkarılan | ΔLL [%95] | ΔTop1 [%95] | ΔTop3 [%95] | Kontrollü ΔLL [%95] | Kontrollü ΔTop1 [%95] | Kontrollü ΔTop3 [%95] |\n|---|---|---|---|---|---|---|");
  for (const s of ORD) { const x = ek(R, "M6", "L-" + s), y = ek(R, "cM6", "cL-" + s); P(`| ${AD[s]} | ${x.ll} | ${x.t1} | ${x.t3} | ${y.ll} | ${y.t1} | ${y.t3} |`); } P(""); }
P("## 6. H2H_NET parametre duyarlılığı (SEÇİM YOK; yalnız ızgara gösterilir)");
P("Her satır H2H_NET'in dört sinyalli tabana (ACC+GALOP+J+SON6) eklenmesi (5. aşama) ve ANT_SEVIYE'nin onun üzerine eklenmesi (6. aşama).");
for (const [ad, R] of SMP) { if (!R) continue; P(`### ${ad}`); P("| H2H varyantı | +H2H ΔLL [%95] | +H2H ΔTop1 [%95] | +H2H ΔTop3 [%95] | +ANT (üstüne) ΔLL [%95] |\n|---|---|---|---|---|");
  for (const v of VARS.filter((x) => x !== "HF")) { const x = ek(R, "v5_" + v, "M4"), y = ek(R, "v6_" + v, "v5_" + v); P(`| ${v} | ${x.ll} | ${x.t1} | ${x.t3} | ${y.ll} |`); } P(""); }
P("## Sınırlar ve dürüst notlar");
P("- ΔLL'ler yalnız aynı örneklem ve aynı tabanda karşılaştırılabilir. A ve B tekrar kullanıldığı için bu örneklemlerdeki aralıklar iyimser olabilir; C held-out'tur ama ileri-yönlü değildir. Gerçek ileri-yönlü doğrulama için `--after <tarih>`.");
P("- Çok sayıda karşılaştırma yapılmıştır (aşama × örneklem × ölçüt × varyant); düzeltme uygulanmadı. Tek bir hücredeki anlamlılık kanıt sayılmamalı; örneklemler arası tutarlılığa bakın.");
P("- 'Çıkarma' testi sıradan bağımsızdır ama doğrusal-logit varsayımına bağlıdır; doğrusal olmayan etkileşimleri ve ölçek seçimlerini (bölme sabitleri SK) ölçmez. Bu sabitler öğrenilmedi, ridge 0,02 ile tek tip kullanıldı.");
P("- Kapsam kısmi olan sinyallerde (H2H: önbellekteki atlar; ANT: ilk günlerde pencere dolmadığı için; SON6: ≥30 referans) yarış-içi nötr doldurma katkıyı bastırır; bölüm 1'e bakın.");
P("- Piyasa/AGF ile kıyas YAPILMAMIŞTIR; banko ayrıştırması bu raporun konusu değildir.");
fs.writeFileSync("SINYAL_EKLEME_SIRASI_RAPORU.md", L2.join("\n"));
console.log(`YAZILDI SINYAL_EKLEME_SIRASI_RAPORU.md | ${L2.length} satır | H2H sızıntı ${farkli === 0 ? "YOK" : "VAR"} | ANT sızıntı ${aFark === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan H2H ${bagH} ANT ${aBag}`);
await db.$disconnect(); process.exit(0);
