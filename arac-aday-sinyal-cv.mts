// SALT-OKUMA ADAY SİNYAL SINAMASI (arac-ham-alan-final.mts'ten türetildi; HİÇBİR dosya/ağırlık YAZMAZ, canlı modele dokunmaz).
// Adaylar bugünkü canlı 21 sinyalli tabana TEK TEK eklenip motorun eğitim yöntemiyle (zaman-CV, DEV/SINAMA katları) ölçülür.
// !!! Runner tablosunu TAMAMEN tarar (PIT geçmişi için) — yarış saatinde ÇALIŞTIRMA, gece/yarışlar bitince çalıştır. Girdi: C:/tmp/saf-model-egitim-verisi-16ozellik.json + saf18-model-egitim-verisi.json
// ROTAGANYAN — (özgün başlık) YENİ varsayılan model: 16 özellik + jokeyPIT + antrenorPIT + galopKalite + lastWon,
// ACC özellikleri YUMUŞAK yüzey kuralıyla. 2026-11-12 kullanıcı kararı ("tüm eksiklerimizi
// belirle ve ortadan kaldır", "kayıtlı accurace varsa değerlendirilecek").
// Yarış başına DB çağrısı YOK: ACC özellikleri yalnız Accurace arşivi + yarış tarihi/mesafe/pistinden
// hesaplandığı için canlı motorun AYNI fonksiyonlarıyla (closingResidual/lateSegmentSpeed/
// speedResidual) bellekte yeniden üretilir; PIT sinyalleri pit-seviye.actions.ts ile AYNI mantık.
// Girdi: C:/tmp/saf-model-egitim-verisi-16ozellik.json (canlı model popülasyonu, 1392 yarış),
// C:/tmp/saf18-model-egitim-verisi.json (galopKalite, segment verisi).
// Çıktı: genişleyen pencereli 5 kat CV raporu + v546-1-saf-weights.json (yedek alınarak) +
// Maiden/ŞARTLI19 segmentinin ACC kaymasını gidermek için yeniden eğitimi (yedek alınarak).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { closingResidual, lateSegmentSpeed, speedResidual, makeBaselineCache, makeClosingBaselineCache } from "./src/lib/accurace/features";
import type { Surface } from "./src/lib/accurace/types";

type Sig = { ad: string; raw: number | null; observed: boolean; reliability: number; evidenceObserved?: boolean };
type Satir = { raceId: string; tarih: string; winnerRunnerId: string | null; classType?: string; runners: { runnerId: string; no: number; kazandi: boolean; sinyaller: Sig[] }[] };
type MS = Map<string, { mu: number; sigma: number }>;

const AGIRLIK_DOSYA = "src/lib/methodology/weights/v546-1-saf-weights.json";
const SEG_B_DOSYA = "src/lib/methodology/weights/v546-1-saf-segment-dusuk-deneyim-acc.json";
const BASE = ["idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani", "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED", "PS_front", "PS_lone", "PS_closerFit", "jokeyFormuGenel"];
const YENI = [...BASE, "jokeyPIT", "antrenorPIT", "galopKalite", "lastWon"];

const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const bul = (r: Satir["runners"][number], ad: string) => r.sinyaller.find((s) => s.ad === ad);
const setSig = (r: Satir["runners"][number], s: Sig) => { const i = r.sinyaller.findIndex((x) => x.ad === s.ad); if (i >= 0) r.sinyaller[i] = s; else r.sinyaller.push(s); };

