// SR6 Shadow Logger v1 — T3-A (FROZEN) aday tespiti. SAF fonksiyon: DB/ağ/zaman YOK,
// yalnız girdiden çıktı üretir, girdiyi ASLA mutasyona uğratmaz. Persistence (post-start
// guard, immutable yazım, idempotency) çağıran katmandadır — bkz. sr6-shadow-log.service.ts.
//
// KURAL KAYNAĞI: 682 yarışlık V5.46 Surprise Winner Audit'te (bkz. proje hafızası
// "Surprise Rescue SR6-HC") keşfedilen T3-A tanımı — YENİ EŞİK ARANMAZ, burada AYNEN
// donduruldu. Eşikler değişirse SR6_RULE_VERSION bump edilmeli (ruleHash bunu otomatik
// yakalar, bkz. aşağıda).
import crypto from "crypto";

export const SR6_ENGINE_VERSION = "V5.46";
export const SR6_RULE_VERSION = "SR6-T3A-v1";

// Prod'da v5-engine.ts'in kaynak dosyasını runtime'da hashlemek MÜMKÜN DEĞİL (Vercel
// serverless fonksiyonu yalnız derlenmiş çıktıyı taşır, .ts kaynağı deploy'a dahil değil —
// yerel araştırma script'lerinin computeDependencyHash() yöntemi burada UYGULANAMAZ). Bunun
// yerine elle bakımı yapılan bir versiyon sabiti: v5-engine.ts'teki T3-A'nın kullandığı
// ağırlık setleri (agirlikSetleriSec/bAgirlikOrani) veya toFeatureVector sırası değişirse
// BU SABİT bump edilmeli.
export const SR6_DEPENDENCY_VERSION = "2026-09-26.1";

const UPSET_FEATURE_INDICES = {
  jokeyOrani: 2,
  antrenorOrani: 3,
  hizDerecesi: 6,
  yakinsama2Plus: 9,
  yarisGidisatiSkoru: 12,
} as const;

// T3-A predicate — FROZEN. Değiştirmeden önce SR6_RULE_VERSION'ı bump edin.
const T3A_RULE = {
  agfRankMin: 5,
  nonMarketRankMax: 2,
  positiveCountMin: 4,
  maxSingleShareMax: 0.6,
} as const;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const SR6_RULE_HASH = sha256(stableStringify({ rule: T3A_RULE, upsetFeatures: UPSET_FEATURE_INDICES, ruleVersion: SR6_RULE_VERSION }));

export function sr6DependencyHash(): string {
  return sha256(`${SR6_ENGINE_VERSION}::${SR6_DEPENDENCY_VERSION}::${SR6_RULE_HASH}`);
}

/** faz2V5Sirala'nın döndürdüğü tek bir runner'dan bu modülün ihtiyaç duyduğu alanlar. */
export interface Sr6RunnerSnapshot {
  runnerNo: number;
  agfRank: number; // r.agfSirasi
  olasilik: number; // final V5.46 probability (postprocess'ten etkilenmez, terfi yalnız SIRAYI değiştirir)
  finalRank: number; // r.teknikSira — postprocess SONRASI, SR6'dan ÖNCEKİ yayın konumu
  katkilar: readonly number[]; // faz2V5Sirala'nın 13-uzunluklu A-katmanı katkı dizisi (toFeatureVector sırası)
  bSireKatkisi: number;
  bZeminMesafeKatkisi: number;
  marketBlockContribution: number; // sum(katkilar[AGF_KATKI_INDEKSLERI]) — çağıran hesaplar (v5-engine.AGF_KATKI_INDEKSLERI ile)
}

export interface Sr6RaceSnapshot {
  raceId: string;
  predictionId: string | null;
  raceStartAt: Date;
  runners: readonly Sr6RunnerSnapshot[];
}

export interface Sr6Candidate {
  runnerNo: number;
  agfRank: number;
  rawRank: number;
  finalRankAtPrediction: number;
  nonMarketRank: number;
  surpriseScore: number;
  supportCount: number;
  alreadyTop6: boolean;
  wouldRescueTo6: boolean;
  displacedRunnerNo: number | null;
  ruleVersion: string;
  ruleHash: string;
}

type Derived = Sr6RunnerSnapshot & {
  nonMarketScore: number;
  nonMarketRank: number;
  rawRank: number;
  upsetScore: number;
  positiveCount: number;
  maxSingleShare: number;
};

