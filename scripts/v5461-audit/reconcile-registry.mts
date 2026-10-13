// PRE-OOS GATE — ADIM 1: 78→80 RECONCILIATION (2026-10-11 kullanıcı talebi).
//
// SALT OKUMA — challenger-features-v2.json ve challenger-registry-v2.json'ı okur,
// hiçbir dosyayı DEĞİŞTİRMEZ, DB'ye dokunmaz, OOS/Beta/RESCUE tetiklemez. PowerShell'den
// `npx tsx` ile çalıştırılır. SİLİNMEZ — scripts/v5461-audit/ altında kalıcı kalır.
//
// Sınıflandırma kuralları (madde 4) SCRIPT İÇİNDE, registry entry'sinin KENDİ status/
// reason/name alanlarından TÜRETİLİR — elle "bence şudur" ataması YOK, her karar hangi
// kuralın tetiklendiğini (matchedRule) raporla birlikte taşır.
import { readFileSync, writeFileSync } from "node:fs";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const FEATURES_PATH = `${MP}/challenger-features-v2.json`;
const REGISTRY_PATH = `${MP}/challenger-registry-v2.json`;
const OUT_PATH = `${MP}/count-reconciliation.json`;

type Chal = { raw: number | null; observed: boolean; reliability: number };
type FeatureRow = { raceId: string; runnerId: string; win: boolean; challengers: Record<string, Chal> };
type RegistryEntry = {
  name: string;
  coverage: { observed: number; total: number; pct: number };
  family: string;
  formulaVersion: string;
  observedRule: string;
  reliabilityRule: string;
  pitStatus: string;
  status: "ELIGIBLE_FULL_OOS" | "EXPLORATORY_ONLY" | "SKIP" | "BLOCKED" | "REFERENCE_ONLY";
  reason: string;
};
type RegistryFile = {
  totalSeries: number;
  counts: Record<string, number>;
  entries: RegistryEntry[];
};

console.error("1) Dosyalar okunuyor...");
const featureRows: FeatureRow[] = JSON.parse(readFileSync(FEATURES_PATH, "utf8"));
const registry: RegistryFile = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));

console.error("2) challenger-features-v2.json'dan canonical feature/series isimleri çıkarılıyor...");
const featureNameSet = new Set<string>();
for (const row of featureRows) for (const name of Object.keys(row.challengers)) featureNameSet.add(name);
const featuresV2Count = featureNameSet.size;

console.error("3) challenger-registry-v2.json'dan tüm entry isimleri çıkarılıyor...");
const registryNameSet = new Set(registry.entries.map((e) => e.name));
const registryEntryCount = registry.entries.length;
// Veri bütünlüğü kontrolü (iddia değil, doğrulama): registry.totalSeries alanı entries.length ile uyumlu mu?
const registryTotalSeriesFieldMatchesEntries = registry.totalSeries === registryEntryCount;
// Veri bütünlüğü kontrolü: registry içinde isim tekrarı var mı?
const registryDuplicateNames = registry.entries.length - registryNameSet.size;

console.error("4) Exact set-diff üretiliyor (registryOnly / featuresOnly / intersection)...");
const registryOnly = [...registryNameSet].filter((n) => !featureNameSet.has(n)).sort();
const featuresOnly = [...featureNameSet].filter((n) => !registryNameSet.has(n)).sort();
const intersection = [...featureNameSet].filter((n) => registryNameSet.has(n)).sort();

console.error("5) Registry-only entry'ler sınıflandırılıyor (kural-bazlı, status/reason/name'den)...");
type Classification = "REAL_FEATURE" | "REFERENCE_ALIAS" | "DROP_FLAG" | "ABLATION_FLAG" | "METADATA_ONLY" | "BLOCKED_PLACEHOLDER" | "OTHER";

