// 2026-09-24 — Fault Injection / Chaos Test senaryo tanımları (kullanıcı spesifikasyonu).
// Bilerek SABİT/kapalı bir liste — serbest metin senaryo adı KABUL EDİLMEZ (API route bu
// listeye karşı doğrular), böylece kim çalıştırırsa çalıştırsın yalnız bilinen, kontrollü
// senaryolar tetiklenebilir. Bu dosya "use client" bileşenlerden de import edilebilir (salt
// veri, server-only bağımlılık yok).
export type ChaosScenario = {
  key: string;
  label: string;
  targetModuleId: string;
  forcedStatus: "critical" | "warning";
  reason: string;
};

export const CHAOS_SCENARIOS: ChaosScenario[] = [
  { key: "program_missing", label: "Program: eksik yarış", targetModuleId: "program", forcedStatus: "critical", reason: "CHAOS TEST — program eksik yarış simülasyonu (Program Sync'in kendi verisi bozulmadı, yalnız gösterilen status zorlandı)" },
  { key: "cache_stale", label: "HOT Cache: stale", targetModuleId: "horse-cache", forcedStatus: "critical", reason: "CHAOS TEST — HOT cache stale simülasyonu" },
  { key: "agf_delayed", label: "AGF Sync: gecikmiş", targetModuleId: "agf", forcedStatus: "critical", reason: "CHAOS TEST — AGF sync gecikme simülasyonu" },
  { key: "results_missing", label: "Result Sync: eksik sonuç", targetModuleId: "results", forcedStatus: "critical", reason: "CHAOS TEST — eksik sonuç simülasyonu" },
  { key: "site_5xx", label: "Site/API: 5xx", targetModuleId: "site", forcedStatus: "critical", reason: "CHAOS TEST — Site/API 5xx simülasyonu" },
  { key: "coverage_missing", label: "Forward Coverage: telemetry eksik", targetModuleId: "forward-coverage", forcedStatus: "critical", reason: "CHAOS TEST — coverage telemetry eksik simülasyonu" },
  { key: "probability_sum_broken", label: "Model Health: probability sum bozuk", targetModuleId: "model-health", forcedStatus: "critical", reason: "CHAOS TEST — probability sum bozukluğu simülasyonu" },
  { key: "calibration_nan", label: "Calibration: NaN/rank değişimi", targetModuleId: "calibration", forcedStatus: "critical", reason: "CHAOS TEST — calibration NaN/rank invariant ihlali simülasyonu" },
  { key: "kupon_cost_mismatch", label: "Kupon: cost mismatch", targetModuleId: "coupon", forcedStatus: "critical", reason: "CHAOS TEST — kupon cost mismatch simülasyonu" },
];

export const CHAOS_TEST_DURATION_MS = 5 * 60_000; // 5dk — kullanıcı talebi "5-10dk sonra kendiliğinden kapanan"

export function findChaosScenario(key: string): ChaosScenario | undefined {
  return CHAOS_SCENARIOS.find((s) => s.key === key);
}
