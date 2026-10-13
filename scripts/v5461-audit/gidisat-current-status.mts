// PRE-OOS GATE — ADIM 2: yarisGidisatiSkoru CURRENT STATUS (2026-10-11 kullanıcı talebi).
//
// SALT bu adımı yapar — OOS/Beta/RESCUE başlatmaz, DB'ye bağlanmaz, production kodunu
// değiştirmez. PowerShell'den `npx tsx` ile çalıştırılır. SİLİNMEZ.
//
// Bu dosya, src/lib/methodology/v546-1-engine.ts (scoreV461), src/server/actions/
// tempo-tasima-gucu.actions.ts (hesaplaTempoTasimaGucuMap) ve src/lib/methodology/
// veri-toplama.ts (fetchAccuraceGecmisKayitlari) KAYNAK KODUNUN OKUNMASIYLA (statik
// analiz, bu konuşmanın kendi Read/Grep çıktıları) elde edilen bulguları, SCRIPT
// ÜZERİNDEN registry'ye ve bir karar raporuna işler — DB sorgusu ÇALIŞTIRMAZ (production
// path'in KENDİSİ zaten DB'ye bağımlı olduğu için, frozen bundle'dan tekrar-üretilebilirlik
// sorusu DOĞRUDAN "bu DB tablosu frozen bundle'da var mı" sorusuna indirgeniyor — kod
// okuması bunu kanıtlamaya yeterli, ayrıca sorgu ÇALIŞTIRMAYA gerek yok).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const REGISTRY_PATH = `${MP}/challenger-registry-v2.json`;
const STATUS_PATH = `${MP}/gidisat-current-status.json`;
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

type RegistryEntry = {
  name: string;
  coverage?: { observed: number; total: number; pct: number };
  family: string;
  formulaVersion: string;
  observedRule: string;
  reliabilityRule: string;
  pitStatus: string;
  status: "ELIGIBLE_FULL_OOS" | "EXPLORATORY_ONLY" | "SKIP" | "BLOCKED" | "REFERENCE_ONLY";
  reason: string;
  computed?: boolean;
};
type RegistryFile = {
  generatedAt: string;
  totalSeries: number;
  counts: Record<string, number>;
  trueDuplicates: unknown[];
  hypothesisDistinctPairs: unknown[];
  nearDuplicates: unknown[];
  entries: RegistryEntry[];
};

console.error("1) AKTİF PRODUCTION PATH (statik kod okuması ile) belgeleniyor...");

