// Accurace özellikleri — saf hesaplar. Her ayar beyan edilir; sonuca göre ayarlanmaz.
import type { AccuraceRun, Feature, StyleFeature, Surface, TargetRace } from "./types";

export const AYAR = {
  hlGun: 120, // recency yarı ömrü (gün)
  tauMesafe: 400, // mesafe benzerliği ölçeği (m)
  kRel: 2.0, // reliability shrink (efektif ağırlık). Yalnız training-içi duyarlılık için {1,2,4}; test sonucuna göre seçilmez
  kapanisBaslangic: 0.5, // closing regresyonu: yarışın bu oranı sonrası
  kapanisBitis: 0.999, // bu eşiğin üstündeki checkpoint'ler atılır, finiş bir kez eklenir
  eps: 1e-6,
  lateKirp: 3, // lateSegScore son koruma kırpması (|z| ≤ 3)
  lateMinN: 5, // geç segment robust z için asgari gözlemli at sayısı
  lateMadMinMs: 20, // MAD bu eşiğin (ms) altındaysa robust z hesaplanmaz → NO_LATE_SCALE
  baseMinN: 20, // beklenen pace tabanı için asgari kayıt sayısı
  stilAlpha: 1, // stil vektörü Dirichlet benzeri prior gücü (düzgün dağılıma çekim)
  stilErkenOran: 0.25, // stil ölçümü: yarışın bu oranındaki checkpoint
  // Yüzey: "SERT" → sameSurface=1, differentSurface=0 (ilk temiz sürüm). "YUMUSAK" yalnız duyarlılık için.
  yuzeyModu: "SERT" as "SERT" | "YUMUSAK",
  yuzeyYumusakW: 0.5,
} as const;

export function recencyW(gunFarki: number, hl = AYAR.hlGun): number {
  return Math.pow(0.5, Math.max(0, gunFarki) / hl);
}

export function mesafeW(pastL: number, targetL: number, tau = AYAR.tauMesafe): number {
  return Math.exp(-Math.abs(pastL - targetL) / tau);
}

export function yuzeyW(past: Surface | null, target: Surface | null): number {
  if (past == null || target == null) return AYAR.yuzeyModu === "SERT" ? 0 : AYAR.yuzeyYumusakW;
  if (past === target) return 1;
  return AYAR.yuzeyModu === "SERT" ? 0 : AYAR.yuzeyYumusakW;
}

// Reliability: efektif ağırlık / (efektif ağırlık + k)
export function reliability(effectiveN: number, k = AYAR.kRel): number {
  return effectiveN <= 0 ? 0 : effectiveN / (effectiveN + k);
}

// Pozisyon → [0,1] kalite (lider 1, son 0)
export function qualityOf(place: number, fieldSize: number): number {
  if (fieldSize <= 1) return 0.5;
  return 1 - (place - 1) / (fieldSize - 1);
}

// LateSegmentLength = min(800, 0.5·D). Geç segmentin başladığı nominal mesafe: D − LateSegmentLength.
export function lateSegmentLength(L: number): number {
  return Math.min(800, 0.5 * L);
}

function days(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000;
}

// Yarış içi closing eğimi: t = checkpoint/L ∈ [0.5, 0.999) ve finiş (t = 1, bir kez) noktalarında Q'ya OLS.
// Yeterli nokta yoksa null.
export function closingSlope(run: AccuraceRun): number | null {
  const pts = run.checkpoints
    .map((c) => ({ t: c.checkpoint / run.length, q: qualityOf(c.place, run.fieldSize) }))
    .filter((p) => p.t >= AYAR.kapanisBaslangic && p.t < AYAR.kapanisBitis);
  pts.push({ t: 1, q: qualityOf(run.place, run.fieldSize) });
  if (pts.length < 2) return null;
  const mt = pts.reduce((s, p) => s + p.t, 0) / pts.length;
  const mq = pts.reduce((s, p) => s + p.q, 0) / pts.length;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.t - mt) * (p.q - mq); den += (p.t - mt) ** 2; }
  return den > AYAR.eps ? num / den : null;
}

