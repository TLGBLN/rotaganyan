import { describe, it, expect } from "vitest";
import { UNIFIED_MODEL_CODES } from "./unified-feature-vector";
import { SIGNAL_SPECS } from "../signal-integration";
import { EXCLUDED_FROM_SCORING } from "@/lib/motor-v1/engine/predict-v1";

describe("UNIFIED_MODEL_CODES (D+V1 birleşik, çift-sayımsız canonical kod listesi)", () => {
  it("36 kanonik kod içerir (D:15 + V1:21)", () => {
    expect(UNIFIED_MODEL_CODES.length).toBe(36);
  });

  it("hiçbir kod tekrarlanmaz", () => {
    expect(new Set(UNIFIED_MODEL_CODES).size).toBe(UNIFIED_MODEL_CODES.length);
  });

  it("her kod, SIGNAL_SPECS'te PRIMARY veya INCLUDE kararlı bir girdiye karşılık gelir", () => {
    for (const canonical of UNIFIED_MODEL_CODES) {
      const specs = SIGNAL_SPECS.filter((s) => s.canonical === canonical && (s.decision === "PRIMARY" || s.decision === "INCLUDE"));
      expect(specs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("AGF ailesi (agfSirasi/agfPayi/agfPayi2/yakinsama2Plus) hiçbir şekilde listede değildir", () => {
    const agfCanonicals = ["AGF", "AGF_PAYI", "AGF_SIRASI", "YAKINSAMA"];
    for (const c of UNIFIED_MODEL_CODES) {
      for (const agf of agfCanonicals) expect(c.toUpperCase().includes(agf)).toBe(false);
    }
  });

  it("PIT-güvensiz/seçilim-yanlılıklı V1 kodları (PIST_DURUM_01/DAV_START_RISK/TMP_DAV_KULVAR_01) asla içeride değildir", () => {
    // UNIFIED_MODEL_CODES canonical isimlerle çalışır — kaynak kodları SIGNAL_SPECS üzerinden geri çözüp kontrol ediyoruz.
    const usedSourceCodes = new Set(
      SIGNAL_SPECS.filter((s) => UNIFIED_MODEL_CODES.includes(s.canonical) && (s.decision === "PRIMARY" || s.decision === "INCLUDE")).map((s) => s.code)
    );
    for (const excludedCode of EXCLUDED_FROM_SCORING.keys()) {
      expect(usedSourceCodes.has(excludedCode)).toBe(false);
    }
  });

  it("GEN_SIRE_01/RAK_H2H_01/HIZ_01/TEMPO_02/03/04 (ALTERNATIVE, D'nin eşdeğeri seçildi) listede yok", () => {
    for (const alt of ["GEN_SIRE_01", "RAK_H2H_01", "HIZ_01", "TEMPO_02", "TEMPO_03", "TEMPO_04"]) {
      const spec = SIGNAL_SPECS.find((s) => s.source === "V1" && s.code === alt);
      expect(spec?.decision).toBe("ALTERNATIVE");
    }
  });
});
