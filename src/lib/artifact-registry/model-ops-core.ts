// Model Operations v1 — RaceEvaluation + aggregate ÇEKİRDEĞİ (saf/bağımsız). Registry v1.2 üzerinde çalışır.
//
// KAPSAM (bilinçli dar): sonuçlanan yarış başına BİR RaceEvaluation, sonuç düzeltmesinde SUPERSEDE (append-only), ALL/RECENT-100/RECENT-300
// aggregate'i, LIVE≠REPLAY kimliği. KAPSAM DIŞI: DB/ChallengerRun/dashboard/production hot-path/harness entegrasyonu, G/H ablation,
// Calibration istatistiği, Coverage Risk Diagnostic (bunlar bu omurganın TÜKETİCİLERİdir). Bu modül DB bilmez; RaceSource'u çağıran verir.
//
// ── Yaşam döngüsü ─────────────────────────────────────────────────────────────────────────────────────────────────
//   PENDING_RESULT → EVALUATED → (resultFingerprint değişirse) SUPERSEDED → yeni EVALUATED sürüm.
//   Kalıcı kayıt items.jsonl'dır (append-only): fingerprint değişince Registry yeni satırı EKLER, eski satır dosyada KALIR. Bir yarışın
//   son satırı aktif EVALUATED, öncekiler SUPERSEDED'dır (`readEvaluationHistory`). Aggregate YALNIZ aktif sürümü katar: Registry
//   değiştirilen item'da aggregate'i aktif kayıtlardan yeniden katlar (yarış YENİDEN DEĞERLENDİRİLMEZ; yalnız hazır sonuçlar toplanır).
//   PENDING_RESULT dosyaya yazılmaz (hata değil, deneme tüketmez): `pendingRaceIds`.
//
// ── Sıralama ──────────────────────────────────────────────────────────────────────────────────────────────────────
//   RECENT pencereleri: (raceStartAt, raceId). evaluatedAt ASLA — geç gelen eski sonuç yarışın kendi tarihsel konumuna girer.
//
// ── Kimlik ────────────────────────────────────────────────────────────────────────────────────────────────────────
//   ModelIdentity alanları artifact'ın KENDİSİNİ tanımlar (componentId'ye hash olarak girer): biri değişirse YENİ artifact, eski korunur,
//   sessiz reuse yok. cohortStartAt kimliğin parçasıdır (aynı engineVersion etiketi sonradan yeniden kullanılsa da LIVE cohort isimle
//   genişlemez). gitCommit/predictionCreatedAt her yarış kaydında PROVENANCE olarak tutulur ama kimliğe GİRMEZ (her deploy'da cohort bölünmesin).
//   evaluationMethodVersion / metrik tanım sürümü geçerlilik bağımlılığıdır: değişirse Registry DURUR (fail-closed), yalnız --rebuild ile yeniden kurulur.
import fs from "node:fs";
import path from "node:path";
import { runIncrementalJob } from "./run-incremental-job";
import { artifactDir, defaultRoot, sha256, stableStringify } from "./store";
import { PENDING, type AggregateSpec, type ArtifactIdentity, type DependencyMap, type IncrementalJobOptions, type JobResult, type StoredItem } from "./types";
import { RECENT_MAX, summarizeRace, type CohortType } from "./challenger-evaluation";

export const MODEL_OPS_METRIC_DEFINITION_VERSION = "model-ops-metrics-v1";
export const BIG_MISS_P_THRESHOLD = 0.05; // kazananın olasılığı < %5
export const BIG_MISS_NRP_THRESHOLD = 0.7; // kazananın normalize sırası (rank-1)/(n-1) > 0.70

export type ModelRole = "CHAMPION" | "CHALLENGER";