function muSigma(train: Satir[], ad: string) {
  let s = 0, n = 0; for (const r of train) for (const x of r.runners) { const g = bul(x, ad); if (g?.observed && g.raw != null) { s += g.raw; n++; } }
  const mu = n ? s / n : 0; let s2 = 0;
  for (const r of train) for (const x of r.runners) { const g = bul(x, ad); if (g?.observed && g.raw != null) s2 += (g.raw - mu) ** 2; }
  return { mu, sigma: n ? Math.sqrt(s2 / n) || 1 : 1 };
}
const vek = (x: Satir["runners"][number], f: string[], ms: MS) => f.map((ad) => { const g = bul(x, ad); if (!g?.observed || g.raw == null) return 0; const q = ms.get(ad)!; return g.reliability * (g.raw - q.mu) / q.sigma; });
function egit(train: Satir[], f: string[], ms: MS): number[] {
  const d = f.length;
  const X = train.map((r) => ({ x: r.runners.map((x) => vek(x, f, ms)), w: r.runners.findIndex((x) => x.kazandi) })).filter((q) => q.w >= 0);
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of X) {
      const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i] * w[i]; return s; }));
      for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k] += c * q.x[i][k]; }
    }
    for (let k = 0; k < d; k++) { const gk = g[k] / X.length + 0.02 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
  }
  return Array.from(w);
}
function degerlendir(set: Satir[], skor: (x: Satir["runners"][number]) => number) {
  let t1 = 0, t3 = 0, ll = 0, n = 0;
  for (const r of set) {
    const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue;
    const p = softmax(r.runners.map(skor)); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
    if (sr[0].i === kz) t1++; if (sr.slice(0, 3).some((q) => q.i === kz)) t3++; ll += -Math.log(Math.max(p[kz], 1e-15)); n++;
  }
  return { n, top1: n ? t1 / n : 0, top3: n ? t3 / n : 0, logLoss: n ? ll / n : 0 };
}

type Ev = { t: number[]; cum: number[] };
const evKur = (list: { t: number; won: number }[]): Ev => { list.sort((a, b) => a.t - b.t); const cum = [0]; for (const x of list) cum.push(cum[cum.length - 1] + x.won); return { t: list.map((x) => x.t), cum }; };
const bisect = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };

async function main() {
  const d16 = JSON.parse(fs.readFileSync("C:/tmp/saf-model-egitim-verisi-16ozellik.json", "utf8")) as Satir[];
  const d18 = JSON.parse(fs.readFileSync("C:/tmp/saf18-model-egitim-verisi.json", "utf8")) as Satir[];

  // ── Meta: runner → tjk/jokey/antrenör; yarış → mesafe/pist/sınıf ──
  const tumRunnerId = [...new Set(d18.flatMap((r) => r.runners.map((x) => x.runnerId)))];
  const meta = new Map<string, { jockey: string | null; trainer: string | null; tjk: number | null; hp: number | null; kilo: number | null }>();
  for (let i = 0; i < tumRunnerId.length; i += 3000) { await new Promise((r) => setTimeout(r, 600)); for (const x of await db.runner.findMany({ where: { id: { in: tumRunnerId.slice(i, i + 3000) } }, select: { id: true, jockey: true, trainer: true, tjkAtId: true, hp: true, weight: true } })) meta.set(x.id, { jockey: x.jockey, trainer: x.trainer, tjk: x.tjkAtId, hp: x.hp, kilo: x.weight }); }
  const raceMeta = new Map((await db.race.findMany({ where: { id: { in: d18.map((r) => r.raceId) } }, select: { id: true, distance: true, surface: true, classType: true } })).map((r) => [r.id, r]));
  for (const r of d18) r.classType = raceMeta.get(r.raceId)?.classType;

  // ── ACC özelliklerini YUMUŞAK yüzey kuralıyla arşivden yeniden üret (canlı motorla AYNI çağrılar) ──
  console.log("Accurace arşivi yükleniyor...");
  const runs = await accuraceKosulari();
  const byTjk = new Map<number, typeof runs>();
  for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }
  const baselineAt = makeBaselineCache(runs), closingBaselineAt = makeClosingBaselineCache(runs);
  const accYeni = new Map<string, { cr: Sig; la: Sig; sp: Sig }>();
  for (const race of d18) {
    const rm = raceMeta.get(race.raceId); if (!rm) continue;
    const target = { date: new Date(race.tarih + "T00:00:00.000Z"), length: rm.distance, surface: (rm.surface === "CIM" || rm.surface === "KUM" || rm.surface === "SENTETIK" ? rm.surface : null) as Surface | null };
    for (const x of race.runners) {
      const tjk = meta.get(x.runnerId)?.tjk;
      const g = tjk != null ? (byTjk.get(tjk) ?? []) : [];
      const cr = closingResidual(g, target, closingBaselineAt), la = lateSegmentSpeed(g, target), sp = speedResidual(g, target, baselineAt);
      accYeni.set(x.runnerId, {
        cr: { ad: "ACC_CLOSE_RES", raw: cr.observed ? cr.raw : null, observed: cr.observed, reliability: cr.reliability },
        la: { ad: "ACC_LATE", raw: la.observed ? la.raw : null, observed: la.observed, reliability: la.reliability },
        sp: { ad: "ACC_SPEED", raw: sp.observed ? sp.raw : null, observed: sp.observed, reliability: sp.reliability },
      });
    }
  }

  // ── PIT geçmiş endeksi (pit-seviye.actions.ts ile AYNI mantık, tek toplu okuma) ──
  console.log("PIT geçmiş yükleniyor...");
  const jL = new Map<string, { t: number; won: number }[]>(), tL = new Map<string, { t: number; won: number }[]>(), hL = new Map<number, { t: number; won: number }[]>();
  const hpL = new Map<number, { t: number; hp: number | null; kilo: number | null }[]>();
  const ajL = new Map<string, { t: number; won: number }[]>();
  let toplam = 0, kaz = 0, cursor: string | undefined;
  for (;;) {
    const batch = await db.runner.findMany({
      where: { scratched: false, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
      select: { id: true, no: true, jockey: true, trainer: true, tjkAtId: true, hp: true, weight: true, race: { select: { raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } },
      orderBy: { id: "asc" }, take: 10000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const b of batch) {
      const t = b.race.raceDay.date.getTime(), won = b.race.result?.winnerNos.includes(b.no) ? 1 : 0; toplam++; kaz += won;
      if (b.jockey) (jL.get(b.jockey) ?? jL.set(b.jockey, []).get(b.jockey)!).push({ t, won });
      if (b.trainer) (tL.get(b.trainer) ?? tL.set(b.trainer, []).get(b.trainer)!).push({ t, won });
      if (b.tjkAtId != null) (hL.get(b.tjkAtId) ?? hL.set(b.tjkAtId, []).get(b.tjkAtId)!).push({ t, won });
      if (b.tjkAtId != null) (hpL.get(b.tjkAtId) ?? hpL.set(b.tjkAtId, []).get(b.tjkAtId)!).push({ t, hp: b.hp, kilo: b.weight });
      if (b.tjkAtId != null && b.jockey) { const ak = b.tjkAtId + "|" + b.jockey; (ajL.get(ak) ?? ajL.set(ak, []).get(ak)!).push({ t, won }); }
    }
    cursor = batch[batch.length - 1].id;
    await new Promise((r) => setTimeout(r, 600));
  }
  for (const v of hpL.values()) v.sort((a, b) => a.t - b.t);
  // Atın t'den ÖNCEKİ son (null olmayan) HP / kilo değeri (point-in-time)
  const oncekiDeger = (tjk: number | null | undefined, t: number, alan: "hp" | "kilo"): number | null => {
    if (tjk == null) return null; const v = hpL.get(tjk); if (!v) return null;
    for (let i = bisect(v.map((x) => x.t), t) - 1; i >= 0; i--) if (v[i][alan] != null) return v[i][alan];
    return null;
  };
  const ajEv = new Map([...ajL].map(([k, v]) => [k, evKur(v)]));
  const jEv = new Map([...jL].map(([k, v]) => [k, evKur(v)])), tEv = new Map([...tL].map(([k, v]) => [k, evKur(v)])), hEv = new Map([...hL].map(([k, v]) => [k, evKur(v)]));
  const genel = kaz / toplam;
  const seviye = (ev: Ev | undefined, t: number): number | null => { if (!ev) return null; const hi = bisect(ev.t, t), lo = bisect(ev.t, t - 365 * 86400000); const rd = hi - lo; return rd <= 0 ? null : (((ev.cum[hi] - ev.cum[lo]) + 20 * genel) / (rd + 20)) * 100; };

  const galopOf = new Map<string, Sig | undefined>();
  for (const r of d18) for (const x of r.runners) galopOf.set(x.runnerId, bul(x, "galopKalite"));

  // ── Varsayılan veri kümesini kur: B0(SERT, mevcut canlı) ve YENİ ──
  const sirali = [...d16].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const eskiAcc = new Map<string, Sig[]>();
  for (const r of sirali) for (const x of r.runners) eskiAcc.set(x.runnerId, ["ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED"].map((a) => bul(x, a)!));
  const ort = (a: number[]) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
  const akim = (yeniAcc: boolean) => sirali.map((r) => { const hpOrt = ort(r.runners.map((x) => meta.get(x.runnerId)?.hp).filter((v): v is number => v != null)), kiloOrt = ort(r.runners.map((x) => meta.get(x.runnerId)?.kilo).filter((v): v is number => v != null)); return ({ ...r, runners: r.runners.map((x) => {
    const c: Satir["runners"][number] = { ...x, sinyaller: x.sinyaller.map((s) => ({ ...s })) };
    const t = new Date(r.tarih + "T00:00:00.000Z").getTime(), m = meta.get(x.runnerId);
    // Handikap sinyalleri (yalnız hp dolu koşularda gözlemli; diğer koşularda "veri yok" = sıfır katkı)
    const hpVar = m?.hp != null && hpOrt != null, kiloVar = m?.kilo != null && kiloOrt != null;
    setSig(c, { ad: "hpRel", raw: hpVar ? m!.hp! - hpOrt! : null, observed: hpVar, reliability: 1 });
    setSig(c, { ad: "kiloRel", raw: kiloVar ? m!.kilo! - kiloOrt! : null, observed: kiloVar, reliability: 1 });
    const oncekiHp = oncekiDeger(m?.tjk, t, "hp"), oncekiKilo = oncekiDeger(m?.tjk, t, "kilo");
    setSig(c, { ad: "hpDelta", raw: m?.hp != null && oncekiHp != null ? m.hp - oncekiHp : null, observed: m?.hp != null && oncekiHp != null, reliability: 1 });
    setSig(c, { ad: "kiloDelta", raw: m?.kilo != null && oncekiKilo != null ? m.kilo - oncekiKilo : null, observed: m?.kilo != null && oncekiKilo != null, reliability: 1 });
    if (yeniAcc) { const a = accYeni.get(x.runnerId); if (a) { setSig(c, a.cr); setSig(c, a.la); setSig(c, a.sp); } }
    setSig(c, { ad: "jokeyPIT", raw: seviye(m?.jockey ? jEv.get(m.jockey) : undefined, t), observed: seviye(m?.jockey ? jEv.get(m.jockey) : undefined, t) != null, reliability: 1 });
    setSig(c, { ad: "antrenorPIT", raw: seviye(m?.trainer ? tEv.get(m.trainer) : undefined, t), observed: seviye(m?.trainer ? tEv.get(m.trainer) : undefined, t) != null, reliability: 1 });
    const hev = m?.tjk != null ? hEv.get(m.tjk) : undefined; const hi = hev ? bisect(hev.t, t) : 0;
    setSig(c, hev && hi > 0 ? { ad: "lastWon", raw: hev.cum[hi] - hev.cum[hi - 1], observed: true, reliability: 1 } : { ad: "lastWon", raw: null, observed: false, reliability: 1 });
    const g = galopOf.get(x.runnerId); setSig(c, g ? { ad: "galopKalite", raw: g.raw, observed: g.observed, reliability: 1 } : { ad: "galopKalite", raw: null, observed: false, reliability: 1 });
    return c;
  }) }); });
  const veriYum = akim(true);
  void eskiAcc;

  // ── 5 kat genişleyen pencere CV ──
  const gunler = [...new Set(sirali.map((s) => s.tarih))].sort();
  const kesim = [0.4, 0.52, 0.64, 0.76, 0.88].map((q) => gunler[Math.floor(gunler.length * q)]);
  const YENI22 = [...YENI, "hpRel", "kiloRel"];

  // ═══ Aday ham alanlar (Runner program alanları; yarış öncesi bilinen) ═══
  const tumIds = veriYum.flatMap((r) => r.runners.map((x) => x.runnerId));
  const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
  const ex = new Map<string, { age: string | null; weight: number | null; recentForm: string | null; recentFormSurfaces: string | null; equipment: string | null; apprentice: boolean; jockeyChanged: boolean; sameJockey: boolean; startNo: number | null; tjkKgs: number | null }>();
  for (let i = 0; i < tumIds.length; i += 3000) { await new Promise((r) => setTimeout(r, 600)); for (const x of await db.runner.findMany({ where: { id: { in: tumIds.slice(i, i + 3000) } }, select: { id: true, age: true, weight: true, recentForm: true, recentFormSurfaces: true, equipment: true, apprentice: true, jockeyChanged: true, sameJockey: true, startNo: true, tjkKgs: true } })) ex.set(x.id, x); }
  const pos = (c: string) => (c >= "1" && c <= "9" ? +c : c === "0" ? 10 : null);
  for (const r of veriYum) {
    const rm = raceMeta.get(r.raceId); const surfCh = rm?.surface === "CIM" ? "C" : rm?.surface === "KUM" ? "K" : rm?.surface === "SENTETIK" ? "S" : "";
    const wts = r.runners.map((x) => ex.get(x.runnerId)?.weight).filter((v): v is number => v != null), wm = wts.length ? avg(wts) : null;
    const sts = r.runners.map((x) => ex.get(x.runnerId)?.startNo).filter((v): v is number => v != null), sm = sts.length ? avg(sts) : null;
    for (const x of r.runners) {
      const e = ex.get(x.runnerId);
      const S = (ad: string, raw: number | null | undefined) => setSig(x, { ad, raw: raw ?? null, observed: raw != null && Number.isFinite(raw), reliability: 1 });
      const rf = e?.recentForm ?? ""; const ps = [0, 1, 2, 3, 4, 5].map((i) => (i < rf.length ? pos(rf[i]) : null));
      ps.forEach((p, i) => S("fp" + (i + 1), p));
      const kn = ps.filter((p): p is number => p != null);
      S("fMean", kn.length ? avg(kn) : null); S("fWins", kn.length ? kn.filter((p) => p === 1).length : null); S("fTop3", kn.length ? kn.filter((p) => p <= 3).length : null);
      const tk = (e?.age ?? "").trim().split(/\s+/); S("ageN", parseInt(tk[0]) || null); S("sexE", tk[2] ? (tk[2] === "e" ? 1 : 0) : null); S("sexA", tk[2] ? (tk[2] === "a" ? 1 : 0) : null);
      S("wtRel", e?.weight != null && wm != null ? e.weight - wm : null); S("startRel", e?.startNo != null && sm != null ? e.startNo - sm : null);
      S("apprentice", e ? (e.apprentice ? 1 : 0) : null); S("jockeyChanged", e ? (e.jockeyChanged ? 1 : 0) : null); S("sameJockey", e ? (e.sameJockey ? 1 : 0) : null);
      S("kgsLog", e?.tjkKgs != null ? Math.log1p(e.tjkKgs) : null);
      { const yn = parseInt(tk[0]) || null; S("sexM", tk[2] ? (["e", "a", "g"].includes(tk[2]) ? 1 : 0) : null); S("age5p", yn != null ? (yn >= 5 ? 1 : 0) : null);
        const m2 = meta.get(x.runnerId), tt = new Date(r.tarih + "T00:00:00.000Z").getTime();
        const hev2 = m2?.tjk != null ? hEv.get(m2.tjk) : undefined, hi2 = hev2 ? bisect(hev2.t, tt) : 0;
        S("kStarts", m2?.tjk != null ? hi2 : null); S("kWinRate", hev2 && hi2 >= 3 ? hev2.cum[hi2] / hi2 : null);
        const aev = m2?.tjk != null && m2?.jockey ? ajEv.get(m2.tjk + "|" + m2.jockey) : undefined, ai = aev ? bisect(aev.t, tt) : 0;
        S("ajRides", m2?.tjk != null && m2?.jockey ? ai : null); S("ajWins", m2?.tjk != null && m2?.jockey ? (aev ? aev.cum[ai] : 0) : null); }
      const sf = (e?.recentFormSurfaces ?? "").split("").filter((c) => "CKS".includes(c)); S("surfMatch", sf.length && surfCh ? sf.filter((c) => c === surfCh).length / sf.length : null);
      S("eqN", e?.equipment ? e.equipment.split(",").filter(Boolean).length : 0);
    }
  }
  const FORM = ["fp1", "fp2", "fp3", "fp4", "fp5", "fp6", "fMean", "fWins", "fTop3"], STAT = ["ageN", "sexE", "sexA", "wtRel", "startRel"], FLAG = ["apprentice", "jockeyChanged", "sameJockey"], DIG = ["kgsLog", "surfMatch", "eqN"];
  const CANDS = [...FORM, ...STAT, ...FLAG, ...DIG]; const F22 = YENI22;
  const grupOf = (id: string) => { const c = (raceMeta.get(id)?.classType ?? "").toUpperCase(); if (c.includes("HANDIKAP")) return 0; if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return 3; if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return 4; if (c.includes("ŞARTLI") || c.includes("SARTLI")) return 1; return 2; };
  const GN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
  // doluluk raporu (canlıda da dolu olacak mı?)
  { const n = veriYum.reduce((p, r) => p + r.runners.length, 0); console.log("DOLULUK (gözlemli at oranı): " + CANDS.map((c) => { let o = 0; for (const r of veriYum) for (const x of r.runners) if (bul(x, c)?.observed) o++; return c + " %" + (o / n * 100).toFixed(0); }).join(" | ")); }

  type RS = { ll: number; t1: number; t3: number; fold: number };
  const kosu = (fs2: string[], folds: number[]) => {
    const out = new Map<string, RS>();
    for (const k of folds) {
      const bas = kesim[k], bit = k === 4 ? "9999" : kesim[k + 1];
      const train = veriYum.filter((x) => x.tarih < bas), test = veriYum.filter((x) => x.tarih >= bas && x.tarih < bit);
      const ms: MS = new Map(fs2.map((x) => [x, muSigma(train, x)])); const b = egit(train, fs2, ms);
      for (const r of test) {
        const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue;
        const p = softmax(r.runners.map((x) => { const v = vek(x, fs2, ms); let t = 0; for (let i = 0; i < v.length; i++) t += v[i] * b[i]; return t; }));
        const sr = p.map((v, i) => ({ i, v })).sort((a, b2) => b2.v - a.v);
        out.set(r.raceId, { ll: -Math.log(Math.max(p[kz], 1e-15)), t1: sr[0].i === kz ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === kz) ? 1 : 0, fold: k });
      }
    }
    return out;
  };
  let seed = 101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ciOf = (dif: number[]) => { const n = dif.length; const bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49], hi: bs[1949] }; };
  const dl = (m: Map<string, RS>, baz: Map<string, RS>) => { const ids = [...baz.keys()]; return ciOf(ids.map((id) => m.get(id)!.ll - baz.get(id)!.ll)); };
  const ozet = (m: Map<string, RS>) => { const v = [...m.values()]; return "Top1 %" + (avg(v.map((x) => x.t1)) * 100).toFixed(1) + " | Top3 %" + (avg(v.map((x) => x.t3)) * 100).toFixed(1) + " | LL " + avg(v.map((x) => x.ll)).toFixed(4); };

  // ═══════════════ ADAY SİNYAL SINAMASI — SALT-OKUMA (hiçbir ağırlık/dosya yazılmaz) ═══════════════
  // Protokol motorun 13 Kasım ileri-seçimiyle AYNI: 5 kat genişleyen pencere zaman-CV; her aday TABANA TEK başına eklenir (bırak-bir değil,
  // ekle-bir); ΔLogLoss (negatif = iyileşme) + bootstrap %95 GA; DEV katları (0-2) ve BAĞIMSIZ SINAMA katları (3-4) ayrı raporlanır.
  // TABAN = bugün canlı olan 21 sinyalli varsayılan model (ölü 4 sinyal çıkarılmış).
  const OLU = ["idmJokey", "sonIdmanSprint", "takiDegisikligi", "PS_lone"];
  const LIVE21 = [...F22, "fMean", "kgsLog", "sexE"].filter((x) => !OLU.includes(x));
  const ROUTED = (id: string) => { const g = grupOf(id); return g === 0 || g === 1 || g === 2; };
  const ALL5 = [0, 1, 2, 3, 4];
  console.log("TABAN (canlı varsayılan): " + LIVE21.length + " sinyal: " + LIVE21.join(","));
  const base = kosu(LIVE21, ALL5);
  const idsAll = [...base.keys()], idsR = idsAll.filter(ROUTED);
  const dev = (ids: string[]) => ids.filter((id) => base.get(id)!.fold <= 2), conf = (ids: string[]) => ids.filter((id) => base.get(id)!.fold >= 3);
  const fk = (ids: string[], m: Map<string, RS>) => { const c = ciOf(ids.map((id) => m.get(id)!.ll - base.get(id)!.ll)); return (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + "," + c.hi.toFixed(4) + "]" + (c.hi < 0 ? " ✔" : c.lo > 0 ? " ✘" : ""); };
  console.log("test yarışı: tüm " + idsAll.length + " | varsayılan modele giden " + idsR.length + " | DEV " + dev(idsAll).length + " | SINAMA(kat 3-4) " + conf(idsAll).length);
  const ADAY: { ad: string; set: string[]; not: string }[] = [
    { ad: "+ sexM (erkek: e|a|g)", set: [...LIVE21, "sexM"], not: "sexE'ye EK" },
    { ad: "sexE → sexM (DEĞİŞTİR)", set: LIVE21.map((x) => (x === "sexE" ? "sexM" : x)), not: "aygırı dişiyle aynı saymaz" },
    { ad: "+ ageN (yaş)", set: [...LIVE21, "ageN"], not: "sayısal yaş" },
    { ad: "+ age5p (5 yaş ve üstü)", set: [...LIVE21, "age5p"], not: "5y+ rastgeleden %24 az kazanıyor" },
    { ad: "+ kWinRate (kariyer kazanma%, ≥3 start)", set: [...LIVE21, "kWinRate"], not: "sitenin kendi geçmişi" },
    { ad: "+ kStarts (kariyer start sayısı)", set: [...LIVE21, "kStarts"], not: "tecrübe" },
    { ad: "+ ajWins (at+jokey: bu jokeyle kazanma)", set: [...LIVE21, "ajWins"], not: "Ankara K1 DEJAME" },
    { ad: "+ ajRides (at+jokey: bu jokeyle biniş)", set: [...LIVE21, "ajRides"], not: "" },
    { ad: "+ fWins (son 6'da kazanma sayısı)", set: [...LIVE21, "fWins"], not: "" },
    { ad: "+ fTop3 (son 6'da ilk3 sayısı)", set: [...LIVE21, "fTop3"], not: "" },
  ];
  const sonuc = new Map<string, Map<string, RS>>();
  for (const a of ADAY) {
    const m = kosu(a.set, ALL5); sonuc.set(a.ad, m);
    console.log(a.ad.padEnd(44) + " | DEV " + fk(dev(idsAll), m) + " | SINAMA(3-4) " + fk(conf(idsAll), m) + " | tüm 5 kat " + fk(idsAll, m) + (a.not ? "   // " + a.not : ""));
  }
  // Önceden sabit kural: DEV'de ΔLL ≤ -0.003 olan adaylar SEÇİLİR; seçilenlerin birlikte sınama katlarındaki durumu raporlanır.
  const secilen = ADAY.filter((a) => { const c = ciOf(dev(idsAll).map((id) => sonuc.get(a.ad)!.get(id)!.ll - base.get(id)!.ll)); return c.m <= -0.003; }).filter((a) => !a.ad.startsWith("sexE →"));
  console.log("\nDEV'de ΔLL ≤ -0.003 olan adaylar (önceden sabit eşik): " + (secilen.map((a) => a.ad).join(" ; ") || "YOK"));
  if (secilen.length) {
    const ek = [...new Set(secilen.flatMap((a) => a.set.filter((x) => !LIVE21.includes(x))))];
    const m = kosu([...LIVE21, ...ek], ALL5);
    console.log("BİRLİKTE [" + ek.join(",") + "] → DEV " + fk(dev(idsAll), m) + " | SINAMA(3-4) " + fk(conf(idsAll), m) + " | tüm 5 kat " + fk(idsAll, m));
    console.log("   " + ozet(base) + "  →  " + ozet(m));
  }
  console.log("\nDOLULUK: " + ["sexM", "age5p", "ageN", "kWinRate", "kStarts", "ajWins", "ajRides"].map((c) => { let o = 0, n = 0; for (const r of veriYum) for (const x of r.runners) { n++; if (bul(x, c)?.observed) o++; } return c + " %" + (o / n * 100).toFixed(0); }).join(" | "));
  process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
