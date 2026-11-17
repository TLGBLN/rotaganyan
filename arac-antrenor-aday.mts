/**
 * ANTRENÖR MODELİ v1.0 — ANT_SEVIYE, ANT_BEKLENTI: ham değerler + (1) SIRALAMA katkısı + (2) BANKO katkısı. SALT-OKUMA. Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Sıralama tabanı: ACC_HIZ + GALOP_KAPASITE + J_SEVIYE (kullanıcı kararı). P_i (antrenör etkisi hariç beklenen olasılık): ACC_HIZ + GALOP_KAPASITE'li yarış-içi softmax; her blokta β YALNIZ önceki bloklardan (blok 0 için P_i yok).
 * Antrenör startları: kendi Runner+Result kayıtlarımız (Karma/koşullu kopya hariç; JockeyStatSync/toplu 17.11 tablosu KULLANILMAZ); tarih < yarış günü.
 * Örneklem A = /admin/kosu-tipleri (model kararlarında TEKRAR kullanıldı → BAĞIMSIZ nihai doğrulama DEĞİL); B = 01.07–15.08.2026 (yalnız ANT_SEVIYE; P_i olmadığı için ANT_BEKLENTI yok).
 * Çıktı: ANTRENOR_V1_RAPORU.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "./src/lib/methodology/yeni-motor/adaylar/jokey-aday";
import { ANT_SABITLERI, ANT_GUN_MS, AntrenorDeposu, antrenorBilesenleri, type StartKaydi } from "./src/lib/methodology/yeni-motor/adaylar/antrenor-aday";

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
let tohum = 2468; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── yarış listeleri, Accurace, geçmiş önbelleği (GG.AA.YYYY), galop
const sec = { id: true, raceNo: true, surface: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, tjkAtId: true, jockey: true, trainer: true, hp: true } } };
const ksA = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksB = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date("2026-07-01T00:00:00.000Z"), lt: new Date("2026-08-16T00:00:00.000Z") }, hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const atIds = [...new Set([...ksA, ...ksB].flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
console.log(`A ${ksA.length}, B ${ksB.length} yarış`);
console.log("Accurace okunuyor…"); const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const accHam: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));
type Gec = { t: number; fp: number | null; sinif: number | null }; const gecmis = new Map<number, Gec[]>(); const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, dayMs(r.race.raceDay.date));
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) { const liste: Gec[] = []; for (const x of (c.rowsJson as Record<string, unknown>[]) ?? []) { const t = trTarih(x.date); if (t == null) continue; gEkle(c.tjkAtId, t); const fp = parseInt(String(x.finishPos ?? ""), 10); liste.push({ t, fp: Number.isFinite(fp) && fp > 0 ? fp : null, sinif: SINIF_RANK[kabaG(normalizeClassType(String(x.classType ?? "")))] ?? null }); } gecmis.set(c.tjkAtId, liste.sort((a, b) => a.t - b.t)); }
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));

// ───── özellikler (1. aşama: ACC, GALOP, hp, geçmiş; 2. aşama: jokey + antrenör)
type At = { raceId: string; no: number; jokey: string; antrenor: string; kazandi: boolean; acc: number | null; kap: number | null; hp: number | null; win: number | null; top3: number | null; sinif: number | null; pBaz: number | null; S: number | null; AS: number | null; AB: number | null; AS4: number | null; AS16: number | null; AS32: number | null; AB4: number | null; AB16: number | null; AB32: number | null; asRaw: { w: number; n: number } | null; abRaw: { n: number; nt: number } | null };
type Kosu = { raceId: string; t: number; tip: string; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function asama1(ks: typeof ksA): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null;
      const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      out.push({ raceId: k.id, t, tip, atlar: k.runners.map((r, i) => { const onceki = (r.tjkAtId == null ? [] : gecmis.get(r.tjkAtId) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        return { raceId: k.id, no: r.no, jokey: jn(r.jockey), antrenor: an(r.trainer), kazandi: win.has(r.no), kap: om([pH[i]!, pK[i]!, pE[i]!]), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yzm).accHiz, hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, pBaz: null, S: null, AS: null, AB: null, AS4: null, AS16: null, AS32: null, AB4: null, AB16: null, AB32: null, asRaw: null, abRaw: null }; }) }); } }
  return out;
}
console.log("Örneklem A (aşama 1)…"); const A = asama1(ksA); console.log("Örneklem B (aşama 1)…"); const B = asama1(ksB);

// ───── ölçü cihazı yardımcıları
type Kol = "acc" | "kap" | "hp" | "win" | "top3" | "sinif" | "S" | "AS" | "AB" | "AS4" | "AS16" | "AS32" | "AB4" | "AB16" | "AB32";
const SKALA: Record<Kol, number> = { acc: 100, kap: 1, hp: 20, win: 1, top3: 1, sinif: 2, S: 0.1, AS: 0.1, AB: 0.03, AS4: 0.1, AS16: 0.1, AS32: 0.1, AB4: 0.03, AB16: 0.03, AB32: 0.03 };
const doldur = (v: (number | null)[]) => { const a = nn(v); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
const colX = (k: Kosu, c: Kol) => doldur(k.atlar.map((a) => (a[c] == null ? null : (a[c] as number) / SKALA[c])));
function coz(H: number[][], g: number[]) { const K = g.length; const M = H.map((r, i) => [...r, g[i]!]); for (let c = 0; c < K; c++) { let m = c; for (let r = c + 1; r < K; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[m]![c]!)) m = r; [M[c], M[m]] = [M[m]!, M[c]!]; const d = M[c]![c]!; for (let j = c; j <= K; j++) M[c]![j]! /= d; for (let r = 0; r < K; r++) if (r !== c) { const fct = M[r]![c]!; for (let j = c; j <= K; j++) M[r]![j]! -= fct * M[c]![j]!; } } return M.map((r) => r[K]!); }
const BLOK = 6;
function fitFn(yk: { k: Kosu; w: number }[], X: (i: number, c: Kol) => number[]) { return (idx: number[], cols: Kol[]) => { const K = cols.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 30; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = Xi.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(Xi[a]!.map((v, r) => pr[r]! * v * Xi[c]![r]!)))); const w = yk[i]!.w;
      for (let a = 0; a < K; a++) g[a] += Xi[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } const d = coz(H, g); b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; }; }
const olasFn = (X: (i: number, c: Kol) => number[]) => (i: number, cols: Kol[], b: number[]) => { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); return e.map((q) => q / z); };

// ───── jokeyden/antrenörden BAĞIMSIZ beklenen olasılık: yalnız (acc, kap); blok 0 → yok
const ykA0 = A.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0); const basA = (b: number) => Math.floor(ykA0.length * b / BLOK); const cA0 = new Map<string, number[]>(); const XA0 = (i: number, c: Kol) => { const key = i + "|" + c; let v = cA0.get(key); if (!v) { v = colX(ykA0[i]!.k, c); cA0.set(key, v); } return v; };
const fit0 = fitFn(ykA0, XA0), olas0 = olasFn(XA0); const pBazMap = new Map<string, number>();
for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < basA(bl); i++) egit.push(i); const b = fit0(egit, ["acc", "kap"]); for (let i = basA(bl); i < basA(bl + 1); i++) { const pr = olas0(i, ["acc", "kap"], b); ykA0[i]!.k.atlar.forEach((a, j) => { a.pBaz = pr[j]!; pBazMap.set(a.raceId + "#" + a.no, pr[j]!); }); } }

// ───── startlar ve biniş deposu (Karma/koşullu HARİÇ)
console.log("Startlar okunuyor…");
const rr = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, trainer: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
const alanN = new Map<string, number>(); for (const r of rr) alanN.set(r.race.id, (alanN.get(r.race.id) ?? 0) + 1);
const jDep = new JokeyDeposu(rr.filter((r) => jn(r.jockey)).map((r): BinisKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: null })));
const startlar: StartKaydi[] = rr.filter((r) => an(r.trainer)).map((r) => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), antrenor: an(r.trainer), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, alanN: alanN.get(r.race.id)!, pBaz: pBazMap.get(r.race.id + "#" + r.no) ?? null }));
const aDep = new AntrenorDeposu(startlar);
const trKatsayi = (k: number, w: number, n: number, p0: number | null) => (n > 0 && p0 != null ? (w + k * p0) / (n + k) : null);
function asama2(pop: Kosu[], beklentiVar: boolean) {
  const gunler = [...new Set(pop.map((k) => k.t))]; for (const t of gunler) { const gj = jDep.gorunum(t), ga = aDep.gorunum(t);
    for (const k of pop.filter((x) => x.t === t)) for (const a of k.atlar) { if (a.jokey) a.S = jokeyBilesenleri(gj, a.jokey).seviye.pRef; if (!a.antrenor) continue; const tb = antrenorBilesenleri(ga, a.antrenor); a.AS = tb.seviye.deger; a.asRaw = { w: tb.seviye.w, n: tb.seviye.n };
      a.AS4 = trKatsayi(4, tb.seviye.w, tb.seviye.n, tb.seviye.p0); a.AS16 = trKatsayi(16, tb.seviye.w, tb.seviye.n, tb.seviye.p0); a.AS32 = trKatsayi(32, tb.seviye.w, tb.seviye.n, tb.seviye.p0);
      if (beklentiVar) { a.AB = tb.beklenti.deger; a.abRaw = { n: tb.beklenti.nBilinen, nt: tb.beklenti.nToplam }; const nb = tb.beklenti.nBilinen, d = tb.beklenti.w - tb.beklenti.e; a.AB4 = nb > 0 ? d / (nb + 4) : null; a.AB16 = nb > 0 ? d / (nb + 16) : null; a.AB32 = nb > 0 ? d / (nb + 32) : null; } } }
}
asama2(A, true); asama2(B, false);

// ───── sızıntı + bağımsız yeniden hesap
const gunlerA = [...new Set(A.map((k) => k.t))].sort((a, b) => a - b); const secilen = gunlerA.filter((_, i) => i % Math.ceil(gunlerA.length / 8) === 0).slice(0, 8); let denenen = 0, farkli = 0;
for (const t of secilen) { const g0 = aDep.gorunum(t), g1 = aDep.gelecegiBoz(t, 11 + (t / ANT_GUN_MS) % 991).gorunum(t); for (const x of new Set(A.filter((k) => k.t === t).flatMap((k) => k.atlar.map((a) => a.antrenor)))) { if (!x) continue; denenen++; if (JSON.stringify(antrenorBilesenleri(g0, x)) !== JSON.stringify(antrenorBilesenleri(g1, x))) farkli++; } }
const orn = A.flatMap((k) => k.atlar.filter((a) => a.antrenor && a.AS != null).map((a) => ({ a, t: k.t }))); let bagUyumsuz = 0, nOrn = 0;
for (let i = 0; i < 150 && orn.length; i++) { const { a, t } = orn[Math.floor(rnd() * orn.length)]!; nOrn++; const my = startlar.filter((s) => s.antrenor === a.antrenor && s.tarih < t && s.tarih >= t - 365 * ANT_GUN_MS); const n = my.length, w = my.reduce((s, x) => s + x.kazandi, 0); const p0 = my.reduce((s, x) => s + 1 / x.alanN, 0) / n; const as = (w + 8 * p0) / (n + 8); const bl = my.filter((x) => x.pBaz != null); const ab = bl.length ? bl.reduce((s, x) => s + x.kazandi - x.pBaz!, 0) / (bl.length + 8) : null;
  const ok = (x: number | null, y: number | null) => (x == null || y == null ? x === y : Math.abs(x - y) < 1e-9); if (!(ok(as, a.AS) && ok(ab, a.AB))) bagUyumsuz++; }
const trVaryant = (() => { const m = new Map<string, number>(); for (const s of startlar) m.set(s.antrenor, (m.get(s.antrenor) ?? 0) + 1); const tamAd = [...m.entries()].filter(([k]) => !k.includes(".") && k.includes(" ")); return { farkli: m.size, tamAdSatir: sum(tamAd.map(([, v]) => v)), toplam: startlar.length, medyanStart: medyan([...m.values()]) }; })();

// ───── değerlendirme (A: tam; B: yalnız ANT_SEVIYE)
type Sonuc = { yk: { k: Kosu; w: number }[]; test: number[]; ll: Record<string, number[]>; t1: Record<string, number[]>; t3: Record<string, number[]>; bt: Record<string, string[]>; taban: number[]; r1: number[]; r3: number[]; probs: Record<string, number[][]> };
function degerlendir(pop: Kosu[], modeller: [string, Kol[]][], probKaydet: string[]): Sonuc {
  const yk = pop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0); const bas = (b: number) => Math.floor(yk.length * b / BLOK); const cache = new Map<string, number[]>(); const X = (i: number, c: Kol) => { const key = i + "|" + c; let v = cache.get(key); if (!v) { v = colX(yk[i]!.k, c); cache.set(key, v); } return v; };
  const fit = fitFn(yk, X), olas = olasFn(X); const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
  const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {}, probs: Record<string, number[][]> = {};
  for (const [ad, cols] of modeller) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; probs[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
    for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olas(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); if (probKaydet.includes(ad)) probs[ad]!.push(pr); } } }
  return { yk, test, ll, t1, t3, bt, taban: test.map((i) => Math.log(yk[i]!.k.atlar.length)), r1: test.map((i) => 1 / yk[i]!.k.atlar.length), r3: test.map((i) => Math.min(1, 3 / yk[i]!.k.atlar.length)), probs };
}
const KON: Kol[] = ["hp", "win", "top3", "sinif"]; const BASE: Kol[] = ["acc", "kap", "S"]; const BASEC: Kol[] = ["acc", "kap", "S", ...KON];
const NM = { base: "T. ACC_HIZ + GALOP_KAPASITE + J_SEVIYE (taban)", AS: "T + ANT_SEVIYE", AB: "T + ANT_BEKLENTI", ASAB: "T + ANT_SEVIYE + ANT_BEKLENTI", ASa: "Yalnız ANT_SEVIYE", ABa: "Yalnız ANT_BEKLENTI", c: "TK. taban + kontroller (hp, geçmiş performans, sınıf değişimi)", cAS: "TK + ANT_SEVIYE", cAB: "TK + ANT_BEKLENTI", cASAB: "TK + ANT_SEVIYE + ANT_BEKLENTI", AS4: "T + ANT_SEVIYE (k=4)", AS16: "T + ANT_SEVIYE (k=16)", AS32: "T + ANT_SEVIYE (k=32)", AB4: "T + ANT_BEKLENTI (k=4)", AB16: "T + ANT_BEKLENTI (k=16)", AB32: "T + ANT_BEKLENTI (k=32)" } as const;
const MA: [string, Kol[]][] = [[NM.base, BASE], [NM.AS, [...BASE, "AS"]], [NM.AB, [...BASE, "AB"]], [NM.ASAB, [...BASE, "AS", "AB"]], [NM.ASa, ["AS"]], [NM.ABa, ["AB"]], [NM.c, BASEC], [NM.cAS, [...BASEC, "AS"]], [NM.cAB, [...BASEC, "AB"]], [NM.cASAB, [...BASEC, "AS", "AB"]], [NM.AS4, [...BASE, "AS4"]], [NM.AS16, [...BASE, "AS16"]], [NM.AS32, [...BASE, "AS32"]], [NM.AB4, [...BASE, "AB4"]], [NM.AB16, [...BASE, "AB16"]], [NM.AB32, [...BASE, "AB32"]]];
const MB: [string, Kol[]][] = [[NM.base, BASE], [NM.AS, [...BASE, "AS"]], [NM.c, BASEC], [NM.cAS, [...BASEC, "AS"]]];
console.log("Test A…"); const RA = degerlendir(A, MA, [NM.base, NM.AS, NM.AB, NM.ASAB, NM.c, NM.cAS, NM.cAB, NM.cASAB]); console.log("Test B…"); const RB = degerlendir(B, MB, []);
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (R: Sonuc, a: string, b: string, idx?: number[]) => { const I = idx ?? R.test.map((_, j) => j); const s = (x: number[]) => I.map((j) => x[j]!); return { ll: farkCI(s(R.ll[b]!), s(R.ll[a]!)), t1: farkCI(s(R.t1[a]!), s(R.t1[b]!), 100, 2), t3: farkCI(s(R.t3[a]!), s(R.t3[b]!), 100, 2), n: I.length, nokta: mean(s(R.ll[b]!)) - mean(s(R.ll[a]!)) }; };

// ───── BANKO analizi (A): aynı sayıda banko; favori = model olasılığı en yüksek at
function bankoTablo(R: Sonuc, bazAd: string, adAd: string) {
  const n = R.test.length; const fav = (ad: string) => R.probs[ad]!.map((pr, j) => { let m = 0; pr.forEach((q, i) => { if (q > pr[m]!) m = i; }); return { p: pr[m]!, hit: R.yk[R.test[j]!]!.k.atlar[m]!.kazandi ? 1 : 0 }; });
  const fb = fav(bazAd), fa = fav(adAd); const satir: string[] = [];
  for (const fr of [0.05, 0.10, 0.20, 0.30]) { const K = Math.round(fr * n); const sec = (fv: { p: number; hit: number }[], idx: number[]) => { const s = idx.map((j) => j).sort((x, y) => fv[y]!.p - fv[x]!.p).slice(0, Math.max(1, Math.round(fr * idx.length))); return { hit: mean(s.map((j) => fv[j]!.hit)), set: new Set(s) }; };
    const tum = Array.from({ length: n }, (_, j) => j); const sb = sec(fb, tum), sa = sec(fa, tum); const ortak = [...sb.set].filter((j) => sa.set.has(j)).length / K;
    const d: number[] = []; for (let b = 0; b < 400; b++) { const idx = Array.from({ length: n }, () => (rnd() * n) | 0); const sB = idx.map((j, q) => q).sort((x, y) => fb[idx[y]!]!.p - fb[idx[x]!]!.p).slice(0, Math.max(1, Math.round(fr * n))), sA = idx.map((j, q) => q).sort((x, y) => fa[idx[y]!]!.p - fa[idx[x]!]!.p).slice(0, Math.max(1, Math.round(fr * n))); d.push(mean(sA.map((q) => fa[idx[q]!]!.hit)) - mean(sB.map((q) => fb[idx[q]!]!.hit))); } d.sort((x, y) => x - y);
    satir.push(`| ${K} (%${fr * 100}) | ${pct(sb.hit)}% | ${pct(sa.hit)}% | ${((sa.hit - sb.hit) * 100).toFixed(2)} puan [${(d[Math.floor(d.length * 0.025)]! * 100).toFixed(2)}; ${(d[Math.floor(d.length * 0.975)]! * 100).toFixed(2)}] | %${pct(ortak, 0)} |`); }
  return satir;
}
function olasilikEslesmis(R: Sonuc, bazAd: string, kol: "AS" | "AB") {
  const n = R.test.length; const fv = R.probs[bazAd]!.map((pr, j) => { let m = 0; pr.forEach((q, i) => { if (q > pr[m]!) m = i; }); const at = R.yk[R.test[j]!]!.k.atlar[m]!; return { p: pr[m]!, hit: at.kazandi ? 1 : 0, v: at[kol] }; }).filter((x) => x.v != null);
  const s = [...fv].sort((a, b) => a.p - b.p); const satir: string[] = []; const T = 3; for (let q = 0; q < T; q++) { const dil = s.slice(Math.floor((q * s.length) / T), Math.floor(((q + 1) * s.length) / T)); const med = medyan(dil.map((x) => x.v!)); const ust = dil.filter((x) => x.v! > med), alt = dil.filter((x) => x.v! <= med); if (ust.length < 10 || alt.length < 10) continue;
    const d: number[] = []; for (let b = 0; b < 500; b++) { const u = Array.from({ length: ust.length }, () => ust[(rnd() * ust.length) | 0]!.hit), a2 = Array.from({ length: alt.length }, () => alt[(rnd() * alt.length) | 0]!.hit); d.push(mean(u) - mean(a2)); } d.sort((x, y) => x - y);
    satir.push(`| ${q + 1}. dilim (ort. P_fav ${pct(mean(dil.map((x) => x.p)))}%) | ${dil.length} | ${pct(mean(ust.map((x) => x.p)))}% / ${pct(mean(alt.map((x) => x.p)))}% | ${pct(mean(ust.map((x) => x.hit)))}% (${ust.length}) | ${pct(mean(alt.map((x) => x.hit)))}% (${alt.length}) | ${((mean(ust.map((x) => x.hit)) - mean(alt.map((x) => x.hit))) * 100).toFixed(2)} puan [${(d[Math.floor(d.length * 0.025)]! * 100).toFixed(2)}; ${(d[Math.floor(d.length * 0.975)]! * 100).toFixed(2)}] |`); }
  return satir;
}

// ───── RAPOR
const hepA = A.flatMap((k) => k.atlar); const hepB = B.flatMap((k) => k.atlar);
p("# ANTRENÖR MODELİ v1.0 — ANT_SEVIYE ve ANT_BEKLENTI (ham değerler, sıralama ve banko testi)");
p("**Motorun aktif sinyal listesine hiçbir şey eklenmedi; katsayı/birleşim ağırlığı belirlenmedi; `SINYAL_KAYDI` boş.** Seviye ve beklenti AYRI tutuldu. Her yarış için antrenör sonuçları O yarışın gününden önceki startlarla yeniden hesaplandı; 17.11.2026 toplu antrenör tablosu KULLANILMADI.");
p("");
p("## 0. Tanımlar, veri ve açık uyarılar");
p(`- **ANT_SEVIYE** = (W + k·P0)/(N + k); pencere [t−${ANT_SABITLERI.refGun} gün, t); **P0** = antrenörün kendi startlarındaki 1/(sahadaki at sayısı) ortalaması (karşılaştırılabilir yarışlardaki eşit-şans kazanma oranı; yarış karışımına göre). **ANT_BEKLENTI** = Σ(Y_i − P_i)/(N + k), yalnız P_i'si bilinen startlar.`);
p(`- **k = ${ANT_SABITLERI.kSeviye} GEÇİCİ SABİTTİR; öğrenilmedi** (J_FORM30'daki 8 ile aynı). "Testle belirlenecek" ifadesi uygulanmadı; yalnız bölüm 2'de k = 4/8/16/32 için **betimleyici duyarlılık** (seçim DEĞİL) gösterilir; k kararı sizin ve bağımsız veriyle verilmeli.`);
p("- **P_i (antrenör etkisi hariç beklenen olasılık):** yalnız ACC_HIZ + GALOP_KAPASITE; her blokta β YALNIZ önceki bloklardan (ölçü cihazı); **blok 0 için P_i YOK**; P_i'siz startlar ANT_BEKLENTI'ye girmez. P_i jokeyi de içermez (jokey etkisi de hariç), böylece antrenör/jokey aynı güçlü atlardan ortak puan almasın.");
p(`- **Antrenör adı:** TJK kısaltmaları (ör. "RAM. KAYA", "MEHM.KAYA" farklı kişilerdir); noktadan sonraki boşluklar normalleştirildi (${trVaryant.farkli} farklı ad, medyan ${trVaryant.medyanStart} start). Tam adla yazılmış (kısaltmasız) varyantlar toplam startın %${pct(trVaryant.tamAdSatir / trVaryant.toplam)}'i; birleştirilmedi (aynı kişinin tam ad/kısaltma varyantı ayrı sayılmış olabilir).`);
p("- **Veri sınırı:** veritabanı 2026-01-01'den başlar (365 günlük pencere kısa); P_i yalnız popülasyon A'nın blok ≥1'indeki yarışlarda var (16 Ağustos öncesi startlar beklentiye girmez).");
p(`- **Örneklem A** (/admin/kosu-tipleri, ${A.length} yarış) model kararlarında defalarca kullanıldı → **bağımsız nihai doğrulama DEĞİLDİR.** **Örneklem B** (01.07–15.08.2026, ${B.length} yarış) daha az kullanılmış; yalnız ANT_SEVIYE için (P_i yok).`);
p(`- Gelecek-bozma testi (${secilen.length} gün, ${denenen} antrenör): **${farkli === 0 && denenen > 0 ? "GEÇTİ — sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Bağımsız yeniden hesap (düz döngü, ${nOrn} rastgele antrenör-yarış): **uyuşmayan ${bagUyumsuz}**. Puanlar sonuç yüklenmeden önce hesaplandı.`);
p("");
// kapsam
const kap = (h: At[], fn: (a: At) => boolean) => pct(h.filter(fn).length / h.length) + "%";
p("## 1. Kapsam ve ham değer dağılımı (Örneklem A)");
p("| Ölçü | At | Oran |\n|---|---|---|"); for (const [ad, fn] of [["Antrenör adı var", (a: At) => !!a.antrenor], ["ANT_SEVIYE var (pencerede ≥1 start)", (a: At) => a.AS != null], ["ANT_BEKLENTI var (P_i'si bilinen ≥1 start)", (a: At) => a.AB != null], ["N ≥ 30 (ANT_SEVIYE)", (a: At) => (a.asRaw?.n ?? 0) >= 30], ["P_i'si bilinen start ≥ 10 (ANT_BEKLENTI)", (a: At) => (a.abRaw?.n ?? 0) >= 10]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${hepA.filter(fn).length} | ${kap(hepA, fn)} |`);
p(`\nMedyan N (ANT_SEVIYE) ${medyan(hepA.filter((a) => a.asRaw).map((a) => a.asRaw!.n))}; medyan P_i'si bilinen start / N ${f(medyan(hepA.filter((a) => a.abRaw && a.abRaw.nt > 0).map((a) => a.abRaw!.n / a.abRaw!.nt)), 2)}. ANT_SEVIYE ham değer çeyrekleri: ${(() => { const v = nn(hepA.map((a) => a.AS)).sort((x, y) => x - y); return [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => f(v[Math.floor(q * (v.length - 1))], 3)).join(" / "); })()} (5/25/50/75/95. yüzdelik); ANT_BEKLENTI: ${(() => { const v = nn(hepA.map((a) => a.AB)).sort((x, y) => x - y); return [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => f(v[Math.floor(q * (v.length - 1))], 3)).join(" / "); })()}.`);
p("");
// sıralama
p("## 2. SIRALAMA: ACC_HIZ + GALOP_KAPASITE + J_SEVIYE üzerine ek katkı (Örneklem A — TEKRAR KULLANILMIŞ)");
p(`Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan; eksik puan yarış ortalamasına (nötr); yön varsayımı yok. ${RA.test.length} test yarışı. ΔLL pozitif = iyileşme; Top1/Top3 puan; köşeli parantez eşleştirilmiş bootstrap %95. Girdi ölçekleri sabit (ANT_SEVIYE/0,10; ANT_BEKLENTI/0,03).`);
p("| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |\n|---|---|---|---|---|---|");
for (const [m] of MA.slice(0, 10)) { const d = RA.taban.map((q, i) => q - RA.ll[m]![i]!); const [lo, hi] = boot(d); p(`| ${m} | ${f(mean(RA.ll[m]!))} | ${f(mean(d))} [${f(lo)}; ${f(hi)}] | ${pct(mean(RA.t1[m]!))}% (${pct(mean(RA.r1))}%) | ${pct(mean(RA.t3[m]!))}% (${pct(mean(RA.r3))}%) | ${RA.bt[m]!.join(" ; ")} |`); }
p(""); p("**Ek katkılar:**"); p("| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
for (const [a, b, e] of [[NM.AS, NM.base, "ANT_SEVIYE → taban"], [NM.AB, NM.base, "ANT_BEKLENTI → taban"], [NM.ASAB, NM.base, "ikisi birlikte → taban"], [NM.ASAB, NM.AS, "**ANT_BEKLENTI → taban + ANT_SEVIYE** (aynı bilgi mi?)"], [NM.ASAB, NM.AB, "**ANT_SEVIYE → taban + ANT_BEKLENTI** (aynı bilgi mi?)"], [NM.cAS, NM.c, "**ANT_SEVIYE → taban + kontroller** (at kalitesi kontrollü)"], [NM.cAB, NM.c, "**ANT_BEKLENTI → taban + kontroller**"], [NM.cASAB, NM.c, "ikisi birlikte → taban + kontroller"], [NM.c, NM.base, "Kontroller → taban (bilgi)"]] as [string, string, string][]) { const x = ek(RA, a, b); p(`| ${e} | ${x.n} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
{ const k1 = ek(RA, NM.AS, NM.base), k2 = ek(RA, NM.cAS, NM.c); p(""); p(`**Sönümlenme (ANT_SEVIYE):** kontrolsüz ${f(k1.nokta)} → kontrollü ${f(k2.nokta)} (%${pct(k2.nokta / k1.nokta, 0)} kalıyor).`); }
p(""); p("**k duyarlılığı (BETİMLEYİCİ; seçim DEĞİL — ΔLL taban + ilgili hesap, taban 0,0000):**");
p("| k | ANT_SEVIYE → taban ΔLL [%95] | ANT_BEKLENTI → taban ΔLL [%95] |\n|---|---|---|"); for (const [k, a1, a2] of [[4, NM.AS4, NM.AB4], [8, NM.AS, NM.AB], [16, NM.AS16, NM.AB16], [32, NM.AS32, NM.AB32]] as [number, string, string][]) p(`| ${k}${k === 8 ? " (geçici sabit)" : ""} | ${ek(RA, a1, NM.base).ll} | ${ek(RA, a2, NM.base).ll} |`);
p("");
p("**Koşu tipine göre (ANT_SEVIYE → taban, ΔLL / Top1 / Top3):**"); p("| Koşu tipi | Test yarışı | ΔLL [%95] | Top1 [%95] | Top3 [%95] |\n|---|---|---|---|---|");
for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const ix = RA.test.map((i, j) => (RA.yk[i]!.k.tip === g ? j : -1)).filter((j) => j >= 0); if (ix.length < 5) continue; const x = ek(RA, NM.AS, NM.base, ix); p(`| ${g} | ${ix.length}${ix.length < 30 ? " (AZ ÖRNEK)" : ""} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
p("");
// örneklem B
p("## 3. Örneklem B (01.07–15.08.2026; daha az kullanılmış) — yalnız ANT_SEVIYE");
p(`Yarış ${B.length}, test ${RB.test.length}; ANT_SEVIYE kapsamı ${kap(hepB, (a) => a.AS != null)}.`);
p("| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
for (const [a, b, e] of [[NM.AS, NM.base, "ANT_SEVIYE → taban"], [NM.cAS, NM.c, "ANT_SEVIYE → taban + kontroller"]] as [string, string, string][]) { const x = ek(RB, a, b); p(`| ${e} | ${x.n} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
p("");
// bilgi tekrarı
p("## 4. Bilgi tekrarı: antrenör ↔ jokey ↔ at kalitesi (yarış-içi korelasyon)");
const cift = (kolA: Kol, kolB: Kol) => { const x: number[] = [], y: number[] = []; for (const k of A) { const idx = k.atlar.map((t, j) => (t[kolA] != null && t[kolB] != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const ma = mean(idx.map((j) => k.atlar[j]![kolA] as number)), mb = mean(idx.map((j) => k.atlar[j]![kolB] as number)); for (const j of idx) { x.push((k.atlar[j]![kolA] as number) - ma); y.push((k.atlar[j]![kolB] as number) - mb); } } return `${f(corr(x, y), 2)} (n ${x.length})`; };
p("| Çift | Yarış-içi Pearson |\n|---|---|"); for (const [a, b, ad] of [["AS", "S", "ANT_SEVIYE ↔ J_SEVIYE (iki \"seviye\" aynı güçlü atlardan mı?)"], ["AS", "AB", "ANT_SEVIYE ↔ ANT_BEKLENTI"], ["AS", "acc", "ANT_SEVIYE ↔ ACC_HIZ"], ["AS", "kap", "ANT_SEVIYE ↔ GALOP_KAPASITE"], ["AS", "hp", "ANT_SEVIYE ↔ handikap puanı"], ["AS", "top3", "ANT_SEVIYE ↔ geçmiş ilk-3 oranı"], ["AB", "S", "ANT_BEKLENTI ↔ J_SEVIYE"], ["AB", "acc", "ANT_BEKLENTI ↔ ACC_HIZ"]] as [Kol, Kol, string][]) p(`| ${ad} | ${cift(a, b)} |`);
p("");
// banko
p("## 5. BANKO: aynı sayıda banko seçerek ek isabet var mı? (Örneklem A test yarışları — TEKRAR KULLANILMIŞ)");
p("**Banko tanımı (bu testte):** her yarışta modelin olasılığı en yüksek atı \"favori\" sayılır; modelin favori olasılığı en yüksek olan en üst %K yarış \"banko\" seçilir (her model KENDİ olasılığıyla seçer, **seçilen banko sayısı aynıdır**). Banko isabeti = seçilen yarışlarda favorinin kazanması. Tablo: taban (ACC_HIZ + GALOP + J_SEVIYE) ile antrenör eklenmiş modelin banko isabeti ve eşleştirilmiş bootstrap (400, yarış yeniden örneklemesi; seçim her örneklemde yeniden yapılır). \"Ortak\" = iki modelin seçtiği banko yarışlarının örtüşme oranı.");
for (const [ad, adAd] of [["ANT_SEVIYE ekli", NM.AS], ["ANT_BEKLENTI ekli", NM.AB], ["ANT_SEVIYE + ANT_BEKLENTI ekli", NM.ASAB]] as [string, string][]) { p(`**${ad}**`); p("| Banko sayısı | Taban isabet | Antrenörlü isabet | Fark [%95] | Ortak seçim |\n|---|---|---|---|---|"); for (const s of bankoTablo(RA, NM.base, adAd)) p(s); p(""); }
p("**Aynı olasılıktaki favoriler arasında antrenör ayrımı:** taban modelin favorisi, taban P_fav'ına göre üç dilime bölünür; her dilimde favorinin antrenör değeri dilim medyanının üstünde/altında olanların isabeti karşılaştırılır (dilim içinde P_fav'lar eşleştirilmiş kabul edilir; ort. P_fav üst/alt gösterilir).");
for (const [kol, ad] of [["AS", "ANT_SEVIYE"], ["AB", "ANT_BEKLENTI"]] as ["AS" | "AB", string][]) { p(`**${ad}**`); p("| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark [%95] |\n|---|---|---|---|---|---|"); for (const s of olasilikEslesmis(RA, NM.base, kol)) p(s); p(""); }
p("## Sınırlar");
p("- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. A örneklemi tekrar kullanıldı; B kısa ve yalnız ANT_SEVIYE için. Çoklu karşılaştırma düzeltilmedi; koşu tipi ve banko dilimleri küçük örneklidir (banko %5 ≈ 63 yarış).");
p("- P_i yalnız ACC_HIZ + GALOP_KAPASITE'den gelir (sınıf, kilo, kulvar, geçmiş performans yok); ANT_BEKLENTI bu eksikliklerin kısmen \"antrenör etkisi\" gibi görünmesine açıktır. Banko analizi retrospektiftir; favori olasılıkları kalibre edilmiş gerçek olasılık değildir (ölçü cihazı çıktısı). Bu rapor seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.");
fs.writeFileSync("ANTRENOR_V1_RAPORU.md", L.join("\n"));
console.log(`YAZILDI ANTRENOR_V1_RAPORU.md | ${L.length} satır | sızıntı ${farkli === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan ${bagUyumsuz}`);
await db.$disconnect(); process.exit(0);