export interface ModelIdentity {
  engineVersion: string;
  featureSchemaVersion: string;
  dataPipelineVersion: string;
  calibrationVersion: string;
  postProcessVersion: string;
  trainingSnapshotId: string;
  modelRole: ModelRole;
  cohortType: CohortType;
  /** Cohort'un başlangıcı (ISO). LIVE'da: bu andan ÖNCE üretilmiş tahmin cohort'a giremez. Dondurulur; kimliğin parçasıdır. */
  cohortStartAt: string;
}

export interface ModelOpsIdentity {
  model: ModelIdentity;
  evaluationMethodVersion: string;
}

const IDENTITY_STRING_FIELDS = ["engineVersion", "featureSchemaVersion", "dataPipelineVersion", "calibrationVersion", "postProcessVersion", "trainingSnapshotId"] as const;

function canonicalIso(value: string, what: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`Geçersiz zaman (${what}): ${JSON.stringify(value)}`);
  return new Date(ms).toISOString();
}

/** Doğrular + kanonikleştirir (cohortStartAt ISO). Eksik/boş alan sessizce kabul edilmez. */
export function normalizeModelIdentity(id: ModelIdentity): ModelIdentity {
  for (const f of IDENTITY_STRING_FIELDS) {
    if (typeof id[f] !== "string" || id[f].length === 0) throw new Error(`ModelIdentity.${f} zorunlu`);
  }
  if (id.modelRole !== "CHAMPION" && id.modelRole !== "CHALLENGER") throw new Error(`ModelIdentity.modelRole geçersiz: ${String(id.modelRole)}`);
  if (id.cohortType !== "LIVE" && id.cohortType !== "REPLAY") throw new Error(`ModelIdentity.cohortType geçersiz: ${String(id.cohortType)}`);
  return { ...id, cohortStartAt: canonicalIso(id.cohortStartAt, "cohortStartAt") };
}

/** Artifact'ı tanımlayan kimlik parmak izi (16 hex). gitCommit/predictionCreatedAt DAHİL DEĞİL. */
export function modelIdentityKey(id: ModelIdentity): string {
  return sha256(stableStringify(normalizeModelIdentity(id))).slice(0, 16);
}

/**
 * Model DAVRANIŞ hash'i: modelin ne yaptığını tanımlayan sürüm alanları + değerlendirme yöntemi (ham git commit DEĞİL).
 * Davranış değişip sürüm etiketi bump'lanmadıysa bile bu alanlar dependencyHash'e ayrı ayrı girer; cohort alanları dahil değildir.
 */
export function modelBehaviorHash(id: ModelOpsIdentity): string {
  const m = normalizeModelIdentity(id.model);
  return sha256(stableStringify({
    engineVersion: m.engineVersion, featureSchemaVersion: m.featureSchemaVersion, dataPipelineVersion: m.dataPipelineVersion,
    calibrationVersion: m.calibrationVersion, postProcessVersion: m.postProcessVersion, trainingSnapshotId: m.trainingSnapshotId,
    evaluationMethodVersion: id.evaluationMethodVersion,
  })).slice(0, 16);
}

/** Registry dependencyHash'ine giren davranış tanımlayıcıları (engineVersion/trainingSnapshotId/evaluationMethodVersion zaten kimlikten gelir). */
export function modelOpsExtraDependencies(id: ModelOpsIdentity): DependencyMap {
  const m = normalizeModelIdentity(id.model);
  return {
    featureSchemaVersion: { value: m.featureSchemaVersion, reason: "FEATURE_DEFINITION_CHANGED" },
    dataPipelineVersion: { value: m.dataPipelineVersion, reason: "DATA_SNAPSHOT_CHANGED" },
    calibrationVersion: { value: m.calibrationVersion, reason: "MODEL_FORMULA_CHANGED" },
    postProcessVersion: { value: m.postProcessVersion, reason: "MODEL_FORMULA_CHANGED" },
    cohortStartAt: { value: m.cohortStartAt, reason: "COHORT_DEFINITION_CHANGED" },
    modelBehaviorHash: { value: modelBehaviorHash(id), reason: "MODEL_FORMULA_CHANGED" },
  };
}

