// RAN RCA: üç soy hattını her sonuçta birlikte gösterir.
// Saf görüntüleme/açıklama katmanı: eğitim, skor, sınıflandırma ve production değişmez.
import type { SignalEffectRow } from "@/lib/motor-v1/engine/training";

export const PEDIGREE_CODES = [
  { code: "SIRE_HISTORY", label: "BABA (SIRE)" },
  { code: "DAM_HISTORY", label: "ANNE (DAM)" },
  { code: "DAMSIRE_HISTORY", label: "ANNE BABASI (DAMSIRE)" },
] as const;

export type PedigreeCode = (typeof PEDIGREE_CODES)[number]["code"];

export type PedigreeEffect = {
  code: PedigreeCode;
  label: string;
  /** Sinyal raporda yoksa null; asla 0 uydurulmaz. */
  present: boolean;
  raw: number | null;
  observed: boolean;
  standardized: number | null;
  coefficient: number | null;
  /** Ana katkı ve eksiklik-göstergesi katkısı birlikte: açıklanan skora eklenen gerçek değer. */
  contribution: number | null;
  missingIndicatorContribution: number | null;
  coverageState: string | null;
  missingReason: string | null;
};

export type PedigreeComparison = {
  code: PedigreeCode;
  label: string;
  winner: PedigreeEffect;
  rival: PedigreeEffect;
  /** Rakip - kazanan; pozitifse rakibin sıralamasını bu kod destekler. */
  delta: number | null;
};

type Row = Pick<
  SignalEffectRow<string>,
  "code" | "rawValue" | "observed" | "standardizedValue" | "learnedCoefficient" |
  "scoreContribution" | "missingIndicatorContribution" | "coverageState"
>;

export function pedigreeEffects(
  rows: readonly Row[],
  missingReasons: ReadonlyMap<string, string | null> = new Map()
): PedigreeEffect[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return PEDIGREE_CODES.map(({ code, label }) => {
    const r = byCode.get(code);
    if (!r) return {
      code, label, present: false, raw: null, observed: false, standardized: null,
      coefficient: null, contribution: null, missingIndicatorContribution: null,
      coverageState: null, missingReason: "Bu model açıklamasında sinyal bulunamadı",
    };
    return {
      code, label, present: true, raw: r.rawValue, observed: r.observed,
      standardized: r.standardizedValue, coefficient: r.learnedCoefficient,
      contribution: r.scoreContribution + r.missingIndicatorContribution,
      missingIndicatorContribution: r.missingIndicatorContribution,
      coverageState: r.coverageState,
      missingReason: r.observed ? null : (missingReasons.get(code) ?? "Gözlem bulunamadı"),
    };
  });
}

export function comparePedigreeEffects(
  winner: readonly PedigreeEffect[],
  rival: readonly PedigreeEffect[]
): PedigreeComparison[] {
  const winByCode = new Map(winner.map((x) => [x.code, x]));
  const rivalByCode = new Map(rival.map((x) => [x.code, x]));
  return PEDIGREE_CODES.map(({ code, label }) => {
    const w = winByCode.get(code);
    const r = rivalByCode.get(code);
    if (!w || !r) throw new Error(`RAN RCA pedigree: karşılaştırma için ${code} satırı eksik`);
    return {
      code, label, winner: w, rival: r,
      delta: w.contribution === null || r.contribution === null
        ? null : r.contribution - w.contribution,
    };
  });
}
