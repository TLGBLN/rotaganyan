// Accurace özellikleri — saf hesaplar. Her ayar beyan edilir; sonuca göre ayarlanmaz.
import type { AccuraceRun, Feature, Surface, TargetRace } from "./types";

export const AYAR = {
  hlGun: 120, // recency yarı ömrü (gün)
  tauMesafe: 400, // mesafe benzerliği ölçeği (m)
  kRel: 2.0, // reliability shrink (efektif ağırlık)
  kapanisBaslangic: 0.5, // closing regresyonu için yarışın yüzde kaçı sonrası
  eps: 1e-6,
  lateKirp: 3, // lateScore uç değer kırpma sınırı (|z| ≤ 3): MAD küçük sahalarda z patlamasını önler
  // Yüzey: "SERT" → farklı yüzey 0 ağırlık; "YUMUSAK" → ağırlık YUZEY_YUMUSAK_W
  yuzeyModu: "YUMUSAK" as "SERT" | "YUMUSAK",
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

// Yarış içi closing eğimi: t = checkpoint/L (t ≥ 0.5) ve finiş (t = 1) noktalarında Q'ya OLS.
// Tek yarış değeri; yeterli nokta yoksa null.
export function closingSlope(run: AccuraceRun): number | null {
  const pts = run.checkpoints
    .filter((c) => c.checkpoint / run.length >= AYAR.kapanisBaslangic)
    .map((c) => ({ t: c.checkpoint / run.length, q: qualityOf(c.place, run.fieldSize) }));
  pts.push({ t: 1, q: qualityOf(run.place, run.fieldSize) });
  if (pts.length < 2) return null;
  const mt = pts.reduce((s, p) => s + p.t, 0) / pts.length;
  const mq = pts.reduce((s, p) => s + p.q, 0) / pts.length;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.t - mt) * (p.q - mq); den += (p.t - mt) ** 2; }
  return den > AYAR.eps ? num / den : null;
}

// Geri dönüş (fallback): tek noktada pozisyon kazancı, (pos_cp − finiş)/(n−1). Pozitif = sıra kazanmış.
export function positionGainFallback(run: AccuraceRun): number | null {
  if (run.fieldSize <= 1) return null;
  const hedef = run.length - Math.min(800, 0.5 * run.length);
  if (!run.checkpoints.length) return null;
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

// 1) closingConsistency: geçmiş closing eğimleri (yoksa fallback), ağırlıklı ortalama × reliability ayrı tutulur.
export function closingConsistency(runs: AccuraceRun[], target: TargetRace): Feature {
  const vals: { v: number; w: number }[] = [];
  for (const r of runs) {
    if (r.date >= target.date) continue; // as-of
    const days = (target.date.getTime() - r.date.getTime()) / 86400000;
    const w = recencyW(days) * mesafeW(r.length, target.length) * yuzeyW(r.surface, target.surface);
    if (w <= 0) continue;
    const s = closingSlope(r) ?? positionGainFallback(r);
    if (s == null) continue;
    vals.push({ v: s, w });
  }
  return weightedFeature(vals, "NO_USABLE_CHECKPOINTS");
}

// 2) lateSpeed: geçmiş yarış-içi late skorlarının ağırlıklı ortalaması (closing'den bağımsız).
export function lateSpeed(runs: AccuraceRun[], target: TargetRace): Feature {
  const vals: { v: number; w: number }[] = [];
  for (const r of runs) {
    if (r.date >= target.date) continue;
    if (r.lateScore == null) continue;
    const days = (target.date.getTime() - r.date.getTime()) / 86400000;
    const w = recencyW(days) * mesafeW(r.length, target.length) * yuzeyW(r.surface, target.surface);
    if (w <= 0) continue;
    const kirp = Math.max(-AYAR.lateKirp, Math.min(AYAR.lateKirp, r.lateScore));
    vals.push({ v: kirp, w });
  }
  return weightedFeature(vals, "NO_LATE800");
}

// 3) speedResidual: bağlam (yüzey, ±100 m) medyan pace'ine göre; pozitif = beklenenden hızlı.
export function speedResidual(
  runs: AccuraceRun[],
  target: TargetRace,
  contextPool: { pace100: number; surface: Surface | null; length: number; date: Date }[],
): Feature {
  const pool = contextPool
    .filter((p) => p.date < target.date && p.surface === target.surface && Math.abs(p.length - target.length) <= 100)
    .map((p) => p.pace100)
    .sort((a, b) => a - b);
  if (pool.length < 20) {
    return { raw: null, observed: false, reliability: 0, nUsed: 0, effectiveN: 0, missingReason: "NO_CONTEXT_BASELINE" };
  }
  const m = pool.length % 2 ? pool[(pool.length - 1) / 2] : (pool[pool.length / 2 - 1] + pool[pool.length / 2]) / 2;
  const vals: { v: number; w: number }[] = [];
  for (const r of runs) {
    if (r.date >= target.date) continue;
    if (r.surface !== target.surface || Math.abs(r.length - target.length) > 100) continue;
    const days = (target.date.getTime() - r.date.getTime()) / 86400000;
    const pace = (r.finishMs / 1000 / r.length) * 100;
    vals.push({ v: m - pace, w: recencyW(days) });
  }
  return weightedFeature(vals, "NO_PRIOR_RUN");
}
