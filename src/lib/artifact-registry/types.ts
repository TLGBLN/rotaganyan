// Incremental Artifact Registry v1 — tipler.
// Amaç TEK ve küçük: "Aynı iş ikinci kez baştan çalışmasın; yarım kalan iş kaldığı yerden devam etsin."
// (bkz. proje hafızası: incremental-artifact-registry-v1-plan). Framework DEĞİL — DB bilmez, canlı
// tahmin yoluna (V5.46 hot-path) HİÇ bağlanmaz; yalnız research/backtest/diagnostic araçları içindir.

/** Bir artifact'ın GEÇERSİZLENME nedeni. Sessiz full-rebuild YOK: her rebuild bu listeden bir neden taşır. */
export type InvalidationReason =
  | "FIRST_BUILD" // manifest yok — ilk tarihsel üretim, kaçınılmaz ve meşru
  | "FEATURE_DEFINITION_CHANGED"
  | "MODEL_FORMULA_CHANGED"
  | "LABEL_DEFINITION_CHANGED"
  | "TRAINING_SNAPSHOT_CHANGED"
  | "DATA_SNAPSHOT_CHANGED"
  | "EVALUATION_METHOD_CHANGED"
  | "COHORT_DEFINITION_CHANGED"
  | "BOOTSTRAP_SEED_CHANGED"
  | "POPULATION_CHANGED" // resample edilen popülasyonun büyüklüğü (trainN/testN/gün sayısı) değişti
  | "DATA_CORRUPTION"
  | "ARTIFACT_SCHEMA_INCOMPATIBLE"
  | "EXPLICIT_MANUAL_REBUILD";

/**
 * Artifact kimliği. `jobType/componentId/segment/cohortType/bootstrapSeriesId` "HANGİ artifact"ı
 * tanımlar (saklama dizinini belirler). Diğer alanlar (componentVersion, engineVersion,
 * featureDefinitionHash, dataSnapshotId, trainingSnapshotId, evaluationMethodVersion) artifact'ın
 * GEÇERLİLİĞİNİ tanımlayan BAĞIMLILIKLARDIR — değişirse artifact silinmez, açık nedenle INVALIDATED olur.
 */
export interface ArtifactIdentity {
  jobType: string;
  componentId: string;
  componentVersion: string;
  engineVersion?: string;
  featureDefinitionHash?: string;
  dataSnapshotId?: string;
  trainingSnapshotId?: string;
  evaluationMethodVersion?: string;
  segment?: string;
  cohortType?: string;
  bootstrapSeriesId?: string;
}

/** Kimlik dışı, çağıranın tanımladığı ek bağımlılık (ör. COVERAGE_START_DATE, eşik sabiti). */
export interface ExtraDependency {
  value: string;
  reason: InvalidationReason;
}

export type DependencyMap = Record<string, ExtraDependency>;

export type JobStatus = "RUNNING" | "PAUSED" | "COMPLETE" | "INVALIDATED";

export interface FailedItemInfo {
  attempts: number;
  lastError: string;
}

export const MANIFEST_SCHEMA_VERSION = 1;

export interface ArtifactManifest {
  schemaVersion: number;
  identity: ArtifactIdentity;
  /** Ad → {değer, neden}; identity'den türetilen + extraDependencies birleşimi (normalize). */
  dependencies: DependencyMap;
  /** Yalnız DEĞERLERİN hash'i — tek karşılaştırmayla "değişti mi?" sorusu. */
  dependencyHash: string;
  status: JobStatus;
  /** Son flush'ın özeti (kaldığı yerden devam için asıl gerçek items.jsonl'de; bu, insan/panel okuması içindir). */
  checkpoint: { batchesFlushed: number; lastFlushAt: string | null };
  processedItemCount: number;
  lastProcessedItem: string | null;
  aggregateState: unknown;
  /** items.jsonl bütünlüğü: son persist anındaki bayt sayısı + o baytların sha256'sı. Yoksa (eski manifest) doğrulama atlanır, sonraki persist'te yazılır. */
  itemsBytes?: number;
  itemsSha256?: string;
  failedItems: Record<string, FailedItemInfo>;
  rebuildHistory: { at: string; reason: InvalidationReason; changed: string[] }[];
  createdAt: string;
  updatedAt: string;
}

export interface JobItem {
  id: string;
  /** Kaynak parmak izi (ör. Result.updatedAt). Değişirse YALNIZ o item yeniden işlenir. */
  fingerprint?: string;
}

export interface StoredItem<R> {
  id: string;
  fp?: string;
  r: R | null;
  t: string;
}

export interface JobPlan {
  artifactDir: string;
  existing: number; // listItems() sonucu
  alreadyProcessed: number;
  newWork: number;
  reprocess: number; // fingerprint'i değişen, yeniden işlenecek item'lar
  retryFailed: number;
  givenUp: number;
  fullRebuild: boolean;
  reason: InvalidationReason | null; // yalnız fullRebuild ise dolu (FIRST_BUILD dahil)
  changedDependencies: string[];
}

export interface AggregateSpec<R, A> {
  init: () => A;
  add: (agg: A, id: string, result: R) => A;
}

export interface IncrementalJobOptions<R, A = unknown> {
  identity: ArtifactIdentity;
  extraDependencies?: DependencyMap;
  listItems: () => Promise<JobItem[]>;
  /** null döndürmek "işlendi ama kayda değer sonuç yok" demektir (bir daha denenmez). Hata fırlatmak "başarısız"dır (retry edilir). */
  processItem: (item: JobItem) => Promise<R | null>;
  aggregate?: AggregateSpec<R, A>;

  /** Bağımlılık değişmişse VARSAYILAN DAVRANIŞ: dur ve nedenini raporla. `true` ile bilinçli full rebuild. */
  rebuild?: boolean;
  rebuildReason?: InvalidationReason;
  dryRun?: boolean;

  concurrency?: number; // varsayılan 1 (bugünkü Supabase pooler dersi: >1 tüm koşuları timeout'a düşürdü)
  itemTimeoutMs?: number; // varsayılan 20000
  flushEvery?: number; // varsayılan 20 item
  maxAttempts?: number; // başarısız item için toplam deneme, varsayılan 3
  abortAfterConsecutiveFailures?: number; // varsayılan 25 — altyapı çökmüşken tüm listeyi "başarısız" damgalamaz, PAUSED olur
  maxItemsThisRun?: number; // runtime budget (madde 7)
  runtimeBudgetMs?: number;
  /** İşlenmeyen item oranı beklenenden büyükse (ör. id şeması değişti) sessizce çalışmak yerine DUR. */
  maxNewItems?: number;

  root?: string;
  lockTtlMs?: number;
  log?: (line: string) => void;
}

export interface JobResult<R, A> {
  plan: JobPlan;
  status: JobStatus;
  results: Map<string, { fingerprint?: string; result: R | null }>;
  aggregateState: A | undefined;
  stats: { processed: number; noResult: number; failed: number; timedOut: number; reprocessed: number; durationMs: number };
  manifest: ArtifactManifest;
}

export class RegistryInvalidationError extends Error {
  constructor(public reasons: InvalidationReason[], public changed: string[], message: string) {
    super(message);
    this.name = "RegistryInvalidationError";
  }
}
export class RegistryLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryLockedError";
  }
}
export class RegistryUnexpectedWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryUnexpectedWorkError";
  }
}