function classify(e: RegistryEntry): { classification: Classification; matchedRule: string } {
  // Kural sırası önemli — en spesifik kural önce denenir.
  if (e.status === "BLOCKED") {
    return { classification: "BLOCKED_PLACEHOLDER", matchedRule: 'status === "BLOCKED"' };
  }
  if (e.status === "REFERENCE_ONLY") {
    return { classification: "REFERENCE_ALIAS", matchedRule: 'status === "REFERENCE_ONLY"' };
  }
  if (e.status === "SKIP" && /DROP_BY_AUDIT_DESIGN/i.test(e.reason)) {
    return { classification: "DROP_FLAG", matchedRule: 'status === "SKIP" AND reason matches /DROP_BY_AUDIT_DESIGN/i' };
  }
  if (e.status === "SKIP" && (/_LOO$/i.test(e.name) || /leave-one-out|leave one out|ablation/i.test(e.reason))) {
    return { classification: "ABLATION_FLAG", matchedRule: 'status === "SKIP" AND (name ends with "_LOO" OR reason mentions leave-one-out/ablation)' };
  }
  if (e.status === "SKIP") {
    return { classification: "METADATA_ONLY", matchedRule: 'status === "SKIP" (başka hiçbir kural eşleşmedi, hesaplanmamış seri — yalnız izlenebilirlik kaydı)' };
  }
  if (e.status === "ELIGIBLE_FULL_OOS" || e.status === "EXPLORATORY_ONLY") {
    // Bu dal ancak intersection DIŞINDA (registryOnly) bir ELIGIBLE/EXPLORATORY entry varsa
    // tetiklenir — yani registry'de "hesaplandı" diye işaretli ama features dosyasında YOK
    // demektir. Bu GERÇEK bir tutarsızlık, REAL_FEATURE sayılmaz, OTHER olarak işaretlenip
    // elle incelemeye bırakılır (uydurma sınıflandırma YAPILMAZ).
    return { classification: "OTHER", matchedRule: `status === "${e.status}" AMA features-v2.json'da YOK — beklenmeyen tutarsızlık, elle incelenmeli` };
  }
  return { classification: "OTHER", matchedRule: "hiçbir kural eşleşmedi" };
}

const registryOnlyDetailed = registryOnly.map((name) => {
  const entry = registry.entries.find((e) => e.name === name)!;
  const { classification, matchedRule } = classify(entry);
  return { name, status: entry.status, family: entry.family, reason: entry.reason, classification, matchedRule };
});

const featuresOnlyDetailed = featuresOnly.map((name) => ({ name, note: "features-v2.json'da hesaplanmış AMA registry-v2.json'da HİÇ entry'si yok — registry eksik, elle tamamlanmalı." }));

console.error("6) canonicalFeatureCount hesaplanıyor (yalnız REAL_FEATURE sayılan entry'ler dahil)...");
const registryOnlyRealFeatureCount = registryOnlyDetailed.filter((e) => e.classification === "REAL_FEATURE").length;
const canonicalFeatureCount = intersection.length + registryOnlyRealFeatureCount;

const eligibleFeatureCount = registry.counts["ELIGIBLE_FULL_OOS"] ?? 0;
const exploratoryFeatureCount = registry.counts["EXPLORATORY_ONLY"] ?? 0;
const skipFeatureCount = registry.counts["SKIP"] ?? 0;
const blockedFeatureCount = registry.counts["BLOCKED"] ?? 0;
const referenceFeatureCount = registry.counts["REFERENCE_ONLY"] ?? 0;
const countsSum = eligibleFeatureCount + exploratoryFeatureCount + skipFeatureCount + blockedFeatureCount + referenceFeatureCount;

const allRegistryOnlyClassified = registryOnlyDetailed.every((e) => e.classification !== "OTHER");
const gapFullyExplained = featuresOnly.length === 0 && registryOnly.length === registryEntryCount - featuresV2Count;
const COUNT_RECONCILED = gapFullyExplained && allRegistryOnlyClassified && countsSum === registryEntryCount && registryTotalSeriesFieldMatchesEntries && registryDuplicateNames === 0;

console.error(`7) COUNT_RECONCILED = ${COUNT_RECONCILED ? "YES" : "NO"}`);

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: { features: FEATURES_PATH, registry: REGISTRY_PATH },
  integrityChecks: {
    registryTotalSeriesFieldMatchesEntries,
    registryDuplicateNames,
    registryCountsSumMatchesEntryCount: countsSum === registryEntryCount,
  },
  featuresV2Count,
  registryEntryCount,
  intersectionCount: intersection.length,
  registryOnlyCount: registryOnly.length,
  featuresOnlyCount: featuresOnly.length,
  // Madde 5 — +2 farkın TAM isimleri ve sınıflandırması:
  registryOnlyDetailed,
  featuresOnlyDetailed,
  canonicalFeatureCount,
  eligibleFeatureCount,
  exploratoryFeatureCount,
  skipFeatureCount,
  blockedFeatureCount,
  referenceFeatureCount,
  countsSumCheck: { countsSum, registryEntryCount, matches: countsSum === registryEntryCount },
  COUNT_RECONCILED: COUNT_RECONCILED ? "YES" : "NO",
  note:
    "canonicalFeatureCount yalnız GERÇEKTEN hesaplanmış (features-v2.json'da karşılığı olan VEYA " +
    "registryOnly'de REAL_FEATURE sınıflandırılan) entry'leri sayar. REFERENCE_ONLY/SKIP/DROP_FLAG/" +
    "ABLATION_FLAG/METADATA_ONLY/BLOCKED_PLACEHOLDER entry'ler bu toplama GİRMEZ.",
};

writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
console.error(`8) Rapor yazıldı: ${OUT_PATH}`);
console.log(JSON.stringify(report, null, 2));
