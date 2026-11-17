/**
 * H2H_NET — BANKO araştırması (kullanıcı kararı 2026-11-18). SALT-OKUMA. Sinyal/ağırlık SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Taban DONDURULDU: ACC_HIZ + GALOP_KAPASITE + J_SEVIYE + SON6. H2H parametreleri (yarı ömür 90/180/365 × λ 1/3/5; ana hesap yalnız AYNI yüzey, oransal mesafe benzerliği) SABİTLENMEZ: tüm ızgara raporlanır, seçim yapılmaz.
 * Örneklemler: A (tekrar kullanılmış), B (daha az kullanılmış), C = A∪B dışındaki tüm sonuçlanmış yarışlar (model kararlarında HİÇ kullanılmadı; β yalnız A∪B'den eğitilir) — C elde tutulan (held-out) örneklemdir, İLERİ-YÖNLÜ DEĞİLDİR.
 * `--after YYYY-MM-DD`: C yalnız o tarihten SONRAKİ yarışlarla sınırlanır (gerçek ileri-yönlü doğrulama için, tanım dondurulduktan sonra çalıştırın).
 * Çıktı: H2H_BANKO_RAPORU.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "./src/lib/methodology/yeni-motor/adaylar/jokey-aday";
import { DERECE_GUN_MS, DERECE_SABITLERI, DereceDeposu, dereceBilesenleri, type DereceKaydi } from "./src/lib/methodology/yeni-motor/adaylar/derece-aday";
import { H2H_VARSAYILAN, H2HDeposu, h2hNetCoklu, h2hNet, type H2HKayit, type H2HPar } from "./src/lib/methodology/yeni-motor/adaylar/h2h-aday";

const TOL = 1e-9; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const SINIF_RANK: Record<string, number> = { Maiden: 1, "Şartlı": 2, "Satış": 2, Handikap: 3, KV: 3, Grup: 4 };
const jn = (j: string | null) => (j ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
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
const sec = { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true, ganyan: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, name: true, tjkAtId: true, jockey: true, hp: true } } };
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
const rr = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
const jDep = new JokeyDeposu(rr.filter((r) => jn(r.jockey)).map((r): BinisKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: null })));


// ───── özellikler: taban (ACC, GALOP, J_SEVIYE, SON6) + kontroller + H2H ızgarası
type Kol = string; const GRID: { ad: string; par: H2HPar }[] = []; for (const hl of [90, 180, 365]) for (const lam of [1, 3, 5]) GRID.push({ ad: `H_${hl}_${lam}`, par: { yarimOmurGun: hl, lambda: lam, yuzey: "AYNI" } }); GRID.push({ ad: "HF", par: { yarimOmurGun: 180, lambda: 3, yuzey: "FARKLI" } });
const PARS = GRID.map((g) => g.par); const VARS = GRID.map((g) => g.ad); const DEF = "H_180_3"; // DEF yalnız ayrıntılı tablo için bir başlangıç; SEÇİM DEĞİL
type At = { raceId: string; no: number; kazandi: boolean; v: Record<string, number | null>; hn: number; hToplam: number; s6n: number; s6Gun: number | null };
type Kosu = { raceId: string; t: number; tip: string; ganyan: number | null; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function ozellikler(ks: typeof ksA): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gj = jDep.gorunum(t), gd = dDep.gorunum(t), gh = hDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null; const hedef = { yuzey: YUZ_R[String(k.surface)] ?? "?", mesafe: k.distance }; const rakipIds = k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
      const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      out.push({ raceId: k.id, t, tip, ganyan: k.result?.ganyan ?? null, atlar: k.runners.map((r, i) => { const id = r.tjkAtId; const onceki = (id == null ? [] : gecmis.get(id) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        const d = id == null ? null : dereceBilesenleri(gd, id); const hs = id == null ? null : h2hNetCoklu(gh, id, rakipIds, hedef, PARS); const v: Record<string, number | null> = { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, S6: d?.son6 ?? null };
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
const SK = (c: Kol) => ({ acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, S6: 1 } as Record<string, number>)[c] ?? 0.3;
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
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const B4: Kol[] = ["acc", "kap", "S", "S6"]; const B4C: Kol[] = [...B4, ...KON];
const MOD: [string, Kol[]][] = [["base4", B4], ["c4", B4C], ...VARS.map((v): [string, Kol[]] => ["b+" + v, [...B4, v]]), ...VARS.map((v): [string, Kol[]] => ["c+" + v, [...B4C, v]])];
const PROB = MOD.filter(([n]) => n === "base4" || n.startsWith("b+")).map(([n]) => n);
console.log("Test A…"); const RA = degerlendir(A, MOD, PROB);
const birA = new Set(A.map((k) => k.raceId)); const egitAB = [...A, ...B.filter((k) => !birA.has(k.raceId))].sort((a, b) => a.t - b.t);
console.log("Test B…"); const RB = degerlendir(B, MOD, PROB); console.log("Test C (dış)…"); const RC = C.length ? degerlendirDis(egitAB, C, MOD, PROB) : null;
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (R: Sonuc, a: string, b: string, idx?: number[]) => { const I = idx ?? R.test.map((_, j) => j); const s = (x: number[]) => I.map((j) => x[j]!); return { ll: farkCI(s(R.ll[b]!), s(R.ll[a]!)), t1: farkCI(s(R.t1[a]!), s(R.t1[b]!), 100, 2), t3: farkCI(s(R.t3[a]!), s(R.t3[b]!), 100, 2), n: I.length }; };

// ───── BANKO ve eşleştirilmiş favori analizi
type Fav = { p: number; hit: number; roi: number | null; N: number; tip: string; v: Record<string, number | null> };
const favler = (R: Sonuc, ad: string): Fav[] => R.probs[ad]!.map((pr, j) => { let m = 0; pr.forEach((q, i) => { if (q > pr[m]!) m = i; }); const k = R.yk[R.test[j]!]!.k; const at = k.atlar[m]!; const hit = at.kazandi ? 1 : 0; return { p: pr[m]!, hit, roi: k.ganyan != null && k.ganyan > 0 ? (hit ? k.ganyan - 1 : -1) : null, N: k.atlar.length, tip: k.tip, v: at.v }; });
const ustK = (fv: Fav[], idx: number[], fr: number) => idx.slice().sort((x, y) => fv[y]!.p - fv[x]!.p).slice(0, Math.max(1, Math.round(fr * idx.length)));
const roiOrt = (fv: Fav[], s: number[]) => { const v = nn(s.map((j) => fv[j]!.roi)); return v.length ? mean(v) : NaN; };
function bankoSatir(R: Sonuc, bazAd: string, adAd: string, oranlar: number[], onek: string) {
  const n = R.test.length; const fb = favler(R, bazAd), fa = favler(R, adAd); const satir: string[] = []; const tum = Array.from({ length: n }, (_, j) => j);
  for (const fr of oranlar) { const sb = ustK(fb, tum, fr), sa = ustK(fa, tum, fr); const K = sb.length; const ortak = sb.filter((j) => sa.includes(j)).length / K; const dh: number[] = [], dr: number[] = [];
    for (let b = 0; b < 400; b++) { const idx = Array.from({ length: n }, () => (rnd() * n) | 0); const rB = ustK(fb, idx, fr), rA = ustK(fa, idx, fr); dh.push(mean(rA.map((j) => fa[j]!.hit)) - mean(rB.map((j) => fb[j]!.hit))); const x = roiOrt(fa, rA) - roiOrt(fb, rB); if (isFinite(x)) dr.push(x); } dh.sort((x, y) => x - y); dr.sort((x, y) => x - y);
    const hb = mean(sb.map((j) => fb[j]!.hit)), ha = mean(sa.map((j) => fa[j]!.hit)), rb = roiOrt(fb, sb), ra = roiOrt(fa, sa);
    satir.push(`| ${onek}${K} (%${fr * 100}) | ${pct(hb)}% | ${pct(ha)}% | ${((ha - hb) * 100).toFixed(2)} [${(dh[Math.floor(dh.length * 0.025)]! * 100).toFixed(2)}; ${(dh[Math.floor(dh.length * 0.975)]! * 100).toFixed(2)}] | ${pct(rb)}% | ${pct(ra)}% | ${((ra - rb) * 100).toFixed(2)} [${((dr[Math.floor(dr.length * 0.025)] ?? NaN) * 100).toFixed(2)}; ${((dr[Math.floor(dr.length * 0.975)] ?? NaN) * 100).toFixed(2)}] | %${pct(ortak, 0)} |`); }
  return satir;
}
function eslesmis(R: Sonuc, kol: string) {
  const fv = favler(R, "base4"); const s = [...fv].sort((a, b) => a.p - b.p); const q1 = s[Math.floor(s.length / 3)]!.p, q2 = s[Math.floor((2 * s.length) / 3)]!.p; const hucre = (x: Fav) => (x.p < q1 ? 0 : x.p < q2 ? 1 : 2) + "|" + (x.N <= 9 ? "k" : "b") + "|" + (["Maiden", "Şartlı", "Handikap"].includes(x.tip) ? x.tip : "Diğer");
  const gr = new Map<string, Fav[]>(); for (const x of fv.filter((q) => q.v[kol] != null)) { const a = gr.get(hucre(x)) ?? []; a.push(x); gr.set(hucre(x), a); }
  const H: { up: Fav[]; dn: Fav[]; w: number }[] = []; for (const a of gr.values()) { if (a.length < 16) continue; const med = medyan(a.map((x) => x.v[kol]!)); const up = a.filter((x) => x.v[kol]! > med), dn = a.filter((x) => x.v[kol]! <= med); if (up.length < 6 || dn.length < 6) continue; H.push({ up, dn, w: (up.length * dn.length) / (up.length + dn.length) }); }
  if (!H.length) return null; const agDiff = (hh: typeof H, key: "hit" | "roi") => { let s1 = 0, w = 0; for (const c of hh) { const f = (g: Fav[]) => { const v = nn(g.map((x) => (key === "hit" ? x.hit : x.roi))); return v.length ? mean(v) : NaN; }; const d = f(c.up) - f(c.dn); if (isFinite(d)) { s1 += c.w * d; w += c.w; } } return s1 / w; };
  const dh: number[] = [], dr: number[] = []; const re = (g: Fav[]) => Array.from({ length: g.length }, () => g[(rnd() * g.length) | 0]!); for (let b = 0; b < 500; b++) { const hh = H.map((c) => ({ up: re(c.up), dn: re(c.dn), w: c.w })); dh.push(agDiff(hh, "hit")); dr.push(agDiff(hh, "roi")); } dh.sort((x, y) => x - y); dr.sort((x, y) => x - y);
  const up = H.flatMap((c) => c.up), dn = H.flatMap((c) => c.dn); const ort = (g: Fav[], k: "hit" | "p") => mean(g.map((x) => x[k]));
  return { hucre: H.length, nFav: up.length + dn.length, hitUp: ort(up, "hit"), hitDn: ort(dn, "hit"), pUp: ort(up, "p"), pDn: ort(dn, "p"), diff: agDiff(H, "hit"), ciH: [dh[Math.floor(dh.length * 0.025)]!, dh[Math.floor(dh.length * 0.975)]!], roiDiff: agDiff(H, "roi"), ciR: [dr[Math.floor(dr.length * 0.025)]!, dr[Math.floor(dr.length * 0.975)]!] };
}
function eksikFav(R: Sonuc, kol: string) { const fv = favler(R, "base4"); const g = (a: Fav[]) => ({ n: a.length, hit: mean(a.map((x) => x.hit)), p: mean(a.map((x) => x.p)), roi: (() => { const v = nn(a.map((x) => x.roi)); return v.length ? mean(v) : NaN; })() }); return { var: g(fv.filter((x) => x.v[kol] != null)), yok: g(fv.filter((x) => x.v[kol] == null)) }; }

// ───── RAPOR
const SMP: [string, Sonuc | null, Kosu[]][] = [["A (tekrar kullanılmış; 6 blok ileri-yönlü β)", RA, A], ["B (daha az kullanılmış; 6 blok ileri-yönlü β)", RB, B], ["C (A∪B dışı, HİÇ kullanılmamış; β yalnız A∪B'den; held-out, ileri-yönlü DEĞİL)", RC, C]];
p("# H2H_NET — banko araştırması (taban dondurulmuş: ACC_HIZ + GALOP_KAPASITE + J_SEVIYE + SON6)");
p("**H2H onaylanmış sinyal DEĞİL; banko puanına EKLENMEDİ; `SINYAL_KAYDI` boş.** Parametreler SABİTLENMEDİ ve hiçbiri tekrarlanarak kullanılan A örnekleminin en iyi sonucuna göre SEÇİLMEDİ: aşağıda tüm ızgara (yarı ömür 90/180/365 × λ 1/3/5) üç örneklemde yan yana görünür; " + DEF + " yalnız ayrıntılı tablolar için bir başlangıçtır (seçim değil).");
p("");
p("## 0. Tanım, veri, doğrulama");
p("- **H2H_{h,j}** = Σ w·X /(Σ w + λ); X=+1/−1/0 (ortak yarışta iki atın da bitiş sırası bilinen); **ana hesap YALNIZ AYNI yüzey (K/Ç/S) karşılaşmaları**; w = 0,5^(gün/yarıÖmür) × **min(d_geçmiş, d_bugün)/max(...)** (oransal mesafe benzerliği; keskin eşik yok). H2H_NET_h = bugünkü rakiplerden kullanılabilir ortak yarışı olanların ortalaması; yoksa **null** (eksik; nötr doldurulur, ayrıca raporlanır).");
p("- **HF** (ayrı test): yalnız FARKLI yüzey karşılaşmaları (yarı ömür 180, λ 3). **Yüzey durumu (ıslak/ağır) eksik kabul edildi**: yüzey yalnız K/Ç/S; 'normal' varsayılmadı. Yüzeyi bilinmeyen karşılaşma ana hesaba da HF'ye de girmez.");
p("- **Referans (SON6 için) minimum n = 30 korundu.** SON6 tabana girdi (kullanıcı kararı); geçerli yarış sayısı ve son yarıştan geçen gün özellik olarak ayrıca tutuluyor (bölüm 1). Düşük örnekli referans gruplarının güvenilirliği bu raporda ölçülmedi (bkz. Sınırlar).");
p(`- **Örneklemler:** A ${A.length} yarış (${ilkT(A)}→${sonT(A)}), B ${B.length} (${ilkT(B)}→${sonT(B)}), **C ${C.length} yarış (${ilkT(C)}→${sonT(C)})**${afterArg ? ` (--after ${afterArg})` : ""}. C, A∪B'de bulunmayan tüm sonuçlanmış (koşulsuz, Karma dışı) yarışlardır; model kararlarında kullanılmadı ama zamanca A/B ile iç içe olabilir (β onlardan eğitilir) → **ileri-yönlü doğrulama DEĞİL, elde tutulmuş (held-out) doğrulamadır.** Gerçek ileri-yönlü doğrulama için tanım dondurulduktan sonra oluşacak yarışlarla bu araç \`--after <tarih>\` ile çalıştırılmalıdır.`);
p(`- Gelecek-bozma testi (ızgaranın ${PARS.length} parametre kümesi, ${secilen.length} gün, ${denenen} at): **${farkli === 0 && denenen > 0 ? "GEÇTİ — sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Bağımsız düz-döngü yeniden hesap (${DEF}, ${nOrn} rastgele at-yarış): uyuşmayan **${bagH}**.`);
p("");
p("## 1. Kapsam");
p("| Örneklem | Favori sayısı (test) | Favoride H2H var | Favoride H2H yok | Test atlarında SON6 tam (6 yarış) | Medyan son yarıştan gün (SON6'lı atlar) |\n|---|---|---|---|---|---|");
for (const [ad, R] of SMP) { if (!R) continue; const e = eksikFav(R, DEF); const testAt = R.test.flatMap((i) => R.yk[i]!.k.atlar); const gunler = nn(testAt.map((a) => a.s6Gun)); p(`| ${ad.split(" (")[0]} | ${e.var.n + e.yok.n} | ${e.var.n} (%${pct(e.var.n / (e.var.n + e.yok.n), 0)}) | ${e.yok.n} | %${pct(testAt.filter((a) => a.s6n >= 6).length / testAt.length, 0)} | ${medyan(gunler)} |`); }
p("");
p("## 2. SIRALAMA: Top1 / Top3 / log-loss (taban: dondurulmuş base4; H2H eklenince)");
p("ΔLL pozitif = iyileşme; Top1/Top3 farkı yüzde puan; köşeli parantez eşleştirilmiş bootstrap %95. Taban = ACC_HIZ + GALOP + J_SEVIYE + SON6; 'kontrollü' = taban + hp + geçmiş performans + sınıf değişimi.");
for (const [ad, R] of SMP) { if (!R) { p(`**${ad}** — örneklem boş.`); continue; } p(`### ${ad}`); p(`Test yarışı ${R.test.length}; taban Top1 ${pct(mean(R.t1["base4"]!))}% / Top3 ${pct(mean(R.t3["base4"]!))}% (rastgele ${pct(mean(R.r1))}% / ${pct(mean(R.r3))}%); kontrollü taban Top1 ${pct(mean(R.t1["c4"]!))}% / Top3 ${pct(mean(R.t3["c4"]!))}%.`);
  p("| Varyant | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] | Kontrollü ΔLL [%95] | Kontrollü Top1 [%95] | Kontrollü Top3 [%95] |\n|---|---|---|---|---|---|---|");
  for (const v of VARS) { const x = ek(R, "b+" + v, "base4"), y = ek(R, "c+" + v, "c4"); p(`| ${v} | ${x.ll} | ${x.t1} | ${x.t3} | ${y.ll} | ${y.t1} | ${y.t3} |`); } p(""); }
p("## 3. BANKO: aynı sayıda favoride isabet ve aynı bütçede net getiri");
p("**Tanım:** her model kendi favorisini (olasılığı en yüksek at) seçer; favori olasılığı en yüksek en üst %K yarış banko sayılır (**iki modelde seçilen banko sayısı aynıdır**). **Aynı bütçe:** her bankoya 1 birim ganyan bahsi (kazanırsa Result.ganyan − 1, kaybederse −1) → iki modelde toplam bahis eşit. Köşeli parantez: yarış yeniden örnekleme (400) %95. 'Ortak' = iki modelin banko yarışlarının örtüşmesi. Fark = yüzde puan.");
for (const [ad, R] of SMP) { if (!R) continue; p(`### ${ad} — ${DEF} ayrıntılı`); p("| Banko sayısı | Taban isabet | +H2H isabet | İsabet farkı [%95] | Taban net getiri | +H2H net getiri | Getiri farkı [%95] | Ortak |\n|---|---|---|---|---|---|---|---|"); for (const s of bankoSatir(R, "base4", "b+" + DEF, [0.05, 0.10, 0.20, 0.30], "")) p(s); p("");
  p("**Tüm ızgara (yalnız %10 ve %20 banko; SEÇİM DEĞİL):**"); p("| Varyant / banko sayısı | Taban isabet | +H2H isabet | İsabet farkı [%95] | Taban net getiri | +H2H net getiri | Getiri farkı [%95] | Ortak |\n|---|---|---|---|---|---|---|---|"); for (const v of VARS) for (const s of bankoSatir(R, "base4", "b+" + v, [0.10, 0.20], v + " / ")) p(s); p(""); }
p("## 4. Eşleştirilmiş favori karşılaştırması: aynı P_fav aralığı + yarış tipi + saha büyüklüğü");
p("Taban (base4) favorisi; hücre = P_fav üçlüsü × saha (≤9 / ≥10 at) × tip (Maiden/Şartlı/Handikap/Diğer). Her hücrede favorinin H2H değeri hücre medyanının üstünde/altında olanların isabeti karşılaştırılır; hücre farkları (n_üst·n_alt/(n_üst+n_alt)) ağırlığıyla birleştirilir (yalnız her iki yanda ≥ 6 favori olan, toplam ≥ 16 favorili hücreler). Ort. P_fav üst/alt, eşleştirmenin tutup tutmadığını gösterir. Pozitif fark = H2H'si yüksek favori daha sık kazanıyor.");
for (const [ad, R] of SMP) { if (!R) continue; p(`### ${ad}`); p("| Varyant | Hücre / favori | Ort. P_fav (üst/alt) | İsabet (üst / alt) | İsabet farkı puan [%95] | Net getiri farkı puan [%95] |\n|---|---|---|---|---|---|"); for (const v of VARS) { const m = eslesmis(R, v); if (!m) { p(`| ${v} | — | — | — | — | — |`); continue; } p(`| ${v} | ${m.hucre} / ${m.nFav} | ${pct(m.pUp)}% / ${pct(m.pDn)}% | ${pct(m.hitUp)}% / ${pct(m.hitDn)}% | ${(m.diff * 100).toFixed(2)} [${(m.ciH[0] * 100).toFixed(2)}; ${(m.ciH[1] * 100).toFixed(2)}] | ${(m.roiDiff * 100).toFixed(2)} [${(m.ciR[0] * 100).toFixed(2)}; ${(m.ciR[1] * 100).toFixed(2)}] |`); } p(""); }
p("## 5. H2H verisi bulunmayan favoriler (ayrı rapor)");
p("| Örneklem | Varyant | H2H'li favori (n / isabet / ort. P_fav / net getiri) | H2H'siz favori (n / isabet / ort. P_fav / net getiri) |\n|---|---|---|---|");
for (const [ad, R] of SMP) { if (!R) continue; for (const v of [DEF, "HF"]) { const e = eksikFav(R, v); p(`| ${ad.split(" (")[0]} | ${v} | ${e.var.n} / ${pct(e.var.hit)}% / ${pct(e.var.p)}% / ${pct(e.var.roi)}% | ${e.yok.n} / ${pct(e.yok.hit)}% / ${pct(e.yok.p)}% / ${pct(e.yok.roi)}% |`); } }
p("");
p("## Sınırlar");
p("- Taban dondurulmuş base4'tür ama piyasa/AGF veya motorun diğer sinyalleriyle kıyas DEĞİLDİR. C held-out'tur, ileri-yönlü değildir (β A∪B'den, zamanca iç içe). Çoklu karşılaştırma (10 varyant × 3 örneklem × birçok ölçüt) düzeltilmedi: tek bir hücredeki 'anlamlı' sonuç tek başına kanıt değildir; kararlar yalnız üç örneklemde tutarlı yön ve güven aralığı sıfırı dışlıyorsa ciddiye alınmalıdır.");
p("- H2H, geçmiş ilk-3 oranı/SON6 ile ilişkilidir (önceki rapor: ρ≈0,36–0,40); eşleştirme P_fav'ı (dolayısıyla bu bilgiyi) kısmen kontrol eder ama bağımsız etkiyi KANITLAMAZ. Net getiri farkları büyük örneklem olmadan gürültülüdür; banko %5 ≈ 60 yarıştır.");
p("- SON6 referans grubu minimum n=30 (düşük örnekli gruplarda güvenilirlik ayrıca ölçülmedi). H2H ortak yarışları yalnız önbellekteki atlardan bulunur (kapsam kısmi; bölüm 1). w_r ve λ ızgarası betimleyicidir.");
fs.writeFileSync("H2H_BANKO_RAPORU.md", L.join("\n"));
console.log(`YAZILDI H2H_BANKO_RAPORU.md | ${L.length} satır | sızıntı ${farkli === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan ${bagH}`);
await db.$disconnect(); process.exit(0);
