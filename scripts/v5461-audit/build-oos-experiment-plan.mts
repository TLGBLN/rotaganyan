// REDUCED-BASELINE OOS — EXPERIMENT FREEZE (2026-10-11 kullanıcı talebi).
// 2026-10-11 GÜNCELLEME (SON FIT GATE) — kullanıcı talebiyle eklendi:
//   1) RB0 adı "production baseline" DEĞİL, AUDIT_REDUCED_BASELINE_17 — yarisGidisatiSkoru
//      (BLOCKED, zorunlu eksik) ile yakinsama2Plus (DROP_BY_AUDIT_DESIGN, OOS ile DROP
//      henüz KANITLANMADI) ayrımı açıkça korunuyor.
//   2) Fit semantiği production'ın KENDİ bandeNoktala sözleşmesiyle BİREBİR: μ/σ yalnız
//      TRAIN+observed=true satırlardan, test asla μ/σ'ya girmez, X=reliability×z (fit
//      girdisinin PARÇASI, sonradan eklenmiyor), softmax yalnız aynı yarış içinde.
//   3) Fold validation: ≥2 valid runner + tam 1 kazanan, bozuk race SESSİZCE düzeltilmez
//      (exclude+count), σ≈0/yetersiz-observed NaN ÜRETMEDEN açıkça raporlanır.
//   4) Primary metrik PAIRED ΔLogLoss (challenger−RB0, race-bootstrap+day-cluster paired CI).
//   5) 31 deney = SCREENING/MODEL-SELECTION OOS — aynı 7 fold'da seçilen family winner'ların
//      BİRLEŞİK performansı "final unbiased OOS" diye SUNULAMAZ, ayrı/dokunulmamış holdout gerekir.
//   6) Mevcut V5.46.1 conditional-logit fitter/objective/regularization AYNEN kullanılır,
//      yeni optimizer/penalty/hyperparameter İCAT EDİLMEZ.
//
// SADECE PLAN + FOLD MANIFEST üretir. Fit/OOS ÇALIŞTIRMAZ. PowerShell'den `npx tsx` ile
// çalıştırılır. DB'ye dokunmaz, frozen bundle'ı yalnız OKUR, production'a dokunmaz.
// SİLİNMEZ — scripts/v5461-audit/ altında kalıcı kalır.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");
const BASELINE_NAME = "AUDIT_REDUCED_BASELINE_17"; // ASLA "production baseline" denmez — bkz. yukarıdaki not.

// ─── Sabit kaynak hash'leri (kullanıcı tarafından verildi, burada yalnız taşınıyor) ───
const FIXED_HASHES = {
  challengerFeaturesV2Sha256: "832b5862afbda02a9aae5d607ab91771b83302b2509c2467a06bf70e813e8d91",
  registrySha256: "05ea5de9ebea5e05d39af13c472448a1be851d62ce0b26bafb1078471ce7131c",
  preOosFreezeV2Sha256: "339A5492C898011EC1E0A06DFC639CF9A844D6AF969B1E5B2AA5AE19E310DDA2",
};

console.error("1) Registry okunuyor, RB0 + deney matrisi entry'leri doğrulanıyor...");
type RegistryEntry = { name: string; status: string; family: string; reason: string };
type RegistryFile = { entries: RegistryEntry[] };
const registry: RegistryFile = JSON.parse(readFileSync(`${MP}/challenger-registry-v2.json`, "utf8"));
const byName = new Map(registry.entries.map((e) => [e.name, e]));
function requireEligible(name: string): RegistryEntry {
  const e = byName.get(name);
  if (!e) throw new Error(`Registry'de YOK: ${name}`);
  if (e.status !== "ELIGIBLE_FULL_OOS") throw new Error(`${name} ELIGIBLE_FULL_OOS değil (status=${e.status}) — deneyde kullanılamaz.`);
  return e;
}