function deriveRace(snapshot: Sr6RaceSnapshot): Derived[] {
  const withUpset = snapshot.runners.map((r) => {
    const upsetContribs = [
      r.katkilar[UPSET_FEATURE_INDICES.antrenorOrani],
      r.katkilar[UPSET_FEATURE_INDICES.yakinsama2Plus],
      r.katkilar[UPSET_FEATURE_INDICES.jokeyOrani],
      r.katkilar[UPSET_FEATURE_INDICES.yarisGidisatiSkoru],
      r.katkilar[UPSET_FEATURE_INDICES.hizDerecesi],
      r.bSireKatkisi,
      r.bZeminMesafeKatkisi,
    ];
    const upsetScore = upsetContribs.reduce((s, x) => s + x, 0);
    const maxAbs = Math.max(...upsetContribs.map((x) => Math.abs(x)));
    const positiveCount = upsetContribs.filter((x) => x > 0).length;
    return {
      ...r,
      nonMarketScore: 0, // aşağıda enriched map'inde gerçek değerle değiştirilir
      nonMarketRank: 0,
      rawRank: 0,
      upsetScore,
      positiveCount,
      maxSingleShare: upsetScore > 0 ? maxAbs / upsetScore : 1,
    };
  });

  // nonMarketScore ayrı geçilir: rawScore'un market-block'suz hali, katkılar+bKatmani toplamından
  // AGF katkısı (marketBlockContribution) çıkarılarak elde edilir — çağıran bunu zaten hesaplayıp
  // r.marketBlockContribution olarak veriyor; toplam rawScore = katkilar.reduce + bSire + bZeminMesafe.
  const enriched: Derived[] = withUpset.map((r, i) => {
    const rawScore = snapshot.runners[i].katkilar.reduce((s, k) => s + k, 0) + r.bSireKatkisi + r.bZeminMesafeKatkisi;
    return { ...r, nonMarketScore: rawScore - r.marketBlockContribution };
  });

  const byNonMarket = [...enriched].sort((a, b) => (b.nonMarketScore !== a.nonMarketScore ? b.nonMarketScore - a.nonMarketScore : a.runnerNo - b.runnerNo));
  const nonMarketRankByNo = new Map(byNonMarket.map((r, i) => [r.runnerNo, i + 1]));

  const byRaw = [...enriched].sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.runnerNo - b.runnerNo));
  const rawRankByNo = new Map(byRaw.map((r, i) => [r.runnerNo, i + 1]));

  return enriched.map((r) => ({ ...r, nonMarketRank: nonMarketRankByNo.get(r.runnerNo)!, rawRank: rawRankByNo.get(r.runnerNo)! }));
}

function matchesT3A(r: Derived): boolean {
  return (
    r.agfRank >= T3A_RULE.agfRankMin &&
    r.nonMarketRank <= T3A_RULE.nonMarketRankMax &&
    r.positiveCount >= T3A_RULE.positiveCountMin &&
    r.upsetScore > 0 &&
    r.maxSingleShare <= T3A_RULE.maxSingleShareMax
  );
}

/**
 * PREDICTION TIME'da (yarış başlamadan önce) çağrılır — pure, deterministik.
 * Yarış başına EN FAZLA 1 aday döner (birden çok uygun varsa en yüksek upsetScore,
 * eşitlikte en düşük runnerNo kazanır — deterministic tie-break).
 */
export function detectSr6Candidate(snapshot: Sr6RaceSnapshot): Sr6Candidate | null {
  if (snapshot.runners.length === 0) return null;
  const derived = deriveRace(snapshot);
  const eligible = derived.filter(matchesT3A);
  if (eligible.length === 0) return null;

  const selected = [...eligible].sort((a, b) => (b.upsetScore !== a.upsetScore ? b.upsetScore - a.upsetScore : a.runnerNo - b.runnerNo))[0];

  const alreadyTop6 = selected.finalRank <= 6;
  const wouldRescueTo6 = !alreadyTop6;
  const displacedRunnerNo = wouldRescueTo6 ? (derived.find((r) => r.finalRank === 6)?.runnerNo ?? null) : null;

  return {
    runnerNo: selected.runnerNo,
    agfRank: selected.agfRank,
    rawRank: selected.rawRank,
    finalRankAtPrediction: selected.finalRank,
    nonMarketRank: selected.nonMarketRank,
    surpriseScore: selected.upsetScore,
    supportCount: selected.positiveCount,
    alreadyTop6,
    wouldRescueTo6,
    displacedRunnerNo,
    ruleVersion: SR6_RULE_VERSION,
    ruleHash: SR6_RULE_HASH,
  };
}