export function modelOpsArtifactIdentity(id: ModelOpsIdentity): ArtifactIdentity {
  const model = normalizeModelIdentity(id.model);
  if (!id.evaluationMethodVersion) throw new Error("evaluationMethodVersion zorunlu");
  return {
    jobType: "model-ops-race-evaluation",
    componentId: `${model.engineVersion}__${model.modelRole}__${modelIdentityKey(model)}`, // kimlik değişirse yeni dizin → eski artifact reuse edilmez, silinmez
    componentVersion: MODEL_OPS_METRIC_DEFINITION_VERSION,
    engineVersion: model.engineVersion,
    trainingSnapshotId: model.trainingSnapshotId,
    evaluationMethodVersion: id.evaluationMethodVersion,
    segment: "ALL",
    cohortType: model.cohortType, // LIVE ve REPLAY ayrı dizin
  };
}

// ── Kaynak sözleşmesi (DB/harness adaptörü sağlar; bu modül DB bilmez) ───────────────────────────────────────────────
export interface ModelOpsRacePayload {
  predictionId: string;
  /** Kaynağın kendi beyanı; artifact'ın cohort'uyla AYNI olmalı, değilse fail-closed (LIVE≠REPLAY). */
  cohortType: CohortType;
  raceStartAt: string;
  predictionCreatedAt: string;
  gitCommit?: string;
  segment: string;
  resultFingerprint: string;
  winnerNos: number[]; // boşsa sonuç yok → PENDING; beraberlikte birden fazla, ilki "birincil"
  probs: Record<string, number>; // runnerNo → kazanma olasılığı
  calibrationRef?: string; // opak referans (G katmanı tüketicisi için); burada yorumlanmaz
  coverageRef?: string;
}

export interface ModelOpsRaceSource {
  /**
   * Sonucu OLAN yarışlar `resultFingerprint` taşır; sonucu olmayanlarda undefined (→ PENDING_RESULT). Düzeltme = fingerprint değişimi.
   * `raceStartAt` TÜM yarışlar için verilmelidir (sonucu olmayanlar dahil): snapshot watermark'ı çözülmemiş en erken yarışa göre belirlenir.
   */
  listRaces(): Promise<{ raceId: string; resultFingerprint?: string; raceStartAt?: string }[]>;
  loadRace(raceId: string): Promise<ModelOpsRacePayload | typeof PENDING>;
}

// ── Değerlendirme kaydı (append-only satır) ─────────────────────────────────────────────────────────────────────────
export interface RaceEvaluationRecord {
  status: "EVALUATED";
  raceId: string;
  predictionId: string;
  resultFingerprint: string;
  identityKey: string;
  gitCommit?: string;
  predictionCreatedAt: string;
  cohortType: CohortType;
  segment: string;
  raceStartAt: string;
  raceStartMs: number;
  fieldSize: number;
  winnerNos: number[];
  winnerRank: number;
  winnerProbability: number;
  winnerLL: number;
  winnerNrp: number;
  hitTop1: boolean;
  hitTop3: boolean;
  bigMissP: boolean;
  bigMissRank: boolean;
  calibrationRef?: string;
  coverageRef?: string;
  evaluatedAt: string; // SIRALAMADA KULLANILMAZ
}

/**
 * LIVE'a alınmayan yarış: TERMİNAL (yeniden denenmez), hata DEĞİL, aggregate'e girmez, açıklanabilir şekilde saklanır.
 * PRE_COHORT: tahmin cohortStartAt'tan önce üretilmiş. POST_START: tahmin yarış başladıktan sonra üretilmiş (leakage riski).
 */
