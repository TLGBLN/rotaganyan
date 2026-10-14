// ROTAGANYAN ANALYSIS STABILITY FREEZE (2026-10-11). Race-seviyesinde ANALYSIS_READY
// gate'i. Required: race metadata + runner list + ≥1 atta gerçek "at performans geçmişi"
// (RACE_FORM/HIZ — MARKET/AGF SAYILMAZ) + model score/rank üretilebilmiş. Supportive
// (eksikliği READY=NO yapmaz, yalnız raporlanır): H2H, galop/idman, takı, pedigri,
// MARKET/AGF, AGF Trend, JOKEY, TEMPO_STYLE.
import type { EvidenceFamily } from "./evidence-families";

export interface ReadyCheckItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface AnalysisReadyResult {
  status: "YES" | "NO";
  mandatory: ReadyCheckItem[];
  supporting: ReadyCheckItem[];
  failedMandatoryLabels: string[];
}

const SUPPORTING_FAMILIES: { key: EvidenceFamily; label: string }[] = [
  { key: "H2H", label: "H2H" },
  { key: "IDMAN", label: "İdman/Galop" },
  { key: "TAKI", label: "Takı/Ekipman" },
  { key: "PEDIGRI", label: "Pedigri" },
  { key: "MARKET", label: "AGF" },
  { key: "JOKEY", label: "Jokey Son30G" },
  { key: "TEMPO_STYLE", label: "Tempo/Stil" },
];

export function evaluateAnalysisReady(params: {
  race: { hippodromeName: string; raceNo: number; distance: number; surface: string };
  runnerCount: number;
  picksValid: boolean;
  /** Her at için SADECE status==="USED" olan aileler (analysisOzet.kanitAileleri'nin
   *  family listesi) — hem mandatory hem supportive kontrolleri bundan türetilir. */
  perHorseUsedFamilies: EvidenceFamily[][];
  agfTrendAnyUsed: boolean;
}): AnalysisReadyResult {
  const anyHasFamily = (fam: EvidenceFamily) => params.perHorseUsedFamilies.some((fs) => fs.includes(fam));

  const mandatory: ReadyCheckItem[] = [
    {
      key: "RACE_METADATA",
      label: "Koşu Bilgisi",
      ok: Boolean(params.race.hippodromeName && params.race.raceNo && params.race.distance && params.race.surface),
      detail: `${params.race.hippodromeName} K${params.race.raceNo}, ${params.race.distance}m ${params.race.surface}`,
    },
    {
      key: "RUNNER_LIST",
      label: "At Listesi",
      ok: params.runnerCount > 0,
      detail: `${params.runnerCount} at`,
    },
    {
      key: "HORSE_PERFORMANCE_INPUT",
      label: "At Performans Geçmişi",
      ok: anyHasFamily("RACE_FORM") || anyHasFamily("HIZ"),
      detail: "≥1 atta RACE_FORM veya HIZ ailesi USED (MARKET/AGF bu kontrole dahil değil)",
    },
    {
      key: "MODEL_SCORE_RANK",
      label: "Model Skor/Sıra",
      ok: params.picksValid,
      detail: params.picksValid ? "Üretildi" : "Üretilemedi",
    },
  ];

  const supporting: ReadyCheckItem[] = SUPPORTING_FAMILIES.map((f) => ({
    key: f.key,
    label: f.label,
    ok: anyHasFamily(f.key),
    detail: anyHasFamily(f.key) ? "≥1 atta USED" : "Hiçbir atta USED değil",
  }));
  supporting.push({ key: "AGF_TREND", label: "AGF Trend", ok: params.agfTrendAnyUsed, detail: params.agfTrendAnyUsed ? "≥1 atta USED" : "Hiçbir atta USED değil" });

  const failedMandatoryLabels = mandatory.filter((m) => !m.ok).map((m) => m.label);
  return {
    status: failedMandatoryLabels.length === 0 ? "YES" : "NO",
    mandatory,
    supporting,
    failedMandatoryLabels,
  };
}
