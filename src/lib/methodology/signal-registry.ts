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
  { code: "agfSirasi", family: "MARKET", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "[2026-11-10 AGF resmi motordan kaldırıldı; yalnız analiz/izleme] AGF ailesi; bağımsız aile oyu değildir." },
  { code: "agfPayi", family: "MARKET", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "[2026-11-10 AGF resmi motordan kaldırıldı; yalnız analiz/izleme] AGF ham pay." },
  { code: "agfPayi2", family: "MARKET", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "[2026-11-10 AGF resmi motordan kaldırıldı; yalnız analiz/izleme] agfPayi'nin nonlinear dönüşümü; yeni veri değildir." },
  { code: "agfTrend", family: "MARKET", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "Pre-race snapshot trendi; MARKET ailesinde tek oy." },

  { code: "hizDerecesi", family: "HIZ", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "365g göreli hız." },
  { code: "ACC_SPEED", family: "HIZ", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Accurace speed residual." },

  { code: "h2hNetSkor", family: "H2H", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Rakiplerle doğrudan geçmiş karşılaşma." },

  { code: "zeminToleransi", family: "PIST_MESAFE_ZEMIN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Gerçek observed artık biliniyor; ancak istatistiksel kanıt zayıf olduğu için BANKO/İLK3/İLK6 oyu vermez." },
  { code: "zeminMesafeDeneyim", family: "PIST_MESAFE_ZEMIN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "tam/kısmi/yok seviyesiyle gerçek availability biliniyor." },
  { code: "pistUzmaniSkoru", family: "PIST_MESAFE_ZEMIN", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Continuous residual + recency + distance/surface reliability; OOS bekliyor." },

  { code: "yarisGidisatiSkoru", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "TEMPO_STYLE ana evidence kaynağı." },
  { code: "PS_front", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "PS-v2/OOS bekliyor; field-size ölçek etkisi." },
  { code: "PS_lone", family: "TEMPO_STYLE", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: false, note: "[2026-11-14 canlı modellerden ÇIKARILDI — ölü (%99 sıfır) + σ=0.0086 uç değer riski (z≈16)] PS-v2/OOS bekliyor; 1-front kırpma sorunu." },
  { code: "PS_closerFit", family: "TEMPO_STYLE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "PS-v2/OOS bekliyor; pressure ölçek sorunu." },

  { code: "ACC_CLOSE_RES", family: "RACE_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Closing residual." },
  { code: "ACC_LATE", family: "RACE_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Late segment form." },

  { code: "idmJokey", family: "IDMAN", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "[2026-11-14 canlı modellerden ÇIKARILDI — ölü (%92 sıfır)] Galop verisi varsa kullanılabilir." },
  { code: "sonIdmanSprint", family: "IDMAN", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: false, note: "[2026-11-14 canlı modellerden ÇIKARILDI — ölü (%91 sıfır, 2 değer)] Backtest yönü doğrulamadı; narrative/audit görünür ama placement bütünlüğüne oy vermez." },

  { code: "takiDegisikligi", family: "TAKI", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: false, note: "[2026-11-14 canlı modellerden ÇIKARILDI — ölü (%94 sıfır)] Gerçek previous-race comparison artık biliniyor; katsayı kanıtı zayıf olduğu için placement bütünlüğüne oy vermez." },

  { code: "sireOrani", family: "PEDIGRI", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Gerçek sire örneklemi fallback'ten ayrılıyor; fakat kanıt zayıf olduğu için placement bütünlüğüne oy vermez." },

  // 2026-11-13 — canlı Saf Model'in yeni sinyalleri (eğitim bootstrap |z| ile): güvenilir olanlar integrityEligible.
  { code: "hpRel", family: "HANDIKAP_KILO", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "TJK handikap puanı, sahaya göre (|z|=9.0, modelin en güçlü sinyali)." },
  { code: "kiloRel", family: "HANDIKAP_KILO", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Taşınan kilo, sahaya göre (|z|=6.0)." },
  { code: "fMean", family: "SON_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Son 6 yarış derece ortalaması (|z|=7.9)." },
  { code: "lastWon", family: "SON_FORM", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Son yarışını kazandı mı (|z|=2.5)." },
  { code: "kgsLog", family: "DINLENME", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "log(1+KGS) (|z|=8.0)." },
  { code: "jokeyPIT", family: "SEVIYE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Jokey seviyesi, son 365 gün (|z|=7.8) — modelin gerçek jokey sinyali." },
  { code: "antrenorPIT", family: "SEVIYE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Antrenör seviyesi, son 365 gün (|z|=5.2)." },
  { code: "jokeyFormuGenel", family: "SEVIYE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Son 30 gün jokey formu; katsayı belirsiz (|z|=0.4) — aile oyu değil." },
  { code: "antrenorOraniGenel", family: "SEVIYE", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Yalnız segment modellerinde." },
  { code: "sexE", family: "CINS", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Cins (yaş alanının 3. kelimesi e) (|z|=5.2)." },
  { code: "galopKalite", family: "IDMAN", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: true, note: "Son galop kalitesi (|z|=2.9); ordinal, çoğu at 1.0." },
  { code: "sireOraniBirlesik", family: "PEDIGRI", lifecycle: "PRODUCTION_ACTIVE", productionFeature: true, integrityEligible: false, note: "Yalnız segment modellerinde." },
  { code: "jokeySon30G", family: "JOKEY", lifecycle: "ANALYSIS_ONLY", productionFeature: false, integrityEligible: true, note: "Model score dışı güncel jokey desteği." },

  { code: "atJokeyUyumu", family: "AT_JOKEY", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Residualized pair uplift + shrinkage/recency; OOS bekliyor." },

  { code: "ikramiyeZorlukDegisimi", family: "SINIF_ZORLUK", lifecycle: "FUTURE_CANDIDATE", productionFeature: false, integrityEligible: false, note: "Continuous prize-difficulty delta; hard %80 eşiği yok; OOS bekliyor." },
];

export const LEGACY_COMPOSITES = ["yakinsama2Plus"] as const;

/**
 * CANLI üretim sinyalleri = kayıt defterinde productionFeature=true olanlar = canlı modellerin (varsayılan, Handikap, Maiden/ŞARTLI 19,
 * ŞARTLI 1/27) featureNames BİRLEŞİMİ — bu eşitlik signal-registry.test.ts'te korunur (2026-11-14 "sinyal kütüğü son hali").
 * Eskiden burada V5.46.1'in 19 teknik feature'ı (AGF dahil) donmuş bir liste olarak duruyordu; artık kayıt defterinden türetilir.
 */
export const PRODUCTION_FEATURE_CODES: readonly string[] = SIGNAL_REGISTRY.filter((s) => s.productionFeature).map((s) => s.code);

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