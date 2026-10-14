import type { EvidenceFamily, EvidenceFamilyLine } from "./evidence-families";
import {
  SIGNAL_REGISTRY,
  isIntegrityEligibleSignal,
} from "./signal-registry";

export type IntegrityLevel =
  | "BANKO_UYUMLU"
  | "ILK3_UYUMLU"
  | "ILK6_UYUMLU"
  | "YETERSIZ_BUTUNLUK";

export type IntegrityBand =
  | "BANKO"
  | "ILK3"
  | "ILK6"
  | "MODEL_SIRASI";

export interface SignalIntegrityResult {
  level: IntegrityLevel;
  recommendedBand: IntegrityBand;
  usedEligibleFamilies: EvidenceFamily[];
  positiveFamilies: EvidenceFamily[];
  negativeFamilies: EvidenceFamily[];
  neutralFamilies: EvidenceFamily[];
  usedFamilyCount: number;
  positiveFamilyCount: number;
  negativeFamilyCount: number;
  performancePositive: boolean;
  contextPositive: boolean;
  supportPositiveCount: number;
  coreNegativeCount: number;
  marketDownVeto: boolean;
  reasons: string[];
}

const PERFORMANCE = new Set<EvidenceFamily>(["HIZ", "RACE_FORM"]);
const CONTEXT = new Set<EvidenceFamily>(["PIST_MESAFE_ZEMIN", "TEMPO_STYLE"]);
const SUPPORT = new Set<EvidenceFamily>(["H2H", "IDMAN", "TAKI", "PEDIGRI", "JOKEY"]);

const CURRENT_ELIGIBLE_FAMILIES = new Set<EvidenceFamily>(
  SIGNAL_REGISTRY
    .filter((s) => s.lifecycle !== "FUTURE_CANDIDATE" && s.integrityEligible)
    .map((s) => s.family)
);

function sign(v: number): -1 | 0 | 1 {
  if (v > 0) return 1;
  if (v < 0) return -1;
  return 0;
}

function eligibleUsedMembers(line: EvidenceFamilyLine) {
  return line.members.filter(
    (m) => m.status === "USED" && isIntegrityEligibleSignal(m.ad)
  );
}

function familyDirection(
  line: EvidenceFamilyLine,
  ctx: {
    jokeyEtkinFormPp: number | null;
  }
): -1 | 0 | 1 {
  const members = eligibleUsedMembers(line);
  if (members.length === 0) return 0;

  if (line.family === "JOKEY") {
    return sign(ctx.jokeyEtkinFormPp ?? 0);
  }

  // contribution yönü kullanılır; raw değer "iyi/kötü" diye elle yorumlanmaz.
  // Özellikle negatif beta'lı ACC/Sprint gibi feature'larda bu kritik.
  return sign(members.reduce((sum, m) => sum + m.contribution, 0));
}

function atLeast(
  current: IntegrityLevel,
  minimum: "ILK3_UYUMLU" | "ILK6_UYUMLU"
): boolean {
  const score: Record<IntegrityLevel, number> = {
    YETERSIZ_BUTUNLUK: 0,
    ILK6_UYUMLU: 1,
    ILK3_UYUMLU: 2,
    BANKO_UYUMLU: 3,
  };
  return score[current] >= score[minimum];
}