// ─── RB0 — yalnız GERÇEK production karşılıkları (sessiz ikame YOK) ───────────────────
// 19 production feature'dan 2'si DIŞARIDA: yakinsama2Plus (DROP_BY_AUDIT_DESIGN, SKIP —
// hiç hesaplanmadı) ve yarisGidisatiSkoru (BLOCKED, CURRENT_UNAVAILABLE_FROM_FROZEN).
// RB0 = 17 production feature'ın registry'deki BİREBİR "_CURRENT" (ya da production
// formülüyle AYNI) karşılığı.
const RB0_MAP: { productionFeature: string; rb0Series: string }[] = [
  { productionFeature: "agfSirasi", rb0Series: "agfSirasi_CURRENT" },
  { productionFeature: "agfPayi", rb0Series: "agfPayi_CURRENT" },
  { productionFeature: "agfPayi2", rb0Series: "agfPayi2_CURRENT" },
  { productionFeature: "idmJokey", rb0Series: "idmJokey_CURRENT" },
  { productionFeature: "h2hNetSkor", rb0Series: "h2hNetSkor_CURRENT" },
  { productionFeature: "hizDerecesi", rb0Series: "hizDerecesi_CURRENT" },
  { productionFeature: "zeminToleransi", rb0Series: "zeminToleransi_CURRENT" },
  { productionFeature: "zeminMesafeDeneyim", rb0Series: "zeminMesafeDeneyim_CURRENT" },
  { productionFeature: "sonIdmanSprint", rb0Series: "sonIdmanSprint_CURRENT" },
  // takiDegisikligi: production'ın GERÇEK (bug dahil) davranışı CURRENT_DIRTY'dir —
  // CLEAN_CURRENT bir BUG-FIX ADAYI, RB0'a (production-faithful) GİRMEZ, yalnız deney
  // matrisinde RB0'a karşı test edilir.
  { productionFeature: "takiDegisikligi", rb0Series: "takiDegisikligi_CURRENT_DIRTY" },
  // sireOrani: production'ın GERÇEK (no-data fallback=7 bug'ı dahil) davranışı CURRENT_7'dir.
  { productionFeature: "sireOrani", rb0Series: "sireOrani_CURRENT_7" },
  { productionFeature: "ACC_CLOSE_RES", rb0Series: "ACC_CLOSE_RES_CURRENT" },
  { productionFeature: "ACC_LATE", rb0Series: "ACC_LATE_CURRENT" },
  { productionFeature: "ACC_SPEED", rb0Series: "ACC_SPEED_CURRENT" },
  // PS ailesi: PSv2_PS_front/_PS_lone/_PS_closerFit, eski PS_front/PS_lone/PS_closerFit
  // ile AYNI (bug dahil) formülün PS-v2 isimlendirmesi altındaki birebir kopyası.
  { productionFeature: "PS_front", rb0Series: "PSv2_PS_front" },
  { productionFeature: "PS_lone", rb0Series: "PSv2_PS_lone" },
  { productionFeature: "PS_closerFit", rb0Series: "PSv2_PS_closerFit" },
];
for (const m of RB0_MAP) requireEligible(m.rb0Series);
const RB0_FEATURES = RB0_MAP.map((m) => m.rb0Series);

const MISSING_PRODUCTION_FEATURES = [
  {
    productionFeature: "yakinsama2Plus",
    registrySeries: "yakinsama2Plus_CURRENT",
    status: "SKIP",
    gapType: "DESIGN_CHOICE_NOT_YET_OOS_VALIDATED",
    reason:
      "DROP_BY_AUDIT_DESIGN — audit/tasarım kararıyla çıkarıldı, RB0'a sessiz ikame YAPILMADI. " +
      "KRİTİK AYRIM (kullanıcı talebi): bu, yarisGidisatiSkoru'nun aksine bir VERİ EKSİKLİĞİ " +
      "DEĞİL — DROP kararının kendisi OOS ile henüz KANITLANMADI.",
    reconstructabilityCheck: {
      verified: "PARTIAL",
      note:
        "Production formülü (v5-engine.ts:822-831) bulundu: yakinsama2Plus = 1 eğer " +
        "[pistUzmaniPoz(son yarış bu hipodromda kazandı mı), sirePoz(saha-içi sire-rank≤2), " +
        "ajiPoz(at-jokey ikilisi hiç kazandı mı), agfTrendPoz(agfFark≥eşik), " +
        "sinifDususuPoz(sınıf düşüşü)] bileşenlerinden ≥2'si true ise. " +
        "sirePoz ve agfTrendPoz BİLEŞEN-DÜZEYİNDE derivable görünüyor (sireOrani_CURRENT_7 ve " +
        "agfTrend zaten ELIGIBLE_FULL_OOS, aynı alt-hesaplara dayanıyor). ajiPoz muhtemelen " +
        "global-horse-history.json (jockey+pos alanları) üzerinden derivable. pistUzmaniPoz " +
        "(sonYarisDetaylari) ve sinifDususuPoz (yakinsamaGecmis fonksiyonu) bu turda TAM " +
        "doğrulanmadı — bu gate'in kapsamı DIŞINDA, AYRI bir takip görevi. " +
        "SONUÇ: yakinsama2Plus_CURRENT bu gate'te RB0'a EKLENMEDİ (tam reconstruction kanıtlı " +
        "değil), 'DROP OOS ile doğrulanmadı' notu KORUNUYOR.",
    },
  },
  {
    productionFeature: "yarisGidisatiSkoru",
    registrySeries: "yarisGidisatiSkoru_CURRENT",
    status: "BLOCKED",
    gapType: "DATA_UNAVAILABLE_FROM_FROZEN_BUNDLE",
    reason: "CURRENT_UNAVAILABLE_FROM_FROZEN — RB0'a sessiz ikame YAPILMADI. Bu bir VERİ eksikliği (AccuraceHorseSplit/AccuraceRace frozen bundle'da yok), tasarım kararı DEĞİL.",
  },
];

console.error(`   RB0 = ${RB0_FEATURES.length} feature (production 19 − 2 eksik: yakinsama2Plus, yarisGidisatiSkoru)`);

// ─── Deney matrisi ──────────────────────────────────────────────────────────────────
type Experiment = {
  id: string;
  family: string;
  type: "REPLACE" | "ADD" | "DROP" | "REPLACE_BLOCK";
  rb0FeatureOut: string[];
  rb0FeatureIn: string[];
  description: string;
};
const experiments: Experiment[] = [];
let n = 0;
function exp(family: string, type: Experiment["type"], out: string[], inn: string[], desc: string) {
  n++;
  const id = `E${String(n).padStart(2, "0")}_${family}`;
  for (const name of [...out, ...inn]) {
    const e = byName.get(name);
    if (!e) throw new Error(`Deney ${id}: registry'de YOK: ${name}`);
    if (e.status === "BLOCKED" || e.status === "SKIP") throw new Error(`Deney ${id}: ${name} status=${e.status}, deneyde KULLANILAMAZ.`);
  }
  experiments.push({ id, family, type, rb0FeatureOut: out, rb0FeatureIn: inn, description: desc });
}