export type ExclusionStatus = "EXCLUDED_PRE_COHORT" | "EXCLUDED_POST_START";
export interface RaceExclusionRecord {
  status: ExclusionStatus;
  raceId: string;
  predictionId: string;
  resultFingerprint: string;
  identityKey: string;
  cohortType: CohortType;
  predictionCreatedAt: string;
  raceStartAt: string;
  cohortStartAt: string;
  reason: string;
  evaluatedAt: string;
}
export type RaceOutcomeRecord = RaceEvaluationRecord | RaceExclusionRecord;

/** Saf: LIVE uygunluğu. LIVE değilse (REPLAY) her zaman uygun; LIVE'da cohort öncesi/yarış sonrası tahmin dışlanır. */
export function classifyLiveEligibility(model: ModelIdentity, race: Pick<ModelOpsRacePayload, "predictionCreatedAt" | "raceStartAt">): ExclusionStatus | null {
  if (model.cohortType !== "LIVE") return null;
  const created = Date.parse(canonicalIso(race.predictionCreatedAt, "predictionCreatedAt")); // geçersiz zaman sessizce "uygun" sayılmaz
  const start = Date.parse(canonicalIso(race.raceStartAt, "raceStartAt"));
  if (created < Date.parse(model.cohortStartAt)) return "EXCLUDED_PRE_COHORT";
  if (created >= start) return "EXCLUDED_POST_START";
  return null;
}

/** Saf: bir yarışın değerlendirmesi. */
export function evaluateRace(raceId: string, race: ModelOpsRacePayload, identityKey: string, evaluatedAt: string): RaceEvaluationRecord {
  const s = summarizeRace(race.probs, race.winnerNos);
  const fieldSize = Object.keys(race.probs).length;
  const winnerProbability = race.probs[String(race.winnerNos[0])] ?? 0;
  const winnerNrp = fieldSize > 1 ? (s.winnerRank - 1) / (fieldSize - 1) : 0;
  const raceStartMs = Date.parse(canonicalIso(race.raceStartAt, "raceStartAt"));
  return {
    status: "EVALUATED",
    raceId,
    predictionId: race.predictionId,
    resultFingerprint: race.resultFingerprint,
    identityKey,
    gitCommit: race.gitCommit,
    predictionCreatedAt: canonicalIso(race.predictionCreatedAt, "predictionCreatedAt"),
    cohortType: race.cohortType,
    segment: race.segment,
    raceStartAt: new Date(raceStartMs).toISOString(),
    raceStartMs,
    fieldSize,
    winnerNos: race.winnerNos,
    winnerRank: s.winnerRank,
    winnerProbability,
    winnerLL: s.winnerLL,
    winnerNrp,
    hitTop1: s.hitTop1,
    hitTop3: s.hitTop3,
    bigMissP: winnerProbability < BIG_MISS_P_THRESHOLD,
    bigMissRank: winnerNrp > BIG_MISS_NRP_THRESHOLD,
    calibrationRef: race.calibrationRef,
    coverageRef: race.coverageRef,
    evaluatedAt,
  };
}

// ── Aggregate: toplamlar + (raceStartAt, raceId) sıralı halka ──────────────────────────────────────────────────────
export interface ModelOpsTotals {
  n: number;
  sumLL: number;
  top1: number;
  top3: number;
  bigMissP: number;
  bigMissRank: number;
  sumWinnerRank: number;
  sumWinnerProbability: number;
  segmentCounts: Record<string, number>;
}

export interface ModelOpsAggregate {
  cohortType: CohortType;
  all: ModelOpsTotals;
  /** (raceStartMs, raceId) artan sırada, en fazla RECENT_MAX AKTİF kayıt. */
  recent: RaceEvaluationRecord[];
}

const emptyTotals = (): ModelOpsTotals => ({ n: 0, sumLL: 0, top1: 0, top3: 0, bigMissP: 0, bigMissRank: 0, sumWinnerRank: 0, sumWinnerProbability: 0, segmentCounts: {} });

