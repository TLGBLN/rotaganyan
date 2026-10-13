// BAĞIMSIZ KANIT AİLELERİ — YALNIZ HARİTA (2026-10-11 kullanıcı talebi, 2. tur — şema
// kullanıcının verdiği TAM örneğe göre sadeleştirildi).
//
// HESAPLAMA YOK — contribution/β/eşik/skor/geçmiş performans ÜRETMEZ. Yalnız: her
// feature'ın hangi aileye ait olduğunu, familyRole/correlatedWith/doubleCountAllowed'ı,
// currentAvailability/oosStatus'unu JSON'a döker. OOS FIT (PID 3768) ÇALIŞIRKEN bu script
// HAFİF kalır (yalnız küçük JSON dosyaları okur/yazar, 300MB challenger-features dosyasına
// HİÇ dokunmaz). PowerShell'den çalıştırılır. SONRA DUR.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

const EVIDENCE_FAMILIES = [
  "MARKET", "HIZ", "H2H", "PIST_MESAFE_ZEMIN", "TEMPO_STYLE", "RACE_FORM",
  "IDMAN", "TAKI", "PEDIGRI", "JOKEY", "AT_JOKEY", "SINIF_ZORLUK",
] as const;
type EvidenceFamily = (typeof EVIDENCE_FAMILIES)[number];

type FeatureMapEntry = {
  feature: string;
  family: EvidenceFamily;
  familyRole: "primary" | "component";
  correlatedWith: string[];
  doubleCountAllowed: false;
  currentAvailability: "AVAILABLE" | "FUTURE_CANDIDATE" | "UNAVAILABLE";
  oosStatus: string; // registry'nin KENDİ status değeri (ELIGIBLE_FULL_OOS/EXPLORATORY_ONLY/BLOCKED/SKIP/FUTURE_CANDIDATE) — paraphrase edilmedi
};

console.error("1) Registry + production weights okunuyor (yalnız okuma)...");
type RegistryEntry = { name: string; status: string };
const registry: { entries: RegistryEntry[] } = JSON.parse(readFileSync(`${MP}/challenger-registry-v2.json`, "utf8"));
const weights: { featureNames: string[] } = JSON.parse(
  readFileSync("C:/Users/tlgbi/OneDrive/Belgeler/Rota/rotaganyan/src/lib/methodology/weights/v546-1-weights.json", "utf8")
);
const liveProductionFeatures = new Set(weights.featureNames);
const registryStatusByName = new Map(registry.entries.map((e) => [e.name, e.status]));

// ─── Feature → aile ataması (kullanıcının verdiği TAM kurallar) ──────────────────────
const FAMILY_OF: Record<string, EvidenceFamily> = {
  agfSirasi: "MARKET", agfPayi: "MARKET", agfPayi2: "MARKET", agfTrend: "MARKET",
  hizDerecesi: "HIZ", ACC_SPEED: "HIZ",
  h2hNetSkor: "H2H",
  zeminToleransi: "PIST_MESAFE_ZEMIN", zeminMesafeDeneyim: "PIST_MESAFE_ZEMIN", pistUzmaniSkoru: "PIST_MESAFE_ZEMIN",
  yarisGidisatiSkoru: "TEMPO_STYLE", PS_front: "TEMPO_STYLE", PS_lone: "TEMPO_STYLE", PS_closerFit: "TEMPO_STYLE",
  ACC_CLOSE_RES: "RACE_FORM", ACC_LATE: "RACE_FORM",
  idmJokey: "IDMAN", sonIdmanSprint: "IDMAN",
  takiDegisikligi: "TAKI",
  sireOrani: "PEDIGRI",
  jokey30Form: "JOKEY",
  atJokeyUyumu: "AT_JOKEY",
  ikramiyeZorlukDegisimi: "SINIF_ZORLUK",
};
// yakinsama2Plus KASITLI OLARAK BURADA YOK — "bağımsız aileye alınmasın" (kullanıcı talebi).