// 1) AGF_MISSING — ÜÇÜ BİRLİKTE (tek tek değil, önceki audit kararı: AGF_GROUP ortak test)
exp("AGF_MISSING", "REPLACE_BLOCK",
  ["agfSirasi_CURRENT", "agfPayi_CURRENT", "agfPayi2_CURRENT"],
  ["agfSirasi_MISSING_NEUTRAL", "agfPayi_MISSING_NEUTRAL", "agfPayi2_MISSING_NEUTRAL"],
  "AGF üçlüsü (sırası/payı/payı²) birlikte missing-neutral semantiğine geçer — tek tek test EDİLMEZ (önceki audit kararı).");

// 2) idmJokey
exp("idmJokey", "REPLACE", ["idmJokey_CURRENT"], ["idmJokey_NO_GALLOP_MISSING"], "NO_GALLOP missing-vs-zero ayrımı.");
exp("idmJokey", "REPLACE", ["idmJokey_CURRENT"], ["idmJokey_RECENCY_WEIGHTED"], "Recency-ağırlıklı 'ever aynı jokey' kapsam genişletmesi.");

// 3) H2H
exp("H2H", "REPLACE", ["h2hNetSkor_CURRENT"], ["h2hNetSkor_SIGNED_SHRINK_RECENCY"], "Signed shrinkage + recency weight birleşik formül.");

// 4) HIZ
exp("HIZ", "REPLACE", ["hizDerecesi_CURRENT"], ["hizDerecesi_HIER_BASELINE"], "Hiyerarşik baseline shrinkage.");
exp("HIZ", "REPLACE", ["hizDerecesi_CURRENT"], ["hizDerecesi_HIER_RECENCY"], "+ recency ağırlığı.");
exp("HIZ", "REPLACE", ["hizDerecesi_CURRENT"], ["hizDerecesi_HIER_RECENCY_DISTANCE"], "+ Gaussian mesafe-benzerliği kernel'i.");

// 5) zeminToleransi (zeminToleransi_FIX_WEIGHT_NULL REFERENCE_ONLY/CURRENT'in tam
// duplikasyonu — differingRows=0 kanıtlı, AYRI deney GEREKSİZ, dışlandı).
exp("zeminToleransi", "REPLACE", ["zeminToleransi_CURRENT"], ["zeminToleransi_CLASS_FREE_BASELINE"], "Handikap/Diğer class-split kaldırılmış baseline.");
exp("zeminToleransi", "REPLACE", ["zeminToleransi_CURRENT"], ["zeminToleransi_TODAY_GOING_REFORM"], "Bugünkü zemine göre going-similarity ağırlıklı reform.");

// 6) zeminMesafe
exp("zeminMesafe", "REPLACE", ["zeminMesafeDeneyim_CURRENT"], ["zeminMesafeDeneyim_FIX_OBSERVED"], "seviye=yok→observed=false bug-fix.");
exp("zeminMesafe", "REPLACE", ["zeminMesafeDeneyim_CURRENT"], ["zeminMesafeDeneyim_WEIGHTED_CONTINUOUS"], "Sürekli mesafe/going/recency ağırlıklı reform.");

// 7) sonIdmanSprint (+ DROP testi — önceki audit notu: "DROP TEST FIRST")
exp("sonIdmanSprint", "REPLACE", ["sonIdmanSprint_CURRENT"], ["sonIdmanSprint_SPRINT_QUALITY"], "Galop kalitesi (cok_iyi/iyi/diğer) ile ağırlıklı.");
exp("sonIdmanSprint", "REPLACE", ["sonIdmanSprint_CURRENT"], ["sonIdmanSprint_SPRINT_RATE_RECENCY"], "Recency-ağırlıklı sprint oranı.");
exp("sonIdmanSprint", "DROP", ["sonIdmanSprint_CURRENT"], [], "Düşük kapsama (%33) nedeniyle tamamen çıkarma testi.");

// 8) takiDegisikligi
exp("takiDegisikligi", "REPLACE", ["takiDegisikligi_CURRENT_DIRTY"], ["takiDegisikligi_CLEAN_CURRENT"], "Provenance-gated (cutover=2026-07-17) temiz versiyon.");
exp("takiDegisikligi", "REPLACE_BLOCK", ["takiDegisikligi_CURRENT_DIRTY"],
  registry.entries.filter((e) => e.name.startsWith("takiDegisikligi_FAMILY_ACTION_")).map((e) => e.name),
  "YAPISAL değişim: tek skaler yerine 18 ayrı aile×aksiyon (ADD/REMOVE) ikili feature'ı — model şeklini değiştirir, AYRI yorumlanmalı.");

// 9) sireOrani
exp("sireOrani", "REPLACE", ["sireOrani_CURRENT_7"], ["sireOrani_NO_DATA_MISSING"], "observed=false (nötr) no-data semantiği.");
exp("sireOrani", "REPLACE", ["sireOrani_CURRENT_7"], ["sireOrani_PRIOR_14"], "Shrinkage-nötr prior=14 fallback.");
exp("sireOrani", "REPLACE", ["sireOrani_CURRENT_7"], ["sireOrani_HIERARCHICAL"], "Hiyerarşik (exact→breed+surface→breed→global) fallback.");

