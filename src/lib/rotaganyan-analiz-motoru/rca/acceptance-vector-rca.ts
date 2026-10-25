// ROTAGANYAN RAN — kabul-testinde ZATEN hesaplanmış vektörlerden DB'siz RCA.
// Bu kayıtta engineVersion/weightsFingerprint/generatedAt kanıtı YOKSA "published
// pre-race snapshot" olduğu ASLA iddia edilmez. Kayıtlı vektörlerin bugünkü canonical
// modelle yeniden skorlanması ve skor farklarının açıklamasıdır.
// Alternatif D/V1 formül çapraz-denetimi ve AGF BU YOLDA DOĞRULANMAZ.
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { scoreRace, explainRunner, type FittedModel } from "@/lib/motor-v1/engine/training";
import { computeDemotionDrivers, classifyDemotion } from "./root-cause-classifier";
import { pedigreeEffects, comparePedigreeEffects } from "./pedigree-breakdown";
import { UNIFIED_MODEL_CODES } from "../feature-calculators/unified-feature-vector";
import type { RaceRcaResult, MissAnalysis, WinnerPositiveSignal } from "./analyze-race";

export type StoredRcaResult =
  | { status: "INVALID_RECORD"; raceId: string; reasons: string[] }
  | { status: "NO_WINNER_MATCH"; raceId: string }
  | ({ status: "OK"; raceId: string; source: "ACCEPTANCE_VECTORS"; altCrosscheck: "NOT_VERIFIED"; agfComparison: null; provenance: "UNVERIFIED" } &
     Extract<RaceRcaResult, { status: "OK" }>);

/** Stored vectors: raceId, kod sırası, sayısal içerik ve runner eşsizliği kontrolü.
 * Model kimliği/öncesellik kanıtlanamıyorsa kabul-RCA'dan raporda ayrıca belirtilir.
 */
export function validateAcceptanceVectors(raceId: string, vectors: readonly RunnerFeatureVector[]): string[] {
  const reasons: string[] = [];
  if (!Array.isArray(vectors) || vectors.length < 2) return ["Saha iki veya daha fazla koşucu içermiyor"];
  const wanted = new Set(UNIFIED_MODEL_CODES);
  const nos = new Set<number>();
  for (const v of vectors) {
    if (v.raceId !== raceId) reasons.push(`At ${v.no}: raceId uyuşmuyor`);
    if (!Number.isSafeInteger(v.no) || v.no < 1 || nos.has(v.no)) reasons.push(`At ${v.no}: numara geçersiz/tekrar`);
    nos.add(v.no);
    if (!Array.isArray(v.signals)) { reasons.push(`At ${v.no}: signals yok`); continue; }
    const codes = v.signals.map((s) => s.code);
    const found = new Set(codes);
    if (codes.length !== wanted.size || found.size !== wanted.size ||
        codes.some((c) => !wanted.has(c)) || [...wanted].some((c) => !found.has(c))) {
      reasons.push(`At ${v.no}: model kod kümesi eksik/fazla/tekrarlı`);
    }
    for (const s of v.signals) {
      if (typeof s.observed !== "boolean" ||
          (s.rawValue != null && (typeof s.rawValue !== "number" || !Number.isFinite(s.rawValue))) ||
          (s.observed && s.rawValue == null)) reasons.push(`At ${v.no}: ${s.code} observed/raw tutarsız`);
    }
  }
  return reasons;
}

export function analyzeStoredAcceptanceRace(
  raceId: string,
  winnerNo: number,
  vectors: RunnerFeatureVector[],
  model: FittedModel<string>
): StoredRcaResult {
  const reasons = validateAcceptanceVectors(raceId, vectors);
  const statsCodes = [...model.stats.keys()];
  if (statsCodes.length !== UNIFIED_MODEL_CODES.length ||
      statsCodes.some((code, index) => code !== UNIFIED_MODEL_CODES[index])) {
    reasons.push("Kabul vektörleri ile model.stats kanonik kod sırası uyuşmuyor");
  }
  const wantedNames = UNIFIED_MODEL_CODES.flatMap((code) => [`${code}_z`, `${code}_missing`]);
  if (model.beta.length !== wantedNames.length || model.names.length !== wantedNames.length ||
      model.names.some((name, index) => name !== wantedNames[index]) || model.beta.some((b) => !Number.isFinite(b))) {
    reasons.push("Model names/beta sırası veya değerleri kanonik değil");
  }
  if (reasons.length) return { status: "INVALID_RECORD", raceId, reasons };

  const ranked = scoreRace(vectors, model).sort((a, b) => b.probability - a.probability);
  const winnerIdx = ranked.findIndex((r) => r.no === winnerNo);
  if (winnerIdx < 0) return { status: "NO_WINNER_MATCH", raceId };

  const winnerRank = winnerIdx + 1;
  const winnerVec = vectors.find((v) => v.no === winnerNo)!;
  const winnerExplain = explainRunner(winnerVec, model);
  const winnerPedigree = pedigreeEffects(
    winnerExplain.rows, new Map(winnerVec.signals.map((s) => [s.code, s.missingReason]))
  );
  const probabilitySpread = ranked[0].probability - ranked[ranked.length - 1].probability;
  const allAbsBeta = model.beta.filter((_, i) => model.names[i].endsWith("_z")).map(Math.abs);
  function miss(rivalNo: number): MissAnalysis {
    const rivalVec = vectors.find((v) => v.no === rivalNo)!;
    const rivalExplain = explainRunner(rivalVec, model);
    const drivers = computeDemotionDrivers(winnerExplain.rows, rivalExplain.rows);
    const classification = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map(winnerExplain.rows.map((r) => [r.code, r])),
      allAbsBetaForComparison: allAbsBeta,
      fieldProbabilitySpread: probabilitySpread,
      // Alternatif sinyaller stored vektörlerde yoktur. False bir doğrulama
      // sonucu gibi gösterilmez; evidence'da NOT_VERIFIED işaretlenir.
      topDriverHasAltDisagreement: false,
    });
    return {
      rivalNo, rivalName: rivalVec.name, demotionDrivers: drivers.slice(0, 5),
      pedigreeComparison: comparePedigreeEffects(
        winnerPedigree,
        pedigreeEffects(rivalExplain.rows, new Map(rivalVec.signals.map((s) => [s.code, s.missingReason])))
      ),
      category: classification.category,
      evidence: [...classification.evidence,
        "Verification: alternatif D/V1 formül karşılaştırması bu kayıt üzerinde NOT_VERIFIED; YANLIS_OKUNDU yokluğu doğrulanmış uyum anlamına gelmez."],
    };
  }
  const positive: WinnerPositiveSignal[] | null = winnerRank > 1
    ? winnerExplain.rows.map((r) => ({
        code: r.code, rawValue: r.rawValue,
        totalContribution: r.scoreContribution + r.missingIndicatorContribution,
      })).filter((r) => r.totalContribution > 0)
      .sort((a, b) => b.totalContribution - a.totalContribution).slice(0, 5)
    : null;
  return {
    status: "OK", raceId, source: "ACCEPTANCE_VECTORS", provenance: "UNVERIFIED",
    altCrosscheck: "NOT_VERIFIED", agfComparison: null,
    winnerNo, winnerName: winnerVec.name, winnerRank, fieldSize: vectors.length,
    ranked: ranked.map((r) => ({ no: r.no, name: r.name, probability: r.probability })),
    top1Miss: winnerRank > 1 ? miss(ranked[0].no) : null,
    top3Miss: winnerRank > 3 ? miss(ranked[2].no) : null,
    winnerPositiveSignals: positive, winnerPedigree,
  };
}
