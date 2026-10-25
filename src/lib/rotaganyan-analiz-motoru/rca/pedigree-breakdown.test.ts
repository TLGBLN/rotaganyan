import { describe, expect, it } from "vitest";
import { comparePedigreeEffects, pedigreeEffects, PEDIGREE_CODES } from "./pedigree-breakdown";
import type { SignalEffectRow } from "@/lib/motor-v1/engine/training";

function row(code: string, rawValue: number | null, scoreContribution: number, missingContribution = 0, observed = true): SignalEffectRow<string> {
  return {
    code, family: "GEN", rawValue, observed, standardizedValue: observed ? 0.5 : 0,
    learnedCoefficient: 0.4, scoreContribution,
    missingIndicatorCoefficient: missingContribution, missingIndicatorContribution: missingContribution,
    coverageState: observed ? "GOOD" : "MISSING", modelVersion: "test",
  };
}

describe("RAN RCA pedagojik üçlü pedigri görünümü", () => {
  it("TOP-5'e girmese bile üç soy hattını da daima sabit sırada gösterir", () => {
    const effects = pedigreeEffects([
      row("UNRELATED", 1, 100),
      row("DAMSIRE_HISTORY", 8, -0.03),
      row("SIRE_HISTORY", 14, 0.3),
      row("DAM_HISTORY", 7, -0.02),
    ]);
    expect(effects.map((x) => x.code)).toEqual(PEDIGREE_CODES.map((x) => x.code));
    expect(effects.map((x) => x.contribution)).toEqual([0.3, -0.02, -0.03]);
  });

  it("eksik gözlemi uydurma sıfıra çevirmez, gerçek missing katkısını gösterir", () => {
    const effects = pedigreeEffects(
      [row("SIRE_HISTORY", 10, 0.2), row("DAM_HISTORY", null, 0, -0.035, false), row("DAMSIRE_HISTORY", 12, -0.01)],
      new Map([["DAM_HISTORY", "bu pist/mesafe için geçmiş yarış yok"]])
    );
    expect(effects[1]).toMatchObject({
      raw: null, observed: false, present: true, contribution: -0.035,
      missingIndicatorContribution: -0.035, missingReason: "bu pist/mesafe için geçmiş yarış yok",
    });
  });

  it("model açıklamasında hiç olmayan sinyali sahte 0 yerine 'sinyal yok' yapar", () => {
    const effects = pedigreeEffects([row("SIRE_HISTORY", 8, 0.2)]);
    expect(effects[1]).toMatchObject({ present: false, observed: false, contribution: null, coefficient: null });
    expect(effects[2]).toMatchObject({ present: false, contribution: null });
  });

  it("rakip - kazanan farkını 3 soy hattında da hesaplar ve eksik gözlem katkısını korur", () => {
    const w = pedigreeEffects([row("SIRE_HISTORY", 8, -0.0024), row("DAM_HISTORY", 10, -0.01), row("DAMSIRE_HISTORY", null, 0, 0.02, false)]);
    const r = pedigreeEffects([row("SIRE_HISTORY", 11, 0.3444), row("DAM_HISTORY", 10, 0.02), row("DAMSIRE_HISTORY", null, 0, -0.01, false)]);
    const compared = comparePedigreeEffects(w, r);
    expect(compared.map((x) => x.delta)).toEqual([0.3468, 0.03, -0.03]);
  });

  it("bir tarafta sinyal tamamen yoksa farkı hesaplanamaz olarak işaretler", () => {
    const w = pedigreeEffects([row("SIRE_HISTORY", 8, 0.2)]);
    const r = pedigreeEffects([row("SIRE_HISTORY", 10, 0.3), row("DAM_HISTORY", 5, 0.1)]);
    expect(comparePedigreeEffects(w, r).find((x) => x.code === "DAM_HISTORY")?.delta).toBeNull();
  });
});