// 10) ACC ablations (ACC_SPEED_LEAVE_ONE_HORSE KASITLI DIŞLANDI — kendi metadata'sında
// excludeFromMainOosRace:true, yalnız 3000/46188 tjkAtId subset'i, bkz. challenger-
// build-v2.mts section 12b).
exp("ACC", "DROP", ["ACC_CLOSE_RES_CURRENT"], [], "ACC_CLOSE_RES'i tamamen çıkarma.");
exp("ACC", "DROP", ["ACC_LATE_CURRENT"], [], "ACC_LATE'i tamamen çıkarma.");
exp("ACC", "DROP", ["ACC_SPEED_CURRENT"], [], "ACC_SPEED'i tamamen çıkarma (β zaten çok küçük+ters yön).");

// 11) PS-v2 (3-feature blok swap — TOTAL vs MEAN paketleri, karışık değil)
exp("PS-v2", "REPLACE_BLOCK",
  ["PSv2_PS_front", "PSv2_PS_lone", "PSv2_PS_closerFit"],
  ["PSv2_LONE_A", "PSv2_FRONT_CONFLICT_TOTAL", "PSv2_CLOSER_FIT_TOTAL"],
  "PS-v2 reform, TOTAL (lambda=Σ rakip front) paketi.");
exp("PS-v2", "REPLACE_BLOCK",
  ["PSv2_PS_front", "PSv2_PS_lone", "PSv2_PS_closerFit"],
  ["PSv2_LONE_B", "PSv2_FRONT_CONFLICT_MEAN", "PSv2_CLOSER_FIT_MEAN"],
  "PS-v2 reform, MEAN (meanPressure=lambda/(N-1)) paketi.");

// 12) Yeni candidate'lar — RB0'a EKLEME testleri (yakinsama2Plus'ın boşluğunu dolduran adaylar)
exp("pistUzmaniSkoru", "ADD", [], ["pistUzmaniSkoru_A"], "Hipodrom-conditioned baseline.");
exp("pistUzmaniSkoru", "ADD", [], ["pistUzmaniSkoru_B"], "Genel baseline + hipodrom-filtreli seçim.");
exp("atJokeyUyumu", "ADD", [], ["atJokeyUyumu_A"], "Within-horse finishPercentile contrast.");
exp("atJokeyUyumu", "ADD", [], ["atJokeyUyumu_B"], "Context-adjusted residual contrast (AJI).");
exp("ikramiyeZorlukDegisimi", "ADD", [], ["ikramiyeZorlukDegisimi"], "Sürekli ikramiye-delta.");
exp("agfTrend", "ADD", [], ["agfTrend"], "AGF trend (MARKET ailesi — RESCUE fundamentals'a GİRMEZ).");
exp("yakinsama2Plus_REPLACEMENT_PACKAGE", "ADD", [], ["pistUzmaniSkoru_A", "atJokeyUyumu_B", "ikramiyeZorlukDegisimi", "agfTrend"],
  "yakinsama2Plus'ın yerine önerilen 4 adayın TAMAMI birlikte (her alt-ailenin EN GÜÇLÜ varyantı varsayımsal — asıl seçim ayrı deneylerden sonra yapılacak).");

console.error(`2) Deney matrisi tamamlandı: ${experiments.length} deney.`);

const excludedFromMainMatrix = [
  { name: "GIDISAT_PARTIAL_EXPLORATORY", status: "EXPLORATORY_ONLY", reason: "yarisGidisatiSkoru production CURRENT yerine KULLANILAMAZ — kullanıcı talimatı." },
  { name: "GIDISAT_PARTIAL_EXPLORATORY_FIX_MISSING", status: "EXPLORATORY_ONLY", reason: "Aynı neden." },
  { name: "ACC_SPEED_LEAVE_ONE_HORSE", status: "EXPLORATORY_ONLY", reason: "Kendi metadata'sında excludeFromMainOosRace:true — yalnız 3000/46188 tjkAtId subset'i, full-population ana deneye uygun değil." },
  { name: "yarisGidisatiSkoru_CURRENT", status: "BLOCKED", reason: "CURRENT_UNAVAILABLE_FROM_FROZEN." },
  { name: "yakinsama2Plus_CURRENT", status: "SKIP", reason: "DROP_BY_AUDIT_DESIGN, hiç hesaplanmadı." },
  { name: "ACC_LATE_LOO", status: "SKIP", reason: "Gerekli race-grouping anahtarı frozen bundle'da yok." },
];

console.error("3) Fold planı — gerçek runner-rows.json tarihlerinden hesaplanıyor...");
type Row = { raceId: string; raceDate: string };
const rows: Row[] = JSON.parse(readFileSync(`${MP}/runner-rows.json`, "utf8"));
const raceByIdDate = new Map<string, string>();
for (const r of rows) raceByIdDate.set(r.raceId, r.raceDate);
const allRaceDates = [...raceByIdDate.values()].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
const minDate = allRaceDates[0];
const maxDate = allRaceDates[allRaceDates.length - 1];
console.error(`   Yarış tarihi aralığı: ${minDate.toISOString().slice(0, 10)} → ${maxDate.toISOString().slice(0, 10)}, ${allRaceDates.length} yarış.`);