const CORRELATED_WITH: Record<string, string[]> = {
  agfSirasi: ["agfPayi", "agfPayi2"], agfPayi: ["agfSirasi", "agfPayi2"], agfPayi2: ["agfSirasi", "agfPayi"],
  agfTrend: ["agfSirasi", "agfPayi"],
  hizDerecesi: ["ACC_SPEED"], ACC_SPEED: ["hizDerecesi"],
  PS_front: ["PS_lone", "PS_closerFit"], PS_lone: ["PS_front", "PS_closerFit"], PS_closerFit: ["PS_front", "PS_lone"],
  ACC_CLOSE_RES: ["ACC_LATE"], ACC_LATE: ["ACC_CLOSE_RES"],
  zeminToleransi: ["zeminMesafeDeneyim", "pistUzmaniSkoru"], zeminMesafeDeneyim: ["zeminToleransi", "pistUzmaniSkoru"], pistUzmaniSkoru: ["zeminToleransi", "zeminMesafeDeneyim"],
  idmJokey: ["sonIdmanSprint"], sonIdmanSprint: ["idmJokey"],
  jokey30Form: ["atJokeyUyumu"], atJokeyUyumu: ["jokey30Form"],
};

// "ACC_CLOSE_RES + ACC_LATE + ACC_SPEED → aynı aileye körlemesine üç oy sayma; rollerini
// açık yaz" — kullanıcı talebi: bu üçü AYNI aileye DEĞİL (ACC_SPEED=HIZ, CLOSE_RES/LATE=
// RACE_FORM) atandı, roller açıkça farklı: ACC_SPEED "hız/yetenek" ölçer (component, bkz.
// hizDerecesi'nin yanında), ACC_CLOSE_RES/ACC_LATE "yarış-içi kapanış gücü" ölçer (primary,
// RACE_FORM). Bu AYRIM kasıtlı — kör "ACC ailesi" diye TEK gruba atamadık.
const FAMILY_ROLE: Record<string, "primary" | "component"> = {
  agfSirasi: "primary", agfPayi: "primary", agfPayi2: "component", agfTrend: "component",
  hizDerecesi: "primary", ACC_SPEED: "component",
  h2hNetSkor: "primary",
  zeminToleransi: "primary", zeminMesafeDeneyim: "primary", pistUzmaniSkoru: "component",
  yarisGidisatiSkoru: "primary", PS_front: "component", PS_lone: "component", PS_closerFit: "component",
  ACC_CLOSE_RES: "primary", ACC_LATE: "primary",
  idmJokey: "primary", sonIdmanSprint: "component",
  takiDegisikligi: "primary", sireOrani: "primary",
  jokey30Form: "primary", atJokeyUyumu: "primary", ikramiyeZorlukDegisimi: "primary",
};

const PS_REPRESENTATIVE: Record<string, string> = { PS_front: "PSv2_PS_front", PS_lone: "PSv2_PS_lone", PS_closerFit: "PSv2_PS_closerFit" };

function oosStatusFor(feature: string): string {
  const repName = PS_REPRESENTATIVE[feature] ?? (feature === "yarisGidisatiSkoru" ? "yarisGidisatiSkoru_CURRENT" : `${feature}_CURRENT`);
  const direct = registryStatusByName.get(repName);
  if (direct) return direct;
  if (["jokey30Form", "atJokeyUyumu", "ikramiyeZorlukDegisimi", "pistUzmaniSkoru"].includes(feature)) {
    const altName = feature === "pistUzmaniSkoru" ? "pistUzmaniSkoru_A" : feature === "atJokeyUyumu" ? "atJokeyUyumu_A" : feature;
    return registryStatusByName.get(altName) ?? "FUTURE_CANDIDATE";
  }
  if (feature === "agfTrend") return registryStatusByName.get("agfTrend") ?? "FUTURE_CANDIDATE";
  return "UNKNOWN";
}
function currentAvailabilityFor(feature: string): FeatureMapEntry["currentAvailability"] {
  if (feature === "yarisGidisatiSkoru") return "UNAVAILABLE"; // BLOCKED
  if (liveProductionFeatures.has(feature) || liveProductionFeatures.has(feature.replace(/^PS_/, "PS_"))) return "AVAILABLE";
  return "FUTURE_CANDIDATE";
}

const features: FeatureMapEntry[] = Object.keys(FAMILY_OF).map((feature) => ({
  feature,
  family: FAMILY_OF[feature],
  familyRole: FAMILY_ROLE[feature] ?? "primary",
  correlatedWith: CORRELATED_WITH[feature] ?? [],
  doubleCountAllowed: false,
  currentAvailability: currentAvailabilityFor(feature),
  oosStatus: oosStatusFor(feature),
}));

