// ROTAGANYAN ANALYSIS STABILITY FREEZE (2026-10-11). Tek at için 9 parçalı çıktının 2-9'u.
// (1=teknik/model sıra zaten mevcut p.rank/teknikSira'dan gelir, burada üretilmez.)
import type { SignalStatusEntry, SignalStatus } from "./signal-status";
import { rollupEvidenceFamilies, FUTURE_CANDIDATE_FAMILIES, FAMILY_LABEL, type EvidenceFamily, type EvidenceFamilyLine } from "./evidence-families";
import { evaluateSignalIntegrity, type SignalIntegrityResult } from "./signal-integrity";
import { isIntegrityEligibleSignal } from "./signal-registry";
import type { AgfTrendItem } from "@/server/actions/agf-trend.actions";
import type { JokeyGuncelForm } from "@/lib/jokey-form";
import type { JokeyPiyasa30 } from "@/lib/jokey-piyasa30";

export type HorseClass = "ANA ADAY" | "CIDDI RAKIP" | "RAKIP" | "SÜRPRİZ";

const TOP_N_REASONS = 3;
/** AGF Trend "anlamlı hareket" eşiği — agf-trend.actions.ts'in KENDİ ANLAMLI_PUAN_ESIGI'si
 *  ile AYNI sabit, burada YENİDEN TANIMLANMAZ, oradan import edilir (tek kaynak). */
const MEANINGFUL_THRESHOLD_PP = 1.0;

export function classifyHorseKategori(rank: number, jokeyDestekliSurpriz: boolean): HorseClass {
  if (rank === 1) return "ANA ADAY";
  if (rank <= 3) return "CIDDI RAKIP";
  if (jokeyDestekliSurpriz) return "SÜRPRİZ";
  return "RAKIP";
}

export interface MarketOzet {
  status: "USED" | "INSUFFICIENT_DATA";
  firstAgf: number | null;
  lastAgf: number | null;
  deltaPp: number | null;
  snapshotCount: number;
  movementClass: "MEANINGFUL_UP" | "MEANINGFUL_DOWN" | "STABLE" | null;
}

export interface JokeySon30GOzet {
  status: "USED" | "INSUFFICIENT_DATA";
  w30: number;
  n30: number;
  k30: number;
  refKPct: number;
  formDeltaPp: number | null;
  guven: number;
  etkinFormPp: number | null;
  metni: string | null;
}

export interface MissingDataEntry {
  label: string;
  status: Exclude<SignalStatus, "USED">;
}

export interface HorseAnalysisSummary {
  sinif: HorseClass;
  kanitAileleri: EvidenceFamilyLine[];
  enGucluPozitif: EvidenceFamilyLine[];
  enGucluNegatif: EvidenceFamilyLine[];
  marketOzet: MarketOzet;
  jokeySon30GOzet: JokeySon30GOzet;
  /** Additional JOKEY Tier-1 signal, observation only. Never enters family rollup or the integrity vote. */
  jokeyPiyasa30Sinyal: {
    kod: "jokeyPiyasa30G";
    family: "JOKEY";
    lifecycle: "ANALYSIS_ONLY";
    integrityEligible: false;
    scoreContribution: 0;
    veri: JokeyPiyasa30 | null;
  };
  eksikBlockedLegacyVeriler: MissingDataEntry[];
  veriGuvenSeviyesi: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  butunluk: SignalIntegrityResult;
}

function buildMarketOzet(agfTrendItem: AgfTrendItem | null): MarketOzet {
  if (!agfTrendItem || agfTrendItem.kayitSayisi < 2) {
    return {
      status: "INSUFFICIENT_DATA",
      firstAgf: agfTrendItem?.ilkAgf ?? null,
      lastAgf: agfTrendItem?.sonAgf ?? null,
      deltaPp: agfTrendItem?.fark ?? null,
      snapshotCount: agfTrendItem?.kayitSayisi ?? 0,
      movementClass: null,
    };
  }
  const fark = agfTrendItem.fark ?? 0;
  const movementClass = Math.abs(fark) >= MEANINGFUL_THRESHOLD_PP ? (fark > 0 ? "MEANINGFUL_UP" : "MEANINGFUL_DOWN") : "STABLE";
  return {
    status: "USED",
    firstAgf: agfTrendItem.ilkAgf,
    lastAgf: agfTrendItem.sonAgf,
    deltaPp: agfTrendItem.fark,
    snapshotCount: agfTrendItem.kayitSayisi,
    movementClass,
  };
}

function buildJokeyOzet(g: JokeyGuncelForm | null, metni: string | null): JokeySon30GOzet {
  if (!g || g.son30Start === 0) {
    return { status: "INSUFFICIENT_DATA", w30: g?.son30Win ?? 0, n30: g?.son30Start ?? 0, k30: g?.son30WinRate ?? 0, refKPct: g ? g.kRef * 100 : 0, formDeltaPp: null, guven: g?.reliability ?? 0, etkinFormPp: null, metni };
  }
  return {
    status: "USED",
    w30: g.son30Win,
    n30: g.son30Start,
    k30: g.son30WinRate,
    refKPct: g.kRef * 100,
    formDeltaPp: g.formDelta != null ? g.formDelta * 100 : null,
    guven: g.reliability,
    etkinFormPp: g.etkinForm != null ? g.etkinForm * 100 : null,
    metni,
  };
}