function addToTotals(t: ModelOpsTotals, e: RaceEvaluationRecord): void {
  t.n++;
  t.sumLL += e.winnerLL;
  if (e.hitTop1) t.top1++;
  if (e.hitTop3) t.top3++;
  if (e.bigMissP) t.bigMissP++;
  if (e.bigMissRank) t.bigMissRank++;
  t.sumWinnerRank += e.winnerRank;
  t.sumWinnerProbability += e.winnerProbability;
  t.segmentCounts[e.segment] = (t.segmentCounts[e.segment] ?? 0) + 1;
}

/** Kanonik sıra: yarış zamanı, eşitlikte raceId (deterministik). */
export const raceOrderBefore = (a: Pick<RaceEvaluationRecord, "raceStartMs" | "raceId">, b: Pick<RaceEvaluationRecord, "raceStartMs" | "raceId">): boolean =>
  a.raceStartMs !== b.raceStartMs ? a.raceStartMs < b.raceStartMs : a.raceId < b.raceId;

/** Cohort'a bağlı aggregate tanımı: başka cohort'un kaydı eklenmeye çalışılırsa HATA (LIVE ve REPLAY asla karışmaz). */
export function modelOpsAggregateSpec(cohortType: CohortType): AggregateSpec<RaceOutcomeRecord, ModelOpsAggregate> {
  return {
    init: () => ({ cohortType, all: emptyTotals(), recent: [] }),
    add: (agg, _id, e) => {
      if (e.status !== "EVALUATED") return agg; // EXCLUDED_*: performans aggregate'ine ASLA girmez
      if (e.cohortType !== agg.cohortType) throw new Error(`LIVE ve REPLAY karışamaz: aggregate=${agg.cohortType}, kayıt(${e.raceId})=${e.cohortType}`);
      addToTotals(agg.all, e);
      let lo = 0, hi = agg.recent.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (raceOrderBefore(agg.recent[mid], e)) lo = mid + 1; else hi = mid; }
      if (agg.recent.length >= RECENT_MAX && lo === 0) return agg; // halka dolu ve yarış hepsinden eski → yalnız ALL'a girer
      agg.recent.splice(lo, 0, e);
      if (agg.recent.length > RECENT_MAX) agg.recent.shift();
      return agg;
    },
  };
}

export type ModelOpsWindowName = "ALL" | "RECENT_100" | "RECENT_300";
export interface ModelOpsWindowStats extends ModelOpsTotals {
  window: ModelOpsWindowName;
  meanLL: number | null;
  top1Rate: number | null;
  top3Rate: number | null;
  bigMissPRate: number | null;
  bigMissRankRate: number | null;
  meanWinnerRank: number | null;
  meanWinnerProbability: number | null;
}

function toStats(window: ModelOpsWindowName, t: ModelOpsTotals): ModelOpsWindowStats {
  const r = (x: number) => (t.n === 0 ? null : x / t.n);
  return {
    ...t, window,
    meanLL: r(t.sumLL), top1Rate: r(t.top1), top3Rate: r(t.top3), bigMissPRate: r(t.bigMissP), bigMissRankRate: r(t.bigMissRank),
    meanWinnerRank: r(t.sumWinnerRank), meanWinnerProbability: r(t.sumWinnerProbability),
  };
}

export function modelOpsWindowStats(agg: ModelOpsAggregate, window: ModelOpsWindowName): ModelOpsWindowStats {
  if (window === "ALL") return toStats("ALL", agg.all);
  const t = emptyTotals();
  for (const e of agg.recent.slice(-(window === "RECENT_100" ? 100 : 300))) addToTotals(t, e);
  return toStats(window, t);
}

/** Dashboard'a verilecek TEK cohort'un pencereleri; cohortType her zaman taşınır. */
export interface ModelOpsWindows {
  cohortType: CohortType;
  ALL: ModelOpsWindowStats;
  RECENT_100: ModelOpsWindowStats;
  RECENT_300: ModelOpsWindowStats;
}
export function modelOpsWindows(agg: ModelOpsAggregate): ModelOpsWindows {
  return { cohortType: agg.cohortType, ALL: modelOpsWindowStats(agg, "ALL"), RECENT_100: modelOpsWindowStats(agg, "RECENT_100"), RECENT_300: modelOpsWindowStats(agg, "RECENT_300") };
}

