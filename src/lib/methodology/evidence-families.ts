// ROTAGANYAN ANALYSIS STABILITY FREEZE (2026-10-11) — Bağımsız Kanıt Aileleri.
// scratchpad/master-pit/independent-evidence-family-map.json'daki 12 aileyle AYNI isimler;
// bu dosya o haritayı kalıcı/committed hale getirir. MARKET'in 4 alt-sinyali (agfSirasi/
// agfPayi/agfPayi2/agfTrend) narrative'de HER ZAMAN tek aile sayılır — ayrı "4 kanıt" DEĞİL.
import type { SignalStatus } from "./signal-status";

export type EvidenceFamily =
  | "MARKET"
  | "HIZ"
  | "H2H"
  | "PIST_MESAFE_ZEMIN"
  | "TEMPO_STYLE"
  | "RACE_FORM"
  | "IDMAN"
  | "TAKI"
  | "PEDIGRI"
  | "JOKEY"
  | "AT_JOKEY"
  | "SINIF_ZORLUK";

export const FAMILY_LABEL: Record<EvidenceFamily, string> = {
  MARKET: "Piyasa (AGF)",
  HIZ: "Hız",
  H2H: "Baş Başa (H2H)",
  PIST_MESAFE_ZEMIN: "Pist/Mesafe/Zemin",
  TEMPO_STYLE: "Tempo/Stil",
  RACE_FORM: "Yarış Formu",
  IDMAN: "İdman",
  TAKI: "Takı",
  PEDIGRI: "Pedigri",
  JOKEY: "Jokey Son 30G",
  AT_JOKEY: "At-Jokey Uyumu",
  SINIF_ZORLUK: "Sınıf/İkramiye Zorluğu",
};

/** agfTrend gerçek bir V461FeatureDetay kodu DEĞİL — route.ts bunu sentetik bir kod olarak ekler. */
export const EVIDENCE_FAMILY_MAP: Record<EvidenceFamily, string[]> = {
  MARKET: ["agfSirasi", "agfPayi", "agfPayi2", "agfTrend"],
  HIZ: ["hizDerecesi", "ACC_SPEED"],
  H2H: ["h2hNetSkor"],
  PIST_MESAFE_ZEMIN: ["zeminToleransi", "zeminMesafeDeneyim", "pistUzmaniSkoru"],
  TEMPO_STYLE: ["yarisGidisatiSkoru", "PS_front", "PS_lone", "PS_closerFit"],
  RACE_FORM: ["ACC_CLOSE_RES", "ACC_LATE"],
  IDMAN: ["idmJokey", "sonIdmanSprint"],
  TAKI: ["takiDegisikligi"],
  PEDIGRI: ["sireOrani"],
  JOKEY: ["jokeySon30G"], // ayrı kaynaktan gelir; canonical registry'de gerçek üye
  AT_JOKEY: ["atJokeyUyumu"], // FUTURE_CANDIDATE
  SINIF_ZORLUK: ["ikramiyeZorlukDegisimi"], // FUTURE_CANDIDATE
};

/** Henüz hiçbir canlı veri kaynağı olmayan aileler — veri güveni denominator'ına,
 *  her-attaki "eksik veri" listesine ve ANALYSIS_READY'ye KATILMAZLAR. */
export const FUTURE_CANDIDATE_FAMILIES = new Set<EvidenceFamily>(["AT_JOKEY", "SINIF_ZORLUK"]);

export function familyOfSignal(ad: string): EvidenceFamily | null {
  for (const [fam, codes] of Object.entries(EVIDENCE_FAMILY_MAP)) {
    if (codes.includes(ad)) return fam as EvidenceFamily;
  }
  return null;
}

export interface EvidenceFamilyLine {
  family: EvidenceFamily;
  label: string;
  status: SignalStatus;
  contributionSum: number;
  members: { ad: string; status: SignalStatus; contribution: number }[];
}

function rollupStatus(statuses: SignalStatus[]): SignalStatus {
  if (statuses.some((s) => s === "USED")) return "USED";
  if (statuses.some((s) => s === "BLOCKED")) return "BLOCKED";
  return "INSUFFICIENT_DATA";
}

/** entries: yakinsama2Plus GİBİ unmapped/LEGACY kodlar burada da olabilir — familyOfSignal
 *  null dönerse o entry hiçbir aileye girmez (narrative'den otomatik dışlanır). */
export function rollupEvidenceFamilies(
  entries: { ad: string; status: SignalStatus; contribution: number }[]
): EvidenceFamilyLine[] {
  const byFamily = new Map<EvidenceFamily, { ad: string; status: SignalStatus; contribution: number }[]>();
  for (const e of entries) {
    const fam = familyOfSignal(e.ad);
    if (!fam) continue;
    const arr = byFamily.get(fam) ?? [];
    arr.push(e);
    byFamily.set(fam, arr);
  }
  const lines: EvidenceFamilyLine[] = [];
  for (const [fam, members] of byFamily) {
    lines.push({
      family: fam,
      label: FAMILY_LABEL[fam],
      status: rollupStatus(members.map((m) => m.status)),
      contributionSum: members.filter((m) => m.status === "USED").reduce((s, m) => s + m.contribution, 0),
      members,
    });
  }
  return lines;
}
