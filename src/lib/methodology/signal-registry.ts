import type { EvidenceFamily } from "./evidence-families";

export type SignalLifecycle =
  | "PRODUCTION_ACTIVE"
  | "ANALYSIS_ONLY"
  | "FUTURE_CANDIDATE";

export interface SignalRegistryEntry {
  code: string;
  family: EvidenceFamily;
  lifecycle: SignalLifecycle;
  productionFeature: boolean;
  integrityEligible: boolean;
  note: string;
}

/**
 * ROTAGANYAN canonical atomic signal registry.
 *
 * 23 ATOMİK kaynak vardır.
 * yakinsama2Plus burada YOKTUR: o 5 koşulu birleştiren LEGACY composite'tir.
 *
 * integrityEligible=false:
 * - veri-yok ile gerçek nötr henüz güvenilir ayrılmıyorsa
 * - formül ailesi OOS/reform bekliyorsa
 * - feature henüz future candidate ise
 */
export const SIGNAL_REGISTRY: readonly SignalRegistryEntry[] = [
  { code: "agfSirasi", family: "MARKET", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "AGF ailesi; bağımsız aile oyu değildir." },
  { code: "agfPayi", family: "MARKET", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "AGF ham pay." },
  { code: "agfPayi2", family: "MARKET", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "agfPayi'nin nonlinear dönüşümü; yeni veri değildir." },
  { code: "agfTrend", family: "MARKET", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "Pre-race snapshot trendi; MARKET ailesinde tek oy." },

  { code: "hizDerecesi", family: "HIZ", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "365g göreli hız." },
  { code: "ACC_SPEED", family: "HIZ", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Accurace speed residual." },

  { code: "h2hNetSkor", family: "H2H", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Rakiplerle doğrudan geçmiş karşılaşma." },

  { code: "zeminToleransi", family: "PIST_MESAFE_ZEMIN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Gerçek observed artık biliniyor; ancak istatistiksel kanıt zayıf olduğu için BANKO/İLK3/İLK6 oyu vermez." },
  { code: "zeminMesafeDeneyim", family: "PIST_MESAFE_ZEMIN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "tam/kısmi/yok seviyesiyle gerçek availability biliniyor." },
  { code: "pistUzmaniSkoru", family: "PIST_MESAFE_ZEMIN", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Continuous residual + recency + distance/surface reliability; OOS bekliyor." },

  { code: "yarisGidisatiSkoru", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "TEMPO_STYLE ana evidence kaynağı." },
  { code: "PS_front", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "PS-v2/OOS bekliyor; field-size ölçek etkisi." },
  { code: "PS_lone", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "PS-v2/OOS bekliyor; 1-front kırpma sorunu." },
  { code: "PS_closerFit", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "PS-v2/OOS bekliyor; pressure ölçek sorunu." },

  { code: "ACC_CLOSE_RES", family: "RACE_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Closing residual." },
  { code: "ACC_LATE", family: "RACE_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Late segment form." },

  { code: "idmJokey", family: "IDMAN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Galop verisi varsa kullanılabilir." },
  { code: "sonIdmanSprint", family: "IDMAN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Backtest yönü doğrulamadı; narrative/audit görünür ama placement bütünlüğüne oy vermez." },

  { code: "takiDegisikligi", family: "TAKI", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Gerçek previous-race comparison artık biliniyor; katsayı kanıtı zayıf olduğu için placement bütünlüğüne oy vermez." },

  { code: "sireOrani", family: "PEDIGRI", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Gerçek sire örneklemi fallback'ten ayrılıyor; fakat kanıt zayıf olduğu için placement bütünlüğüne oy vermez." },

  { code: "jokeySon30G", family: "JOKEY", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "Model score dışı güncel jokey desteği." },

  { code: "atJokeyUyumu", family: "AT_JOKEY", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Residualized pair uplift + shrinkage/recency; OOS bekliyor." },

  { code: "ikramiyeZorlukDegisimi", family: "SINIF_ZORLUK", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Continuous prize-difficulty delta; hard %80 eşiği yok; OOS bekliyor." },
];

export const LEGACY_COMPOSITES = ["yakinsama2Plus"] as const;

export const PRODUCTION_FEATURE_CODES = [
  "agfSirasi",
  "agfPayi",
  "agfPayi2",
  "idmJokey",
  "h2hNetSkor",
  "hizDerecesi",
  "zeminToleransi",
  "zeminMesafeDeneyim",
  "yakinsama2Plus",
  "sonIdmanSprint",
  "takiDegisikligi",
  "yarisGidisatiSkoru",
  "sireOrani",
  "ACC_CLOSE_RES",
  "ACC_LATE",
  "ACC_SPEED",
  "PS_front",
  "PS_lone",
  "PS_closerFit",
] as const;

export const CURRENT_ANALYSIS_SOURCE_CODES =
  SIGNAL_REGISTRY
    .filter((s) => s.lifecycle !== "FUTURE_CANDIDATE")
    .map((s) => s.code);

export const FUTURE_CANDIDATE_CODES =
  SIGNAL_REGISTRY
    .filter((s) => s.lifecycle === "FUTURE_CANDIDATE")
    .map((s) => s.code);

export const CURRENT_INTEGRITY_ELIGIBLE_CODES =
  SIGNAL_REGISTRY
    .filter((s) => s.lifecycle !== "FUTURE_CANDIDATE" && s.integrityEligible)
    .map((s) => s.code);

export function isIntegrityEligibleSignal(code: string): boolean {
  return SIGNAL_REGISTRY.some(
    (s) =>
      s.code === code &&
      s.lifecycle !== "FUTURE_CANDIDATE" &&
      s.integrityEligible
  );
}

export function registryFamilyOf(code: string): EvidenceFamily | null {
  return SIGNAL_REGISTRY.find((s) => s.code === code)?.family ?? null;
}