// ── Çalıştırıcı ───────────────────────────────────────────────────────────────────────────────────────────────────
type PassThrough = Pick<
  IncrementalJobOptions<unknown>,
  "root" | "log" | "rebuild" | "rebuildReason" | "dryRun" | "maxItemsThisRun" | "runtimeBudgetMs" | "itemTimeoutMs" | "flushEvery" | "concurrency" | "lockTtlMs" | "abortAfterConsecutiveFailures" | "maxAttempts"
>;

export interface RaceEvaluationsResult {
  identityKey: string;
  artifactDir: string;
  aggregate: ModelOpsAggregate;
  windows: ModelOpsWindows;
  /** Aktif (en son) EVALUATED kayıtlar. */
  evaluations: Map<string, RaceEvaluationRecord>;
  /** LIVE'a alınmayan yarışlar (terminal, hata değil, aggregate dışı). */
  exclusions: Map<string, RaceExclusionRecord>;
  /** Sonucu henüz gelmemiş yarışlar (bu çalıştırmada). Hata DEĞİL. */
  pendingRaceIds: string[];
  /** Kaynağın listelediği TÜM yarışlar (watermark için): raceStartAt bilinmiyorsa null. */
  listedRaces: { raceId: string; raceStartAt: string | null }[];
  job: JobResult<RaceOutcomeRecord, ModelOpsAggregate>;
}

export async function runRaceEvaluations(opts: { identity: ModelOpsIdentity; source: ModelOpsRaceSource; now?: () => string } & PassThrough): Promise<RaceEvaluationsResult> {
  const { identity, source, now = () => new Date().toISOString(), ...rest } = opts;
  const model = normalizeModelIdentity(identity.model);
  const identityKey = modelIdentityKey(model);
  const artifact = modelOpsArtifactIdentity({ model, evaluationMethodVersion: identity.evaluationMethodVersion });
  const spec = modelOpsAggregateSpec(model.cohortType);
  const listedRaces: { raceId: string; raceStartAt: string | null }[] = [];

  const job = await runIncrementalJob<RaceOutcomeRecord, ModelOpsAggregate>({
    ...rest,
    identity: artifact,
    extraDependencies: modelOpsExtraDependencies({ model, evaluationMethodVersion: identity.evaluationMethodVersion }),
    aggregate: spec,
    listItems: async () => {
      const list = await source.listRaces();
      listedRaces.length = 0;
      for (const r of list) listedRaces.push({ raceId: r.raceId, raceStartAt: r.raceStartAt ? canonicalIso(r.raceStartAt, `listRaces.raceStartAt(${r.raceId})`) : null });
      return list.map((r) => ({ id: r.raceId, fingerprint: r.resultFingerprint }));
    },
    processItem: async (item) => {
      if (item.fingerprint === undefined) return PENDING; // listede sonuç yok → PENDING_RESULT (yükleme bile yapılmaz)
      const race = await source.loadRace(item.id);
      if (race === PENDING || race.winnerNos.length === 0) return PENDING;
      if (race.cohortType !== model.cohortType) throw new Error(`LIVE ve REPLAY karışamaz: artifact=${model.cohortType}, kaynak(${item.id})=${race.cohortType}`);
      if (race.resultFingerprint !== item.fingerprint) throw new Error(`resultFingerprint list/load arasında değişti (${item.id}) — yeniden denenecek`);
      // LIVE uygunluğu: hata DEĞİL, terminal dışlama (açıklamalı saklanır, yeniden denenmez, aggregate'e girmez).
      const excluded = classifyLiveEligibility(model, race);
      if (excluded) {
        return {
          status: excluded, raceId: item.id, predictionId: race.predictionId, resultFingerprint: race.resultFingerprint, identityKey, cohortType: model.cohortType,
          predictionCreatedAt: canonicalIso(race.predictionCreatedAt, "predictionCreatedAt"), raceStartAt: canonicalIso(race.raceStartAt, "raceStartAt"), cohortStartAt: model.cohortStartAt,
          reason: excluded === "EXCLUDED_PRE_COHORT" ? "tahmin cohortStartAt'tan önce üretilmiş" : "tahmin yarış başladıktan sonra üretilmiş (leakage riski)",
          evaluatedAt: now(),
        } satisfies RaceExclusionRecord;
      }
      return evaluateRace(item.id, race, identityKey, now());
    },
  });

  const aggregate = job.aggregateState ?? spec.init();
  const evaluations = new Map<string, RaceEvaluationRecord>();
  const exclusions = new Map<string, RaceExclusionRecord>();
  for (const [id, v] of job.results) {
    if (!v.result) continue;
    if (v.result.status === "EVALUATED") evaluations.set(id, v.result); else exclusions.set(id, v.result);
  }
  return {
    identityKey, artifactDir: artifactDir(opts.root ?? defaultRoot(), artifact), aggregate, windows: modelOpsWindows(aggregate),
    evaluations, exclusions, pendingRaceIds: job.pendingItems, listedRaces: [...listedRaces], job,
  };
}