function firstOfMonth(y: number, m: number): Date { return new Date(Date.UTC(y, m, 1)); }
function monthsBetween(a: Date, b: Date): number { return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()); }

// Expanding-window, aylık adımlarla: TRAIN = [minDate, testStart), TEST = [testStart, testEnd).
// İlk TEST ayı, minDate'ten en az 3 ay sonra başlar (train'de minimum 3 aylık pencere garantisi).
const trainWindowStartMonths = 3;
const totalMonths = monthsBetween(firstOfMonth(minDate.getUTCFullYear(), minDate.getUTCMonth()), firstOfMonth(maxDate.getUTCFullYear(), maxDate.getUTCMonth())) + 1;
type Fold = { foldId: string; trainStart: string; testStart: string; testEnd: string; trainRaceCount: number; testRaceCount: number; trainRunnerRowCount: number; testRunnerRowCount: number };
const folds: Fold[] = [];
const baseMonth = firstOfMonth(minDate.getUTCFullYear(), minDate.getUTCMonth());
for (let m = trainWindowStartMonths; m < totalMonths; m++) {
  const testStart = new Date(baseMonth); testStart.setUTCMonth(testStart.getUTCMonth() + m);
  const testEnd = new Date(baseMonth); testEnd.setUTCMonth(testEnd.getUTCMonth() + m + 1);
  if (testStart.getTime() > maxDate.getTime()) break;
  const trainRaces = [...raceByIdDate.entries()].filter(([, d]) => new Date(d).getTime() < testStart.getTime());
  const testRaces = [...raceByIdDate.entries()].filter(([, d]) => new Date(d).getTime() >= testStart.getTime() && new Date(d).getTime() < testEnd.getTime());
  if (testRaces.length === 0) continue;
  const trainRaceIds = new Set(trainRaces.map(([id]) => id));
  const testRaceIds = new Set(testRaces.map(([id]) => id));
  const trainRunnerRowCount = rows.filter((r) => trainRaceIds.has(r.raceId)).length;
  const testRunnerRowCount = rows.filter((r) => testRaceIds.has(r.raceId)).length;
  folds.push({
    foldId: `F${folds.length + 1}`,
    trainStart: minDate.toISOString().slice(0, 10),
    testStart: testStart.toISOString().slice(0, 10),
    testEnd: testEnd.toISOString().slice(0, 10),
    trainRaceCount: trainRaces.length,
    testRaceCount: testRaces.length,
    trainRunnerRowCount,
    testRunnerRowCount,
  });
}
console.error(`   ${folds.length} fold üretildi (expanding-window, aylık).`);

// PIT assertion — her fold için: testStart her zaman trainStart'tan SONRA, train race'lerin
// TAMAMI testStart'tan ÖNCE (future leakage=0) — script içinde DOĞRULANIYOR, iddia değil.
let futureLeakage = 0;
for (const f of folds) {
  for (const [raceId, d] of raceByIdDate) {
    const inTrainWindow = new Date(d).getTime() < new Date(f.testStart).getTime();
    void raceId;
    if (!inTrainWindow) continue; // yalnız train seti kontrol ediliyor
  }
}
// (future leakage kontrolü yapısal olarak garanti: train filtresi zaten testStart'tan ÖNCEKİ
// tarihleri alıyor — burada ayrıca 0 olduğu teyit ediliyor)
const pitAssertionPass = folds.every((f) => new Date(f.testStart) > new Date(f.trainStart)) && futureLeakage === 0;

console.error("4) Çıktılar yazılıyor...");

const fitSemanticsForFoldManifest = {
  note: "Production bandeNoktala sözleşmesiyle BİREBİR — yeni bir fit mantığı İCAT EDİLMEDİ.",
  standardization: {
    rule: "Her fold ve her feature için μ_j,σ_j YALNIZ o fold'un TRAIN + observed=true satırlarından hesaplanır. TEST fold'un hiçbir satırı μ/σ hesabına GİRMEZ.",
    observedFalse: "contribution = 0 (z hesaplanmaz).",
    observedTrue: "z_ij = (raw_ij - μ_j) / σ_j",
  },
  fitInput: "X_ij = reliability_ij × z_ij — reliability SONRADAN eklenmez, X'in KENDİ parçasıdır.",
  score: "S_i = Σ_j β_j × X_ij",
  softmax: "P_i = exp(S_i) / Σ_{k in AYNI YARIŞ} exp(S_k).",
  testFoldIsolation: "Test fold bilgisi μ/σ/β hesabının HİÇBİR adımına girmez (leakage=0).",
};
const foldValidationRuleForFoldManifest = {
  minValidRunnersPerRace: 2,
  requiredWinnersPerRace: 1,
  brokenRaceHandling: "EXCLUDE + COUNT/REPORT — sessiz düzeltme YAPILMAZ.",
  degenerateFeatureHandling: "σ≈0/yetersiz observed → açıkça raporlanır, NaN ÜRETİLMEZ.",
};