export function buildHorseAnalysisSummary(params: {
  rank: number;
  signals: SignalStatusEntry[];
  agfTrendItem: AgfTrendItem | null;
  jokeySon30G: JokeyGuncelForm | null;
  jokeySon30GMetni: string | null;
  jokeyPiyasa30?: JokeyPiyasa30 | null;
  jokeyDestekliSurpriz: boolean;
}): HorseAnalysisSummary {
  const sinif = classifyHorseKategori(params.rank, params.jokeyDestekliSurpriz);
  const familyLines = rollupEvidenceFamilies(params.signals);
  const marketOzet = buildMarketOzet(params.agfTrendItem);
  const jokeySon30GOzet = buildJokeyOzet(params.jokeySon30G, params.jokeySon30GMetni);

  // agfTrend MARKET ailesinin bir üyesi (sentetik kod) — family rollup'a elle eklenir.
  const marketIdx = familyLines.findIndex((l) => l.family === "MARKET");
  if (marketIdx >= 0) {
    const agfTrendStatus: SignalStatus = marketOzet.status;
    if (agfTrendStatus === "USED") familyLines[marketIdx].status = "USED";
    familyLines[marketIdx].members.push({ ad: "agfTrend", status: agfTrendStatus, contribution: 0 });
  }
  // JOKEY ailesi ayrı kaynaktan (jokey-form.ts) — V461FeatureDetay'de hiç yok, elle eklenir.
  const jokeyLine: EvidenceFamilyLine = {
    family: "JOKEY",
    label: FAMILY_LABEL.JOKEY,
    status: jokeySon30GOzet.status,
    contributionSum: 0,
    members: [{ ad: "jokeySon30G", status: jokeySon30GOzet.status, contribution: 0 }],
  };
  const allFamilyLines = [...familyLines, jokeyLine];

  const usedFamilyLines = allFamilyLines.filter((l) => l.status === "USED");
  const strengthEligibleLines = usedFamilyLines
    .map((l) => {
      const eligibleMembers = l.members.filter(
        (m) =>
          m.status === "USED" &&
          isIntegrityEligibleSignal(m.ad)
      );

      return {
        ...l,
        members: eligibleMembers,
        contributionSum: eligibleMembers.reduce(
          (sum, m) => sum + m.contribution,
          0
        ),
      };
    })
    .filter((l) => l.members.length > 0);

  const enGucluPozitif = [...strengthEligibleLines]
    .filter((l) => l.contributionSum > 0)
    .sort((a, b) => b.contributionSum - a.contributionSum)
    .slice(0, TOP_N_REASONS);

  const enGucluNegatif = [...strengthEligibleLines]
    .filter((l) => l.contributionSum < 0)
    .sort((a, b) => a.contributionSum - b.contributionSum)
    .slice(0, TOP_N_REASONS);

  const eksikBlockedLegacyVeriler: MissingDataEntry[] = [];
  for (const l of allFamilyLines) {
    if (l.status !== "USED") eksikBlockedLegacyVeriler.push({ label: l.label, status: l.status as Exclude<SignalStatus, "USED"> });
  }
  if (params.signals.some((s) => s.ad === "yakinsama2Plus")) {
    eksikBlockedLegacyVeriler.push({ label: "yakinsama2Plus (LEGACY, yeni analizde kullanılmıyor)", status: "LEGACY" });
  }

  // Veri güveni — SADECE görüntüleme amaçlı basit bir kapsam oranı (model eşiği DEĞİL).
  // FUTURE_CANDIDATE aileler (AT_JOKEY/SINIF_ZORLUK) denominator'a GİRMEZ.
  const realFamilies = allFamilyLines.filter((l) => !FUTURE_CANDIDATE_FAMILIES.has(l.family as EvidenceFamily));
  const usedRatio = realFamilies.length > 0 ? realFamilies.filter((l) => l.status === "USED").length / realFamilies.length : 0;
  const veriGuvenSeviyesi = usedRatio >= 0.7 ? "YÜKSEK" : usedRatio >= 0.4 ? "ORTA" : "DÜŞÜK";
  const butunluk = evaluateSignalIntegrity({
    rank: params.rank,
    familyLines: allFamilyLines,
    marketMovementClass: marketOzet.movementClass,
    jokeyEtkinFormPp: jokeySon30GOzet.etkinFormPp,
  });

  return {
    sinif,
    kanitAileleri: usedFamilyLines,
    enGucluPozitif,
    enGucluNegatif,
    marketOzet,
    jokeySon30GOzet,
    // Explicit signal representation; deliberately excluded from allFamilyLines,
    // evaluateSignalIntegrity, strength counts and the frozen score contribution.
    jokeyPiyasa30Sinyal: {
      kod: "jokeyPiyasa30G",
      family: "JOKEY",
      lifecycle: "ANALYSIS_ONLY",
      integrityEligible: false,
      scoreContribution: 0,
      veri: params.jokeyPiyasa30 ?? null,
    },
    eksikBlockedLegacyVeriler,
    veriGuvenSeviyesi,
    butunluk,
  };
}