export function evaluateSignalIntegrity(params: {
  rank: number;
  familyLines: EvidenceFamilyLine[];
  marketMovementClass:
    | "MEANINGFUL_UP"
    | "MEANINGFUL_DOWN"
    | "STABLE"
    | null;
  jokeyEtkinFormPp: number | null;
}): SignalIntegrityResult {
  const usable = params.familyLines.filter(
    (line) =>
      line.status === "USED" &&
      CURRENT_ELIGIBLE_FAMILIES.has(line.family) &&
      eligibleUsedMembers(line).length > 0
  );

  const direction = new Map<EvidenceFamily, -1 | 0 | 1>(
    usable.map((line) => [
      line.family,
      familyDirection(line, {
        jokeyEtkinFormPp: params.jokeyEtkinFormPp,
      }),
    ])
  );

  const positiveFamilies = usable
    .filter((l) => direction.get(l.family) === 1)
    .map((l) => l.family);

  const negativeFamilies = usable
    .filter((l) => direction.get(l.family) === -1)
    .map((l) => l.family);

  const neutralFamilies = usable
    .filter((l) => direction.get(l.family) === 0)
    .map((l) => l.family);

  const performancePositive = positiveFamilies.some((f) => PERFORMANCE.has(f));
  const contextPositive = positiveFamilies.some((f) => CONTEXT.has(f));
  const supportPositiveCount = positiveFamilies.filter((f) => SUPPORT.has(f)).length;

  const coreNegativeCount = negativeFamilies.filter(
    (f) => PERFORMANCE.has(f) || CONTEXT.has(f)
  ).length;

  const marketDownVeto =
    params.marketMovementClass === "MEANINGFUL_DOWN";

  const usedFamilyCount = usable.length;
  const positiveFamilyCount = positiveFamilies.length;
  const negativeFamilyCount = negativeFamilies.length;

  const bankoUyumlu =
    usedFamilyCount >= 6 &&
    positiveFamilyCount >= 5 &&
    performancePositive &&
    contextPositive &&
    coreNegativeCount === 0 &&
    negativeFamilyCount <= 1 &&
    !marketDownVeto;

  const ilk3Uyumlu =
    usedFamilyCount >= 5 &&
    positiveFamilyCount >= 4 &&
    performancePositive &&
    (contextPositive || supportPositiveCount >= 2) &&
    coreNegativeCount <= 1 &&
    negativeFamilyCount <= 2;

  const ilk6Uyumlu =
    usedFamilyCount >= 4 &&
    positiveFamilyCount >= 3 &&
    performancePositive &&
    coreNegativeCount <= 2 &&
    negativeFamilyCount <= 3;

  const level: IntegrityLevel =
    bankoUyumlu
      ? "BANKO_UYUMLU"
      : ilk3Uyumlu
        ? "ILK3_UYUMLU"
        : ilk6Uyumlu
          ? "ILK6_UYUMLU"
          : "YETERSIZ_BUTUNLUK";

  let recommendedBand: IntegrityBand = "MODEL_SIRASI";

  if (params.rank === 1 && level === "BANKO_UYUMLU") {
    recommendedBand = "BANKO";
  } else if (
    (params.rank <= 3 && atLeast(level, "ILK3_UYUMLU")) ||
    (params.rank >= 4 && params.rank <= 6 && level === "BANKO_UYUMLU")
  ) {
    recommendedBand = "ILK3";
  } else if (
    (params.rank <= 6 && atLeast(level, "ILK6_UYUMLU")) ||
    (params.rank >= 7 && params.rank <= 10 && atLeast(level, "ILK3_UYUMLU"))
  ) {
    recommendedBand = "ILK6";
  }

  const reasons: string[] = [
    `Kullanılabilir bağımsız aile: ${usedFamilyCount}`,
    `Pozitif aile: ${positiveFamilyCount}`,
    `Negatif aile: ${negativeFamilyCount}`,
    `Performans desteği: ${performancePositive ? "EVET" : "HAYIR"}`,
    `Koşul/tempo desteği: ${contextPositive ? "EVET" : "HAYIR"}`,
  ];

  if (marketDownVeto) {
    reasons.push("AGF Trend: MEANINGFUL_DOWN — BANKO veto");
  }

  return {
    level,
    recommendedBand,
    usedEligibleFamilies: usable.map((l) => l.family),
    positiveFamilies,
    negativeFamilies,
    neutralFamilies,
    usedFamilyCount,
    positiveFamilyCount,
    negativeFamilyCount,
    performancePositive,
    contextPositive,
    supportPositiveCount,
    coreNegativeCount,
    marketDownVeto,
    reasons,
  };
}