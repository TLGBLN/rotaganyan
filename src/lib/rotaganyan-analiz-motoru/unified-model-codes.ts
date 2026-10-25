// RAN canonical scoring code contract (no DB, no feature-calculator imports).
// Any score/report/model validation can read this module without creating Prisma.
// All included codes come from the same signal-integration.ts source of truth.
import { SIGNAL_SPECS } from "./signal-integration";

export const V1_INCLUDED_CODES = [
  "GEN_DAM_01", "GEN_DAMSIRE_01",
  "RAK_GAP_01", "ANT_TREND30",
  "JOKEY_01", "JOKEY_02", "JOKEY_04", "JOKEY_TREND30",
  "TEMPO_01", "KULVAR_01_HAM",
  "FORM_01", "FORM_02", "FORM_03",
  "PMZ_01", "PMZ_02", "FORM_x_ZEMIN",
  "SINIF_01",
  "KILO_01", "KILO_02", "KILO_03", "KILO_04",
] as const;

export const D_INCLUDED_CODES = [
  "idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim",
  "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani",
  "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED", "PS_front", "PS_lone", "PS_closerFit",
] as const;

export const UNIFIED_MODEL_CODES: readonly string[] = (() => {
  const wanted = new Set<string>([
    ...D_INCLUDED_CODES.map((code) => `D:${code}`),
    ...V1_INCLUDED_CODES.map((code) => `V1:${code}`),
  ]);
  const canonical: string[] = [];
  const seen = new Set<string>();
  for (const spec of SIGNAL_SPECS) {
    const key = `${spec.source}:${spec.code}`;
    if (!wanted.has(key)) continue;
    if (spec.decision !== "PRIMARY" && spec.decision !== "INCLUDE") {
      throw new Error(`UNIFIED_MODEL_CODES: ${key} PRIMARY/INCLUDE değil (${spec.decision})`);
    }
    if (seen.has(spec.canonical)) {
      throw new Error(`UNIFIED_MODEL_CODES: canonical çift sayım: ${spec.canonical}`);
    }
    seen.add(spec.canonical);
    canonical.push(spec.canonical);
    wanted.delete(key);
  }
  if (wanted.size !== 0) {
    throw new Error(`UNIFIED_MODEL_CODES: registry'de bulunamayan secimler: ${[...wanted].join(",")}`);
  }
  return canonical;
})();