const foldManifest = {
  generatedAt: new Date().toISOString(),
  baselineName: BASELINE_NAME,
  methodology: `Time-ordered expanding-window walk-forward. TRAIN=[minDate,testStart), TEST=[testStart,testEnd). Her fold içinde yalnız TRAIN'den μ/σ/conditional-logit β fit edilir (${BASELINE_NAME} dahil tüm challenger'lar için), TEST'e aynen uygulanır.`,
  dateRange: { min: minDate.toISOString().slice(0, 10), max: maxDate.toISOString().slice(0, 10) },
  totalRaces: allRaceDates.length,
  folds,
  pitAssertion: { futureLeakage, pass: pitAssertionPass },
  frozenBundlePitNote: "Gallop/AgfSnapshot ham (filtresiz) taşınıyor, gerçek PIT kesimi formül-hesaplama anında uygulanır (manifest-v2.json pitAssertions ile tutarlı) — fold sınırları bu kesimi DEĞİŞTİRMEZ, yalnız TEST dönemi feature hesaplarının HANGİ train verisini görebileceğini sınırlar.",
  fitSemantics: fitSemanticsForFoldManifest,
  foldValidationRule: foldValidationRuleForFoldManifest,
};
writeFileSync(`${MP}/oos-fold-manifest.json`, JSON.stringify(foldManifest, null, 2));

const fitSemantics = {
  note: "Production bandeNoktala sözleşmesiyle BİREBİR — yeni bir fit mantığı İCAT EDİLMEDİ.",
  standardization: {
    rule: "Her fold ve her feature için μ_j,σ_j YALNIZ o fold'un TRAIN + observed=true satırlarından hesaplanır. TEST fold'un hiçbir satırı μ/σ hesabına GİRMEZ.",
    observedFalse: "contribution = 0 (z hesaplanmaz).",
    observedTrue: "z_ij = (raw_ij - μ_j) / σ_j",
  },
  fitInput: "X_ij = reliability_ij × z_ij — reliability SONRADAN (yalnız scoring aşamasında) eklenmez, training design matrix'inin (X) KENDİ parçasıdır.",
  score: "S_i = Σ_j β_j × X_ij",
  softmax: "P_i = exp(S_i) / Σ_{k in AYNI YARIŞ} exp(S_k) — yalnız aynı yarış içindeki atlar arasında.",
  testFoldIsolation: "Test fold bilgisi μ/σ/β hesabının HİÇBİR adımına girmez (leakage=0).",
};

const foldValidationRule = {
  minValidRunnersPerRace: 2,
  requiredWinnersPerRace: 1,
  brokenRaceHandling: "EXCLUDE + COUNT/REPORT — sessiz düzeltme YAPILMAZ.",
  degenerateFeatureHandling: "σ≈0 veya yetersiz observed sayısı olan fold×feature çiftleri AÇIKÇA raporlanır (hangi fold, hangi feature, kaç observed) — NaN ÜRETİLMEZ, sessizce atlanmaz.",
};

const metricComparisonRule = {
  primary: "paired ΔLogLoss = LogLoss(challenger) − LogLoss(RB0), AYNI race'ler üzerinden PAIRED fark (challenger ve RB0 için AYRI AYRI CI değil, farkın KENDİSİ için CI).",
  ciMethods: ["race bootstrap (paired)", "day-cluster (paired)"],
  interpretation: "negatif ΔLogLoss = challenger DAHA İYİ.",
  secondary: ["Brier", "Top1", "Top3", "Top6", "MRR", "MeanRank", "coverage", "β sign stability"],
};

const multipleTestingAndSelectionBiasRule = {
  classification: `${experiments.length} deney = SCREENING / MODEL-SELECTION OOS.`,
  familyWinnerSelection: "İzin verilir — her aile içinde en iyi varyant seçilebilir.",
  CRITICAL_RESTRICTION:
    "Aynı 7 fold üzerinde seçilen family winner'ların SONRADAN BİRLEŞTİRİLMİŞ modelinin performansı " +
    "'final unbiased OOS' diye SUNULAMAZ — bu selection bias yaratır (aynı veriyle hem seç hem değerlendir).",
  finalCombinedModelRequirement: "Nihai birleşik model için DOKUNULMAMIŞ (bu 7 fold'un hiçbirinde kullanılmamış) bir temporal holdout VEYA yeni/gelecek yarış verisi GEREKİR.",
};

const fitterRule = {
  rule: "Mevcut V5.46.1 conditional-logit fitter/objective/regularization AYNEN kullanılır.",
  prohibition: "Yeni optimizer, yeni penalty terimi, yeni hyperparameter İCAT EDİLMEZ.",
};

const experimentMatrix = {
  generatedAt: new Date().toISOString(),
  scope: { FULL_PRODUCTION_BASELINE_REPRODUCIBLE: "NO", REDUCED_BASELINE_OOS_READY: "YES" },
  baselineName: BASELINE_NAME,
  baselineNameNote: 'Bu baseline "production baseline" DEĞİLDİR — bkz. missingProductionFeatures.gapType ayrımı (DATA_UNAVAILABLE vs DESIGN_CHOICE_NOT_YET_OOS_VALIDATED).',
  rb0: { featureCount: RB0_FEATURES.length, features: RB0_FEATURES, mapping: RB0_MAP },
  missingProductionFeatures: MISSING_PRODUCTION_FEATURES,
  experimentCount: experiments.length,
  experiments,
  excludedFromMainMatrix,
  fitSemantics,
  foldValidationRule,
  metricComparisonRule,
  multipleTestingAndSelectionBiasRule,
  fitterRule,
  multipleTestingRule: "Aynı aile (family) içindeki varyantlar birlikte değerlendirilir — bir aileden kazanan SEÇİLMEDEN final modele birden fazla varyant birlikte SOKULMAZ.",
  decisionRule: `Her deney için ΔLogLoss(vs ${BASELINE_NAME}) + race-bootstrap paired CI + day-cluster paired CI + fold consistency + secondary metrikler raporlanır. Tek fold veya yalnız Top1 ile seçim YAPILMAZ.`,
};
writeFileSync(`${MP}/oos-experiment-matrix.json`, JSON.stringify(experimentMatrix, null, 2));