// ── Denetim izi: append-only geçmiş ─────────────────────────────────────────────────────────────────────────────────
export type EvaluationVersionStatus = "EVALUATED" | "SUPERSEDED" | ExclusionStatus;
export interface EvaluationVersion {
  version: number; // 1'den, dosya sırasıyla
  status: EvaluationVersionStatus; // yalnız SON sürüm aktif (EVALUATED veya EXCLUDED_*), öncekiler SUPERSEDED
  supersededByVersion?: number;
  loggedAt: string;
  record: RaceOutcomeRecord;
}

/** items.jsonl'daki TÜM sürümleri okur (yalnız denetim/teşhis; aggregate hesabı bunu KULLANMAZ). Ortadaki bozuk satır → hata (fail-closed). */
export function readEvaluationHistory(dir: string): Map<string, EvaluationVersion[]> {
  const out = new Map<string, EvaluationVersion[]>();
  const file = path.join(dir, "items.jsonl");
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, "utf-8");
  const tornTailPossible = !text.endsWith("\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  lines.forEach((line, i) => {
    let rec: StoredItem<RaceOutcomeRecord>;
    try { rec = JSON.parse(line) as StoredItem<RaceOutcomeRecord>; } catch {
      if (tornTailPossible && i === lines.length - 1) return;
      throw new Error(`items.jsonl bozuk satır (${i + 1}) — fail-closed`);
    }
    if (rec.r === null) return;
    const list = out.get(rec.id) ?? [];
    list.push({ version: list.length + 1, status: rec.r.status, loggedAt: rec.t, record: rec.r });
    out.set(rec.id, list);
  });
  for (const list of out.values()) {
    list.forEach((v, i) => { if (i < list.length - 1) { v.status = "SUPERSEDED"; v.supersededByVersion = v.version + 1; } });
  }
  return out;
}

export type RaceLifecycleState = "PENDING_RESULT" | "EVALUATED" | ExclusionStatus;
/** Bir yarışın şu anki durumu: kayıt yoksa PENDING_RESULT; varsa son sürümün durumu (EVALUATED veya EXCLUDED_*) + tüm sürümler. */
export function raceLifecycle(raceId: string, history: Map<string, EvaluationVersion[]>): { state: RaceLifecycleState; versions: EvaluationVersion[] } {
  const versions = history.get(raceId) ?? [];
  return { state: versions.length === 0 ? "PENDING_RESULT" : (versions[versions.length - 1].record.status as RaceLifecycleState), versions };
}