const PRODUCTION_PATH = {
  entryPoint: "scoreV461 — src/lib/methodology/v546-1-engine.ts:84-205",
  legacyPathExcluded: "v5-engine.ts (V5.46/legacy) KULLANILMADI — v546-1-engine.ts kendi yorumunda açıkça belirtiyor: \"V5.46.1 burada offline ile AYNI taze hesabı kullanır — V5.46/v5-engine.ts'e DOKUNULMADI.\" (satır 121-125)",
  chain: [
    {
      step: 1,
      fn: "fetchAccuraceGecmisKayitlari(runnerNames, raceDate)",
      file: "src/server/actions/tempo-tasima-gucu.actions.ts değil — src/lib/methodology/veri-toplama.ts:125-160",
      queries: [
        "db.accuraceHorseSplit.findMany({ where: { horseName: {in:...} }, select: { horseName, accuraceRaceId, checkpoints, place } })",
        "fetchAccuraceRacesByIds(hamRaceIds) — db.accuraceRace.findMany({ where: { id: {in:...} } }) üzerinden (gerçek AccuraceRace.id ile)",
      ],
      note: "Gruplama anahtarı GERÇEK accuraceRaceId (AccuraceHorseSplit.accuraceRaceId → AccuraceRace.id ilişkisi) — proxy/tahmini bir anahtar DEĞİL.",
    },
    {
      step: 2,
      fn: "analizEtTekYaris(checkpoints, length, siblingCount) + hesaplaYuzdelikSelfVsSiblings(ilkYariOrtHiz, saha)",
      file: "src/lib/methodology/v546-1-engine.ts:132-152 (pace-analizi.ts fonksiyonlarını çağırır)",
      note: "ilkYariHizByRaceId Map'i GERÇEK accuraceRaceId ile anahtarlanıyor — \"sibling-percentile\" girdisi (erkenHizYuzdelikleri) bu haritadan geliyor, yarışın SAHASI (o yarıştaki TÜM atlar) gerekiyor.",
    },
    {
      step: 3,
      fn: "hesaplaCokYarisEgilimi(sonuclar, yuzdelikler) → tempoProfilleri[i]",
      file: "src/lib/methodology/pace-analizi.ts:140-162",
      note: "erkenHizYuzdelikleri OPSİYONEL parametre (yoksa [] = erkenHizGucu farklı/degrade hesaplanır) — ama production HER ZAMAN gerçek sibling-percentile verisiyle çağırıyor.",
    },
    {
      step: 4,
      fn: "hesaplaTempoTasimaGucuMap(runnerNames, raceDate)",
      file: "src/server/actions/tempo-tasima-gucu.actions.ts:85-110",
      queries: ["db.accuraceRace.findMany({ select: { date, length, splits: { select: { horseName, checkpoints } } } })"],
      note: "Her ar (AccuraceRace satırı) GERÇEK bir yarış — ar.splits o yarışın GERÇEK atları (Prisma relation, accuraceRaceId FK üzerinden). \"en iyi son800\" bu gerçek saha içinde hesaplanıyor. Veri yoksa 0 (nötr) döner, null DEĞİL.",
    },
    {
      step: 5,
      fn: "hesaplaYarisGidisati(tempoProfilleri, distance, tempoTasimaListesi) → finalSkor",
      file: "src/lib/methodology/pace-analizi.ts:418-441",
      note: "tempoTasimaGucuListesi OPSİYONEL 3. parametre — ama production HER ZAMAN gerçek (AccuraceRace tabanlı) bir liste veriyor. tempoTasima!=null olduğunda hamSkor = stilUyumu + zorluk·tempoTasima·4 (TEMPO_TASIMA_OLCEK) — tempoTasima=0 olan (geçmişi olmayan) atlarda bu terim sıfırlanır, ama GERÇEK geçmişi olan atlarda MATERYAL bir fark yaratır.",
    },
    {
      step: 6,
      fn: 'bandeNoktala("yarisGidisatiSkoru", finalSkor ?? 0, true, 1)',
      file: "src/lib/methodology/v546-1-engine.ts:190",
      note: "CONFIRMED BUG (daha önce de tespit edildi, bu adımda DEĞİŞTİRİLMEDİ): observed=true SABİT geçiliyor — finalSkor=null olsa bile raw=0, observed=true yazılıyor. Bu adımın konusu DEĞİL, yalnız kayıt altına alınıyor.",
    },
  ],
};

console.error("2) FROZEN INPUT CHECK...");
const frozenInputCheck = [
  {
    input: "AccuraceHorseSplit {horseName, accuraceRaceId, checkpoints, place}",
    status: "MISSING",
    detail:
      "Frozen master-pit bundle'da global-accurace-runs.json YALNIZ düzleştirilmiş AccuraceRun tipini (src/lib/accurace/types.ts:16-34) taşıyor — bu tipte accuraceRaceId/citySlug/raceNo YOK, yalnız hippodrome(string)+date+length var. AccuraceHorseSplit/AccuraceRace (gerçek ilişkisel tablolar) frozen bundle'a HİÇ YAKALANMADI.",
  },
  {
    input: "AccuraceRace {id, date, citySlug, raceNo, length, ground, hippodrome}",
    status: "MISSING",
    detail: "Aynı neden — prisma/schema.prisma:345-362'deki @@unique([date,citySlug,raceNo]) gerçek yarış kimliği frozen bundle'da hiçbir dosyada temsil edilmiyor.",
  },
  {
    input: "Sibling-percentile girdisi (erkenHizYuzdelikleri / hesaplaYuzdelikSelfVsSiblings çıktısı)",
    status: "MISSING",
    detail: "Doğrudan yukarıdaki AccuraceHorseSplit/AccuraceRace eksikliğine bağımlı — gerçek accuraceRaceId gruplaması olmadan 'bu yarıştaki saha' hesaplanamaz.",
  },
  {
    input: "tempoTasimaGucu girdisi (hesaplaTempoTasimaGucuMap çıktısı)",
    status: "MISSING",
    detail: "Doğrudan AccuraceRace.splits (gerçek ilişki) eksikliğine bağımlı.",
  },
  {
    input: "tempoProfilleri'nin KENDİ atın geçmiş checkpoint/fieldSize'ı (analizEtTekYaris için)",
    status: "DERIVABLE",
    detail: "Bu kısım AccuraceRun.checkpoints + AccuraceRun.fieldSize üzerinden (frozen bundle'da VAR) reconstruct edilebiliyor — GIDISAT_PARTIAL_EXPLORATORY bunu zaten kullanıyor. Yalnız sibling-percentile KISMI eksik.",
  },
];