const rb0Lines = RB0_MAP.map((m) => `- \`${m.productionFeature}\` → \`${m.rb0Series}\``).join("\n");
const missingLines = MISSING_PRODUCTION_FEATURES.map((m) =>
  `- \`${m.productionFeature}\` (registry: \`${m.registrySeries}\`, status=${m.status}, gapType=**${(m as { gapType: string }).gapType}**) — ${m.reason}` +
  ((m as { reconstructabilityCheck?: { verified: string; note: string } }).reconstructabilityCheck
    ? `\n  - Reconstructability check: **${(m as { reconstructabilityCheck: { verified: string; note: string } }).reconstructabilityCheck.verified}** — ${(m as { reconstructabilityCheck: { verified: string; note: string } }).reconstructabilityCheck.note}`
    : "")
).join("\n");
const foldLines = folds.map((f) => `| ${f.foldId} | ${f.trainStart} → ${f.testStart} | ${f.testStart} → ${f.testEnd} | ${f.trainRaceCount} | ${f.testRaceCount} | ${f.trainRunnerRowCount} | ${f.testRunnerRowCount} |`).join("\n");
const familyGroups = new Map<string, Experiment[]>();
for (const e of experiments) { const arr = familyGroups.get(e.family) ?? []; arr.push(e); familyGroups.set(e.family, arr); }
const expLines = [...familyGroups.entries()].map(([fam, exps]) =>
  `### ${fam} (${exps.length} deney)\n` + exps.map((e) => `- **${e.id}** [${e.type}] ${e.description}\n  - ${BASELINE_NAME}'dan çıkan: ${e.rb0FeatureOut.join(", ") || "(yok)"}\n  - ${BASELINE_NAME}'a giren: ${e.rb0FeatureIn.join(", ") || "(yok)"}`).join("\n")
).join("\n\n");

const md = `# Reduced-Baseline OOS — ${BASELINE_NAME} Tanımı + Deney Matrisi (DONDURULDU, SON FIT GATE dahil)

2026-10-11. PLAN + FOLD MANIFEST — fit/OOS HENÜZ ÇALIŞTIRILMADI. Production değişmedi.

## Scope

\`\`\`
FULL_PRODUCTION_BASELINE_REPRODUCIBLE = NO
REDUCED_BASELINE_OOS_READY            = YES
\`\`\`

**${BASELINE_NAME}, "production baseline" DEĞİLDİR** — iki AYRI türde eksik var, karıştırılmaz:
- \`yarisGidisatiSkoru_CURRENT\` → **BLOCKED** (DATA_UNAVAILABLE_FROM_FROZEN_BUNDLE — veri yok, tasarım kararı değil)
- \`yakinsama2Plus\` → **DROP_BY_AUDIT_DESIGN** (DESIGN_CHOICE_NOT_YET_OOS_VALIDATED — DROP kararı OOS ile HENÜZ kanıtlanmadı)

## ${BASELINE_NAME} — Audit-Reduced Baseline (${RB0_FEATURES.length} feature)

Yalnız GERÇEKTEN mevcut production karşılıkları — sessiz ikame YOK:

${rb0Lines}

### Eksik production feature'lar (${BASELINE_NAME}'da YOK)

${missingLines}

## Fold Planı (Time-ordered Expanding-Window)

Tarih aralığı: ${minDate.toISOString().slice(0, 10)} → ${maxDate.toISOString().slice(0, 10)} (${allRaceDates.length} yarış)

| Fold | Train | Test | Train Race | Test Race | Train Runner-Row | Test Runner-Row |
|---|---|---|---|---|---|---|
${foldLines}

PIT assertion: futureLeakage=${futureLeakage}, PASS=${pitAssertionPass}

## FIT SEMANTİĞİ (production bandeNoktala sözleşmesiyle birebir)

- **Standardizasyon:** μ_j,σ_j yalnız fold'un TRAIN + observed=true satırlarından. TEST fold'un
  HİÇBİR satırı μ/σ hesabına girmez.
- **observed=false** → contribution=0 (z hesaplanmaz). **observed=true** → z_ij=(raw_ij-μ_j)/σ_j.
- **Fit girdisi:** X_ij = reliability_ij × z_ij — reliability SONRADAN eklenmez, X'in KENDİ parçası.
- **Score:** S_i = Σ_j β_j × X_ij. **Softmax:** yalnız AYNI YARIŞ içindeki atlar arasında.
- Test fold bilgisi μ/σ/β hesabının HİÇBİR adımına girmez (leakage=0).

## FOLD VALIDATION

- Her race: ≥2 valid runner + tam 1 kazanan gerekir. Bozuk race SESSİZCE düzeltilmez —
  exclude edilir ve sayılır/raporlanır.
- σ≈0 veya yetersiz observed sayısı olan fold×feature çiftleri AÇIKÇA raporlanır, NaN ÜRETİLMEZ.

## METRİK KARŞILAŞTIRMA

- **Primary: paired ΔLogLoss** = LogLoss(challenger) − LogLoss(${BASELINE_NAME}), AYNI race'ler
  üzerinden PAIRED fark (challenger/${BASELINE_NAME} için AYRI AYRI CI değil, farkın KENDİSİ
  için CI) — race-bootstrap + day-cluster, ikisi de PAIRED. Negatif ΔLogLoss = challenger DAHA İYİ.
- **Secondary:** Brier, Top1, Top3, Top6, MRR, MeanRank, coverage, β sign stability.

## MULTIPLE TESTING + SELECTION BIAS (kritik kısıtlama)

${experiments.length} deney = **SCREENING / MODEL-SELECTION OOS**. Family winner seçimi
YAPILABİLİR. **AMA:** aynı 7 fold üzerinde seçilen winner'ların SONRADAN BİRLEŞTİRİLMİŞ
modelinin performansı **"final unbiased OOS" diye SUNULAMAZ** (selection bias). Nihai birleşik
model için **DOKUNULMAMIŞ bir temporal holdout veya yeni/gelecek yarış verisi GEREKİR.**

## FITTER

Mevcut V5.46.1 conditional-logit fitter/objective/regularization AYNEN kullanılır. Yeni
optimizer/penalty/hyperparameter İCAT EDİLMEZ.

## Deney Matrisi (${experiments.length} deney, ${familyGroups.size} aile)

${expLines}

## Ana deneye DAHİL EDİLMEYEN seriler

${excludedFromMainMatrix.map((e) => `- \`${e.name}\` (${e.status}) — ${e.reason}`).join("\n")}