// Geri dönüş (fallback): nominal geç-segment noktasında pozisyon kazancı, (pos_cp − finiş)/(n−1). Pozitif = sıra kazanmış.
export function positionGainFallback(run: AccuraceRun): number | null {
  if (run.fieldSize <= 1 || !run.checkpoints.length) return null;
  const hedef = run.length - lateSegmentLength(run.length);
  const yakin = run.checkpoints.reduce((b, c) => (Math.abs(c.checkpoint - hedef) < Math.abs(b.checkpoint - hedef) ? c : b));
  return (yakin.place - run.place) / (run.fieldSize - 1);
}

// Ağırlıklı özellik aggregator (as-of geçmiş üzerinde)
export function weightedFeature(
  values: { v: number; w: number }[],
  reason: Feature["missingReason"] = null,
): Feature {
  const n = values.length;
  const sw = values.reduce((s, x) => s + x.w, 0);
  if (sw <= AYAR.eps) {
    return { raw: null, observed: false, reliability: 0, nUsed: n, effectiveN: 0, missingReason: reason ?? "NO_PRIOR_RUN" };
  }
  const raw = values.reduce((s, x) => s + x.w * x.v, 0) / sw;
  return { raw, observed: true, reliability: reliability(sw), nUsed: n, effectiveN: sw, missingReason: null };
}

// Geçmiş koşuların ağırlığı: recency × mesafe × yüzey (yüzey SERT modda 0/1)
function gecmisW(r: AccuraceRun, target: TargetRace): number {
  return recencyW(days(r.date, target.date)) * mesafeW(r.length, target.length) * yuzeyW(r.surface, target.surface);
}

// 1) closingConsistency: geçmiş closing eğimleri (yoksa nominal-nokta fallback), ağırlıklı ortalama.
export function closingConsistency(runs: AccuraceRun[], target: TargetRace): Feature {
  const vals: { v: number; w: number }[] = [];
  for (const r of runs) {
    if (r.date >= target.date) continue; // as-of
    const w = gecmisW(r, target);
    if (w <= 0) continue;
    const s = closingSlope(r) ?? positionGainFallback(r);
    if (s == null) continue;
    vals.push({ v: s, w });
  }
  return weightedFeature(vals, "NO_USABLE_CHECKPOINTS");
}

// 2) lateSegmentSpeed: geçmiş yarışlardaki geç-segment skorlarının ağırlıklı ortalaması.
// Skor yalnız ORTAK race checkpoint'ten ve yeterli saha/MAD varsa vardır; yoksa o koşu atlanır.
export function lateSegmentSpeed(runs: AccuraceRun[], target: TargetRace): Feature {
  const vals: { v: number; w: number }[] = [];
  for (const r of runs) {
    if (r.date >= target.date) continue;
    if (r.lateSegScore == null) continue;
    const w = gecmisW(r, target);
    if (w <= 0) continue;
    vals.push({ v: Math.max(-AYAR.lateKirp, Math.min(AYAR.lateKirp, r.lateSegScore)), w });
  }
  return weightedFeature(vals, "NO_LATE_SEG");
}

// 3) Beklenen pace tabanı. Koşunun KENDİ bağlamı için: Breed × Surface × DistanceBand [× Hipodrom × Zemin].
// Yalnız tarihi hedef yarıştan önce olan kayıtlar nüfusa girer (as-of).
export function bandOf(L: number): "S" | "M" | "L" {
  return L <= 1400 ? "S" : L <= 2000 ? "M" : "L";
}

export function paceOf(r: AccuraceRun): number {
  return (r.finishMs / 1000) / r.length * 100; // sn / 100 m
}

export function baseKeys(r: Pick<AccuraceRun, "breed" | "surface" | "length" | "hippodrome" | "going">): { k1: string | null; k2: string | null } {
  if (!r.breed || !r.surface) return { k1: null, k2: null };
  const k2 = `${r.breed}|${r.surface}|${bandOf(r.length)}`;
  const k1 = r.hippodrome && r.going ? `${k2}|${r.hippodrome}|${r.going}` : null;
  return { k1, k2 };
}

export type Baseline = Map<string, { med: number; n: number }>;

