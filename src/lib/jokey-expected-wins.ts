/**
 * Jokey expected wins: ADMIN-DISPLAY ONLY. No model scores, prediction writes,
 * rescue decision, or JockeyStatSync updates.
 * Probabilities derive from a *complete* pre-off AGF field. Not jockey-neutral.
 */
import { classifyEtkinFormDurum, reliability, K_REF_MIN_SAMPLE, type EtkinFormDurum } from "./jokey-form";

export type BinisOlasilik = { raceDate: Date; p: number; won: boolean };
export type HamBeklenti = { N: number; W: number; E: number; R: number; SE: number };
export type ReferansKademesi = "31-180" | "31-365" | "career-ex30" | "none";

export interface JokeyExpectedWinsForm {
  jockey: string;
  son30Start: number; // only pre-race-AGF-covered mounts
  son30Win: number;
  son30Expected: number;
  son30Residual: number;
  son30Se: number;
  total30Start: number; // all eligible recorded mounts, covered or not
  coverage30: number;
  refStart: number;
  refWin: number;
  refExpected: number;
  refResidual: number;
  refTier: ReferansKademesi;
  formDelta: number | null; // residual rates: 30d minus reference
  z: number | null; // approximate independent-Bernoulli contrast, descriptive only
  reliability: number; // N30/(N30+8), NOT a confidence probability
  etkinForm: number | null; // shrinkage-adjusted residual-rate difference
  durum: EtkinFormDurum | null;
}

const MS_DAY = 86_400_000;

export function hesaplaResidualIstatistik(mounts: readonly Pick<BinisOlasilik, "p" | "won">[]): HamBeklenti {
  let W = 0, E = 0, v = 0;
  for (const m of mounts) {
    if (!Number.isFinite(m.p) || m.p < 0 || m.p > 1) throw new Error("AGF olasiligi [0,1] araliginda olmali");
    W += m.won ? 1 : 0;
    E += m.p;
    v += m.p * (1 - m.p);
  }
  return { N: mounts.length, W, E, R: W - E, SE: Math.sqrt(v) };
}

/** No silent renormalization of an incomplete race. Strict field completeness plus a
 * wide 80–120% plausibility band (quality guard, NOT a fitted model threshold).
 * Returns null instead of fabricating a baseline from incomplete AGF snapshots. */
export function normalizeRaceAgf(
  field: readonly { runnerId: string; agf: number | null }[]
): Map<string, number> | null {
  if (field.length < 2 || field.some(f => f.agf == null || !Number.isFinite(f.agf) || f.agf < 0)) return null;
  const total = field.reduce((s, f) => s + f.agf!, 0);
  if (total < 80 || total > 120) return null;
  const result = new Map<string, number>();
  for (const f of field) {
    if (result.has(f.runnerId)) return null;
    result.set(f.runnerId, f.agf! / total);
  }
  return result;
}

/** RaceDay.date is stored as a UTC-midnight date representing the Turkish calendar
 * day; Race.time is a Turkish local scheduled off-time. Türkiye is UTC+03 in
 * the data period. If no reliable time exists, skip the race (no leakage). */
export function scheduledRaceCutoff(day: Date, time: string | null): Date | null {
  const matched = time?.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!matched) return null;
  const h = Number(matched[1]), minute = Number(matched[2]);
  if (h > 23 || minute > 59) return null;
  const date = day.toISOString().slice(0, 10);
  const result = new Date(date + "T" + String(h).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00+03:00");
  return Number.isFinite(result.getTime()) ? result : null;
}

export function secReferansBinisleri(
  rides: readonly BinisOlasilik[], asOfDate: Date
): { tier: ReferansKademesi; mounts: BinisOlasilik[] } {
  const age = (r: BinisOlasilik) => (asOfDate.getTime() - r.raceDate.getTime()) / MS_DAY;
  const older = rides.filter(r => age(r) > 30);
  const d180 = older.filter(r => age(r) <= 180);
  if (d180.length >= K_REF_MIN_SAMPLE) return { tier: "31-180", mounts: d180 };
  const d365 = older.filter(r => age(r) <= 365);
  if (d365.length >= K_REF_MIN_SAMPLE) return { tier: "31-365", mounts: d365 };
  if (older.length) return { tier: "career-ex30", mounts: older };
  return { tier: "none", mounts: [] };
}

export function hesaplaJokeyBeklentiFormu(
  jockey: string, rides: readonly BinisOlasilik[], asOfDate: Date, total30Start: number
): JokeyExpectedWinsForm {
  const age = (r: BinisOlasilik) => (asOfDate.getTime() - r.raceDate.getTime()) / MS_DAY;
  const recent = rides.filter(r => age(r) > 0 && age(r) <= 30);
  const s = hesaplaResidualIstatistik(recent);
  const ref = secReferansBinisleri(rides, asOfDate);
  const b = hesaplaResidualIstatistik(ref.mounts);
  const formDelta = s.N > 0 && b.N > 0 ? s.R / s.N - b.R / b.N : null;
  const denom = s.N > 0 && b.N > 0
    ? Math.sqrt((s.SE / s.N) ** 2 + (b.SE / b.N) ** 2) : 0;
  const z = formDelta != null && denom > 0 ? formDelta / denom : null;
  const rel = reliability(s.N);
  const etkinForm = formDelta == null ? null : formDelta * rel;
  return {
    jockey, son30Start: s.N, son30Win: s.W, son30Expected: s.E,
    son30Residual: s.R, son30Se: s.SE, total30Start,
    coverage30: total30Start > 0 ? s.N / total30Start : 0,
    refStart: b.N, refWin: b.W, refExpected: b.E,
    refResidual: b.R, refTier: ref.tier, formDelta, z,
    reliability: rel, etkinForm,
    durum: etkinForm == null ? null : classifyEtkinFormDurum(etkinForm * 100),
  };
}