// yakinsama2Plus — ayrı, aile DIŞI kayıt (kullanıcı talebi, 2026-10-11 ikinci tur: "analiz
// gerekçesi YOK, kanıt ailesi YOK, BANKO/İlk3/İlk6 sayımına GİRMEZ, rescue kararına GİRMEZ,
// kullanıcıya pozitif/negatif sinyal olarak GÖSTERİLMEZ, yalnız teknik/debug ekranında
// LEGACY_PRODUCTION_ONLY"). Kod tarafında karşılığı: src/app/api/admin/test-v5-engine/
// route.ts (enGuclu filtrelemesi) + V5AnalysisPanel.tsx (cekilenAtNotlari narrative satırı
// kaldırıldı) — ikisi de BU TARİHTE düzeltildi, production score DEĞİŞMEDİ.
const unmapped = [
  {
    feature: "yakinsama2Plus",
    family: "NONE",
    status: "DROP_BY_AUDIT_DESIGN",
    analysisEligible: false,
    evidenceEligible: false,
    rescueEligible: false,
    productionScoringStatus: "ACTIVE_UNCHANGED", // v546-1-engine.ts'in 19-feature score'unda HÂLÂ hesaplanıyor — bu turda DOKUNULMADI
    uiLabel: "yakinsama2Plus — LEGACY PRODUCTION ONLY (yeni analiz mimarisinde kullanılmıyor)",
    note: "Bağımsız aileye alınmadı — bileşenleri (pistUzmaniSkoru/atJokeyUyumu/ikramiyeZorlukDegisimi/agfTrend) ayrı adaylar olarak kendi ailelerinde.",
  },
];

// GIDISAT_PARTIAL_* — production feature DEĞİL, yarisGidisatiSkoru'nun CURRENT'ine karşılık
// GELMEYEN exploratory seriler — ayrı not olarak kaydediliyor (kullanıcı talebi).
const gidisatPartialNote = {
  series: ["GIDISAT_PARTIAL_EXPLORATORY", "GIDISAT_PARTIAL_EXPLORATORY_FIX_MISSING"],
  family: "TEMPO_STYLE",
  oosStatus: "EXPLORATORY_ONLY",
  note: "yarisGidisatiSkoru_CURRENT'in (BLOCKED) YERİNE GEÇMEZ — yalnız tanısal.",
};

const familyGroups: Record<EvidenceFamily, string[]> = Object.fromEntries(EVIDENCE_FAMILIES.map((f) => [f, [] as string[]])) as Record<EvidenceFamily, string[]>;
for (const f of features) familyGroups[f.family].push(f.feature);

// Duplicate-family-assignment kontrolü — aynı feature adı birden fazla kez FAMILY_OF'ta
// GEÇMİŞ Mİ (yapısal olarak Object.keys zaten tekil ama script-kanıtlı doğrulama isteniyor).
const featureNameCounts = new Map<string, number>();
for (const f of features) featureNameCounts.set(f.feature, (featureNameCounts.get(f.feature) ?? 0) + 1);
const duplicateFamilyAssignments = [...featureNameCounts.entries()].filter(([, c]) => c > 1).map(([name]) => name);

const map = {
  generatedAt: new Date().toISOString(),
  purpose: "YALNIZ HARİTA — contribution/β/eşik/skor/geçmiş performans hesaplanmadı. OOS bittikten sonra, HER TEST FOLD'un yalnız kendi TRAIN μ/σ/β'siyle (out-of-sample) family-contribution + Win/Top3/Top6 gerçekleşme oranı AYRI bir adımda ölçülecek.",
  evidenceFamilies: EVIDENCE_FAMILIES,
  familyGroups,
  features,
  unmapped,
  gidisatPartialNote,
  productionChanged: false,
  oosRun: false,
  heavyComputation: false,
};
writeFileSync(`${MP}/independent-evidence-family-map.json`, JSON.stringify(map, null, 2));
const mapSha = sha256(readFileSync(`${MP}/independent-evidence-family-map.json`));

const blockedCount = features.filter((f) => f.oosStatus === "BLOCKED").length;
const exploratoryCount = features.filter((f) => f.oosStatus === "EXPLORATORY_ONLY").length;
const futureCandidateCount = features.filter((f) => f.currentAvailability === "FUTURE_CANDIDATE").length;

console.log(JSON.stringify({
  familyCount: EVIDENCE_FAMILIES.length,
  mappedFeatureCount: features.length,
  unmappedFeatureCount: unmapped.length,
  duplicateFamilyAssignments,
  blockedCount,
  exploratoryCount,
  futureCandidateCount,
  SHA256: mapSha,
  productionChanged: false,
  oosRun: false,
}, null, 2));