function medyan(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildBaseline(population: AccuraceRun[], asOf: Date): Baseline {
  const g = new Map<string, number[]>();
  for (const r of population) {
    if (r.date >= asOf) continue;
    const { k1, k2 } = baseKeys(r);
    const p = paceOf(r);
    for (const k of [k1, k2]) {
      if (k == null) continue;
      const a = g.get(k);
      if (a) a.push(p); else g.set(k, [p]);
    }
  }
  const out: Baseline = new Map();
  for (const [k, a] of g) out.set(k, { med: medyan(a), n: a.length });
  return out;
}

// Her hedef tarih için bir kez kurulur (aynı gün yarışları paylaşır).
export function makeBaselineCache(population: AccuraceRun[]): (asOf: Date) => Baseline {
  const memo = new Map<number, Baseline>();
  return (asOf) => {
    const t = asOf.getTime();
    let b = memo.get(t);
    if (!b) { b = buildBaseline(population, asOf); memo.set(t, b); }
    return b;
  };
}

// Koşunun beklenen pace'i: önce tam bağlam (k1), yetmezse Breed×Surface×Band (k2); ikisi de yetmezse null.
export function expectedPace(r: AccuraceRun, table: Baseline): { v: number; level: 1 | 2 } | null {
  const { k1, k2 } = baseKeys(r);
  const b1 = k1 ? table.get(k1) : undefined;
  if (b1 && b1.n >= AYAR.baseMinN) return { v: b1.med, level: 1 };
  const b2 = k2 ? table.get(k2) : undefined;
  if (b2 && b2.n >= AYAR.baseMinN) return { v: b2.med, level: 2 };
  return null;
}

// 4) speedResidual: her geçmiş koşunun KENDİ bağlamına göre beklenen pace'ten sapması (+ = beklenenden hızlı).
export function speedResidual(history: AccuraceRun[], target: TargetRace, baselineAt: (d: Date) => Baseline): Feature {
  const table = baselineAt(target.date);
  const vals: { v: number; w: number }[] = [];
  for (const r of history) {
    if (r.date >= target.date) continue;
    const w = gecmisW(r, target);
    if (w <= 0) continue;
    const e = expectedPace(r, table);
    if (!e) continue;
    vals.push({ v: e.v - paceOf(r), w });
  }
  return weightedFeature(vals, "NO_BASELINE");
}

// 5) StyleVector: H_i = [kaçak, ön, takip, orta, bekle, geri] — geçmiş ilk-çeyrek sıra kovalarının ağırlıklı,
// düzgün prior'a çekilmiş olasılık dağılımı. Yüzeyden bağımsız (stil yüzeyle değişmez varsayımı beyan edilir).
export const STIL_K = 6;
export function styleVector(history: AccuraceRun[], target: TargetRace): StyleFeature {
  const bins = new Array<number>(STIL_K).fill(0);
  let sw = 0;
  for (const r of history) {
    if (r.date >= target.date || r.earlyBin == null) continue;
    const w = recencyW(days(r.date, target.date)) * mesafeW(r.length, target.length);
    if (w <= 0) continue;
    bins[r.earlyBin] += w;
    sw += w;
  }
  if (sw <= AYAR.eps) return { vec: null, observed: false, reliability: 0, effectiveN: 0, missingReason: "NO_STYLE_HISTORY" };
  const vec = bins.map((b) => (b + AYAR.stilAlpha / STIL_K) / (sw + AYAR.stilAlpha));
  return { vec, observed: true, reliability: reliability(sw), effectiveN: sw, missingReason: null };
}

// 6) Rakip baskısı: F_{-i} = Σ_{j≠i} H_j (yalnız gözlemli rakipler). Eksik rakip sayısı açıkça raporlanır.
export function rivalPressure(rivals: StyleFeature[]): { vec: number[] | null; nObserved: number; nMissing: number } {
  const acc = new Array<number>(STIL_K).fill(0);
  let nObs = 0, nMiss = 0;
  for (const s of rivals) {
    if (!s.observed || !s.vec) { nMiss++; continue; }
    nObs++;
    for (let k = 0; k < STIL_K; k++) acc[k] += s.vec[k];
  }
  return { vec: nObs > 0 ? acc : null, nObserved: nObs, nMissing: nMiss };
}