console.error("3) KARAR: CURRENT_RECONSTRUCTABLE belirleniyor...");
const CURRENT_RECONSTRUCTABLE = frozenInputCheck.some((i) => i.status === "MISSING") ? "NO" : "YES";

const correctionNote =
  "ÖNCEKİ TANI DÜZELTMESİ (kullanıcı kuralı: önce yanlışı söyle, kanıtı göster, sonra hareket et): " +
  "Daha önce (pre-oos-freeze.md Bölüm G) BLOCKED sonucu, '(date,length,hippodrome) proxy-anahtarıyla " +
  "AccuraceRun gruplaması test edildi, 984/2510 (%39.2) grupta tutarsız fieldSize bulundu' mekanizmasıyla " +
  "açıklanmıştı. Bu turda, scoreV461'in GERÇEK production zincirini (fetchAccuraceGecmisKayitlari → " +
  "hesaplaTempoTasimaGucuMap) kod-okumasıyla takip edince görüldü ki: production BU YOLU (AccuraceRun / " +
  "global-accurace-runs.json) HİÇ KULLANMIYOR — doğrudan AccuraceHorseSplit/AccuraceRace ilişkisel " +
  "tablolarını, GERÇEK accuraceRaceId FK'si üzerinden sorguluyor (belirsizlik YOK, tam kesin gruplama). " +
  "SONUÇ (BLOCKED) AYNI kalıyor ama MEKANİZMA değişti: sorun 'tahmini anahtarla gruplama belirsizliği' " +
  "DEĞİL, 'gerekli tablonun (AccuraceHorseSplit/AccuraceRace) frozen bundle'a hiç yakalanmamış olması'. " +
  "Önceki %39.2 ölçümü YANLIŞ DEĞİL ama YANLIŞ SORUYA cevap veriyordu (AccuraceRun'ın kendi tutarlılığını " +
  "ölçüyordu, ama production bu tabloyu bu amaç için zaten kullanmıyor).";

console.error(`   CURRENT_RECONSTRUCTABLE = ${CURRENT_RECONSTRUCTABLE}`);

console.error("4) Registry güncelleniyor...");
const registry: RegistryFile = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));

const alreadyExists = registry.entries.some((e) => e.name === "yarisGidisatiSkoru_CURRENT");
if (alreadyExists) {
  console.error("   UYARI: yarisGidisatiSkoru_CURRENT zaten registry'de var — tekrar eklenmiyor (idempotent).");
} else {
  const newEntry: RegistryEntry = {
    name: "yarisGidisatiSkoru_CURRENT",
    family: "yarisGidisatiSkoru",
    formulaVersion: "production scoreV461 path (v546-1-engine.ts) — AccuraceHorseSplit/AccuraceRace tabanlı sibling-percentile + tempoTasimaGucu",
    observedRule: "N/A — hiç hesaplanamadı (gerekli girdi frozen bundle'da yok)",
    reliabilityRule: "N/A",
    pitStatus: "N/A — reconstruction denenemedi (girdi eksik)",
    status: "BLOCKED",
    computed: false,
    reason:
      "CURRENT_UNAVAILABLE_FROM_FROZEN — AccuraceHorseSplit/AccuraceRace (gerçek accuraceRaceId ilişkisi) " +
      "frozen master-pit bundle'a hiç yakalanmadı; yalnız düzleştirilmiş AccuraceRun (global-accurace-runs.json) " +
      "mevcut, bu production'ın tempoTasimaGucu/sibling-percentile hesabı için YETERSİZ. GIDISAT_PARTIAL_EXPLORATORY " +
      "ve GIDISAT_PARTIAL_EXPLORATORY_FIX_MISSING bu CURRENT'in YERİNE KULLANILAMAZ, ikisi de EXPLORATORY_ONLY kalır.",
  };
  registry.entries.push(newEntry);
  registry.totalSeries = registry.entries.length;
  registry.counts["BLOCKED"] = (registry.counts["BLOCKED"] ?? 0) + 1;
  registry.generatedAt = new Date().toISOString();
}

// GIDISAT_PARTIAL_EXPLORATORY / _FIX_MISSING — DOKUNULMADI, yalnız doğrulandı.
const gidisatPartialEntries = registry.entries.filter((e) => e.name.startsWith("GIDISAT_PARTIAL_EXPLORATORY"));
const gidisatPartialStatusUnchanged = gidisatPartialEntries.every((e) => e.status === "EXPLORATORY_ONLY");

writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
const registrySha256 = sha256(readFileSync(REGISTRY_PATH));
console.error(`   Registry güncellendi, yeni SHA256=${registrySha256}`);

console.error("5) COUNT UPDATE hesaplanıyor...");
// DÜZELTME (ilk yazımda bug vardı — farkedildi ve düzeltildi, bkz. konuşma geçmişi):
// `e.computed !== false` filtresi yalnız YENİ eklenen BLOCKED placeholder'ın computed:false
// alanını dışlıyordu — ama 2 eski SKIP entry'sinin (ACC_LATE_LOO/yakinsama2Plus_CURRENT)
// HİÇ `computed` alanı yok (undefined), bu yüzden undefined!==false=true olup YANLIŞLIKLA
// "hesaplanmış" sayılıyorlardı (80 çıkıyordu, doğrusu Adım 1'in canonicalFeatureCount'uyla
// TUTARLI olmalı: 78). Artık STATUS kümesine göre sayılıyor — Adım 1'deki (reconcile-
// registry.mts) mantıkla BİREBİR aynı: yalnız ELIGIBLE_FULL_OOS+EXPLORATORY_ONLY+
// REFERENCE_ONLY "gerçekten hesaplanmış" sayılır; SKIP ve BLOCKED (computed=false
// placeholder'lar) sayılmaz.
const COMPUTED_STATUSES = new Set(["ELIGIBLE_FULL_OOS", "EXPLORATORY_ONLY", "REFERENCE_ONLY"]);
const computedSeriesCount = registry.entries.filter((e) => COMPUTED_STATUSES.has(e.status)).length;
const registryEntryCount = registry.entries.length;
const eligibleFullOOSCount = registry.entries.filter((e) => e.status === "ELIGIBLE_FULL_OOS").length;
const exploratoryComputedCount = registry.entries.filter((e) => e.status === "EXPLORATORY_ONLY" && e.computed !== false).length;
const referenceOnlyComputedCount = registry.entries.filter((e) => e.status === "REFERENCE_ONLY" && e.computed !== false).length;
const skipPlaceholderCount = registry.entries.filter((e) => e.status === "SKIP").length;
const blockedPlaceholderCount = registry.entries.filter((e) => e.status === "BLOCKED").length;

console.error("6) gidisat-current-status.json yazılıyor...");
const oosImpact = {
  ifNotReconstructable: [
    "BASE vs DROP_GIDISAT full-OOS ablation karşılaştırması = BLOCKED (çalıştırılamaz, production CURRENT yok).",
    "yarisGidisatiSkoru için KEEP/DROP kararı bu batch'te VERİLEMEZ.",
    "GIDISAT_PARTIAL_EXPLORATORY / _FIX_MISSING sonuçları production kararına ÇEVRİLEMEZ — yalnız tanısal kalır.",
  ],
  otherFamiliesBlocked: false,
  note: "Diğer feature ailelerinin (agfSirasi, hizDerecesi, zeminToleransi, PS-v2, 4 yeni candidate, vb.) walk-forward OOS'u bu BLOCKED durumdan ETKİLENMEZ — yalnız yarisGidisatiSkoru'nun KENDİ ablation testi bloklanır.",
};

const statusReport = {
  generatedAt: new Date().toISOString(),
  productionPath: PRODUCTION_PATH,
  frozenInputCheck,
  correctionNote,
  CURRENT_RECONSTRUCTABLE,
  GIDISAT_CURRENT_STATUS: CURRENT_RECONSTRUCTABLE === "NO" ? "BLOCKED" : "RECONSTRUCTABLE",
  missingRequiredInputs: frozenInputCheck.filter((i) => i.status === "MISSING").map((i) => i.input),
  gidisatPartialEntriesUnchanged: { entries: gidisatPartialEntries.map((e) => ({ name: e.name, status: e.status })), allRemainExploratoryOnly: gidisatPartialStatusUnchanged },
  oosImpact,
  counts: {
    computedSeriesCount,
    registryEntryCount,
    eligibleFullOOSCount,
    exploratoryComputedCount,
    referenceOnlyComputedCount,
    skipPlaceholderCount,
    blockedPlaceholderCount,
  },
  registrySHA256: registrySha256,
  productionChanged: false,
  betaFit: false,
  oosRun: false,
  rescueRun: false,
};

writeFileSync(STATUS_PATH, JSON.stringify(statusReport, null, 2));
console.error(`7) Rapor yazıldı: ${STATUS_PATH}`);
console.log(JSON.stringify(statusReport, null, 2));