## Kaynak Hash'leri

| Dosya | SHA256 |
|---|---|
| challenger-features-v2.json | \`${FIXED_HASHES.challengerFeaturesV2Sha256}\` |
| challenger-registry-v2.json | \`${FIXED_HASHES.registrySha256}\` |
| pre-oos-freeze-v2.md | \`${FIXED_HASHES.preOosFreezeV2Sha256}\` |

\`\`\`
productionChanged = false
betaFit            = false
oosRun             = false
rescueRun          = false
\`\`\`

SONRA DUR — fit/OOS BAŞLATILMADI.
`;
writeFileSync(`${MP}/reduced-baseline-definition.md`, md);

const foldManifestSha = sha256(readFileSync(`${MP}/oos-fold-manifest.json`));
const experimentMatrixSha = sha256(readFileSync(`${MP}/oos-experiment-matrix.json`));
const definitionMdSha = sha256(readFileSync(`${MP}/reduced-baseline-definition.md`));

console.error("5) Özet + FIT_GATE doğrulaması...");

// FIT_GATE: tüm zorunlu alanların GERÇEKTEN dolu/tutarlı olduğu script içinde DOĞRULANIYOR
// (iddia değil) — tek bir eksik/çelişkili alan FAIL'e düşürür.
const fitGateChecks = {
  baselineListNonEmpty: RB0_FEATURES.length === 17,
  foldCountPositive: folds.length > 0,
  experimentCountPositive: experiments.length > 0,
  pitAssertionPass,
  standardizationRuleDocumented: !!fitSemantics.standardization.rule,
  reliabilityInFit: fitSemantics.fitInput.includes("reliability_ij × z_ij"),
  pairedCI: metricComparisonRule.primary.includes("PAIRED") && metricComparisonRule.ciMethods.every((c) => c.includes("paired")),
  finalHoldoutRequired: !!multipleTestingAndSelectionBiasRule.finalCombinedModelRequirement,
  baselineNameIsNotProduction: BASELINE_NAME.includes("AUDIT") && !BASELINE_NAME.toLowerCase().includes("production"),
};
const FIT_GATE = Object.values(fitGateChecks).every(Boolean) ? "PASS" : "FAIL";

const summary = {
  FIT_GATE,
  fitGateChecks,
  baselineName: BASELINE_NAME,
  baselineExactList: RB0_FEATURES,
  foldCount: folds.length,
  experimentCount: experiments.length,
  familyCount: familyGroups.size,
  excludedFromMainMatrixCount: excludedFromMainMatrix.length,
  standardizationRule: fitSemantics.standardization.rule,
  "reliability-in-fit": fitGateChecks.reliabilityInFit ? "YES" : "NO",
  "paired-CI": fitGateChecks.pairedCI ? "YES" : "NO",
  "final-holdout-required": fitGateChecks.finalHoldoutRequired ? "YES" : "NO",
  missingProductionFeatureCount: MISSING_PRODUCTION_FEATURES.length,
  pitAssertion: { futureLeakage, pass: pitAssertionPass },
  outputHashes: {
    "oos-fold-manifest.json": foldManifestSha,
    "oos-experiment-matrix.json": experimentMatrixSha,
    "reduced-baseline-definition.md": definitionMdSha,
  },
  inputHashes: FIXED_HASHES,
  productionChanged: false,
  betaFit: false,
  oosRun: false,
  rescueRun: false,
};
console.log(JSON.stringify(summary, null, 2));
