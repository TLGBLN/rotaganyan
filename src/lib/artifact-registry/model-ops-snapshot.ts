// Model Operations v1 — kompakt SNAPSHOT modeli + atomik lastGoodSnapshot semantiği (saf veri yapısı; DB publish YOK).
//
// Dashboard hesaplamaz, hazır snapshot'ı okur. Yeni snapshot TAMAMEN hazır ve doğrulanmış olmadan eski lastGoodSnapshot aktif kalır;
// dashboard hiçbir zaman yarım snapshot görmez. Publish idempotent: içerik değişmediyse sürüm artmaz (UNCHANGED).
import fs from "node:fs";
import path from "node:path";
import { atomicWrite, sha256, stableStringify } from "./store";
import type { CohortType } from "./challenger-evaluation";
import {
  MODEL_OPS_METRIC_DEFINITION_VERSION, modelBehaviorHash, modelIdentityKey, modelOpsAggregateSpec, modelOpsArtifactIdentity, modelOpsWindows, normalizeModelIdentity, raceOrderBefore,
  type ModelOpsAggregate, type ModelOpsIdentity, type ModelOpsWindows, type RaceEvaluationRecord, type RaceEvaluationsResult,
} from "./model-ops-core";

export const SNAPSHOT_SCHEMA_VERSION = 2;

/** VALID: yayınlanabilir. INCOMPLETE: watermark güvenle belirlenemiyor (adaptör sözleşme ihlali). LATE_GAP: yayınlanmış watermark'ın GERİSİNDE çözülmemiş yarış bulundu. */
export type SnapshotStatus = "VALID" | "INCOMPLETE" | "LATE_GAP";

export interface SnapshotSourceIdentity {
  jobType: string;
  componentId: string;
  identityKey: string;
  cohortType: CohortType;
  cohortStartAt: string;
  evaluationMethodVersion: string;
  metricDefinitionVersion: string;
  modelBehaviorHash: string;
}

export interface ModelOpsSnapshot {
  schemaVersion: number;
  snapshotVersion: number;
  status: SnapshotStatus;
  sourceArtifactIdentity: SnapshotSourceIdentity;
  /**
   * WATERMARK: bu zamana (dahil) kadar HER yarış çözülmüştür (değerlendirildi veya LIVE dışı dışlandı). Çözülmemiş (PENDING/başarısız/işlenmemiş)
   * en erken yarıştan ÖNCEKİ son değerlendirilmiş yarışın raceStartAt'i; pencereler yalnız bu noktaya kadar hesaplanır. Yoksa null.
   */
  computedThroughRaceAt: string | null;
  computedThroughRaceId: string | null; // (raceStartAt, raceId) sıra anahtarının ikinci parçası
  /**
   * Yayınlanmış watermark ASLA geri gitmez: önceki lastGood'un yayın noktası ile bu snapshot'ın (VALID ise) noktasının büyüğü. LATE_GAP adayında
   * önceki lastGood'un noktası aynen kalır (aday yayınlanmaz).
   */
  publishedThroughRaceAt: string | null;
  publishedThroughRaceId: string | null;
  /** Mevcut verinin GERÇEKTEN kesintisiz olduğu nokta (çözülmemiş en erken yarıştan öncesi). computedThroughRaceAt ile aynı değerdir. */
  currentContiguousThroughRaceAt: string | null;
  /** Yayınlanmış watermark'ın GERİSİNDE çözülmemiş bir yarış varsa true: lastGood korunur ama "halen eksiksiz" gibi davranılmaz; gap çözülene kadar yeni VALID yayın yok. */
  lateGapBeforeWatermark: boolean;
  lateGapRaceIds: string[];
  publishedAt: string;
  windows: ModelOpsWindows;
  quality: {
    evaluated: number; // watermark'a kadar değerlendirilen (pencerelerdeki ALL.n ile aynı)
    evaluatedBeyondWatermark: number; // değerlendirilmiş ama çözülmemiş bir yarıştan SONRA olduğu için snapshot dışında bekleyenler
    unresolved: number; // pending + failed + notProcessed
    pending: number; // normal bekleyen (PENDING_RESULT)
    pendingStale: number; // PENDING_STALE: SLA aştı, iptal/void bildirilmedi — gözlem uyarısı, hata/iptal DEĞİL
    failed: number;
    notProcessed: number; // bütçe/PAUSED yüzünden bu çalıştırmada hiç denenmemiş
    excluded: { preCohort: number; postStart: number; cancelled: number; void: number };
    contractViolations: number; // ADAPTER_CONTRACT_VIOLATION: işlenmeyen, raporlanan descriptor sayısı
    reasons: string[]; // boşsa VALID
  };
  /** snapshotVersion/publishedAt/contentHash HARİÇ tüm içeriğin sha256'sı — idempotency + bütünlük. */
  contentHash: string;
}

export function computeSnapshotContentHash(s: Omit<ModelOpsSnapshot, "contentHash" | "snapshotVersion" | "publishedAt"> | ModelOpsSnapshot): string {
  const { contentHash: _c, snapshotVersion: _v, publishedAt: _p, ...content } = s as ModelOpsSnapshot;
  void _c; void _v; void _p;
  return sha256(stableStringify(content));
}

/**
 * Saf: bir çalıştırma sonucundan WATERMARK tabanlı snapshot üretir. Tek bir PENDING/başarısız/işlenmemiş yarış snapshot'ı DONDURMAZ:
 * snapshot, çözülmemiş en erken yarıştan ÖNCEKİ (kesintisiz) noktaya kadar ilerler. Ama:
 *  - adaptör sözleşme ihlali varsa (yarış yerleştirilemez) → INCOMPLETE (asla varsayımsal watermark yok),
 *  - yayınlanmış watermark'ın GERİSİNDE çözülmemiş yarış bulunduysa → LATE_GAP: aday yayınlanmaz, lastGood korunur, gap görünür kalır.
 * previous = şu anki lastGood (yayınlanmış watermark'ın kaynağı).
 */
export function buildSnapshot(input: {
  identity: ModelOpsIdentity;
  result: Pick<RaceEvaluationsResult, "aggregate" | "evaluations" | "exclusions" | "pendingRaceIds" | "pendingStaleRaceIds" | "contractViolations" | "listedRaces" | "job">;
  previous?: ModelOpsSnapshot | null;
  snapshotVersion: number;
  publishedAt: string;
}): ModelOpsSnapshot {
  const model = normalizeModelIdentity(input.identity.model);
  const artifact = modelOpsArtifactIdentity({ model, evaluationMethodVersion: input.identity.evaluationMethodVersion });
  const { evaluations, exclusions, listedRaces, job, contractViolations } = input.result;
  const previous = input.previous ?? null;

  const unresolved = listedRaces.filter((r) => !evaluations.has(r.raceId) && !exclusions.has(r.raceId));
  const failedSet = new Set(Object.keys(job.manifest.failedItems));
  const staleSet = new Set(input.result.pendingStaleRaceIds);
  const pendingSet = new Set(input.result.pendingRaceIds);
  const failed = unresolved.filter((r) => failedSet.has(r.raceId)).length;
  const pendingStale = unresolved.filter((r) => !failedSet.has(r.raceId) && pendingSet.has(r.raceId) && staleSet.has(r.raceId)).length;
  const pending = unresolved.filter((r) => !failedSet.has(r.raceId) && pendingSet.has(r.raceId) && !staleSet.has(r.raceId)).length;
  const reasons: string[] = [];
  if (contractViolations.length > 0) reasons.push(`ADAPTER_CONTRACT_VIOLATION_${contractViolations.length}`);

  const spec = modelOpsAggregateSpec(model.cohortType);
  let agg: ModelOpsAggregate;
  let watermark: RaceEvaluationRecord | null = null;
  let beyond = 0;
  if (reasons.length > 0) {
    agg = spec.init(); // watermark güvenle belirlenemedi → içerik yayınlanmayacak (INCOMPLETE)
  } else if (unresolved.length === 0) {
    agg = input.result.aggregate; // hızlı yol: çözülmemiş yok, hazır aggregate aynen
    watermark = agg.recent.length > 0 ? agg.recent[agg.recent.length - 1] : null; // halkanın sonu = en geç yarış
  } else {
    let cut = { raceStartMs: Infinity, raceId: "" };
    for (const r of unresolved) {
      const key = { raceStartMs: Date.parse(r.raceStartAt), raceId: r.raceId };
      if (raceOrderBefore(key, cut)) cut = key;
    }
    const included: RaceEvaluationRecord[] = [];
    for (const e of evaluations.values()) {
      if (raceOrderBefore(e, cut)) { included.push(e); if (watermark === null || raceOrderBefore(watermark, e)) watermark = e; } else beyond++;
    }
    if (beyond === 0) agg = input.result.aggregate;
    else { agg = spec.init(); for (const e of included) agg = spec.add(agg, e.raceId, e); }
  }

  // Geç gap: yayınlanmış watermark'ın (ms, raceId) anahtarından ÖNCE çözülmemiş yarış var mı.
  let lateGapRaceIds: string[] = [];
  if (reasons.length === 0 && previous && previous.publishedThroughRaceAt !== null && previous.publishedThroughRaceId !== null) {
    const pk = { raceStartMs: Date.parse(previous.publishedThroughRaceAt), raceId: previous.publishedThroughRaceId };
    lateGapRaceIds = unresolved.filter((r) => raceOrderBefore({ raceStartMs: Date.parse(r.raceStartAt), raceId: r.raceId }, pk)).map((r) => r.raceId).sort();
  }
  const lateGap = lateGapRaceIds.length > 0;
  if (lateGap) reasons.push("LATE_GAP_BEFORE_WATERMARK");

  const computedAt = watermark ? watermark.raceStartAt : null;
  const computedId = watermark ? watermark.raceId : null;
  // Yayın noktası: gap/ihlal yoksa aday kendi (kesintisiz) noktasına ilerler; aksi halde lastGood'un noktası aynen kalır. Hiçbir durumda geri gitmez.
  const prevAt = previous?.publishedThroughRaceAt ?? null;
  const prevId = previous?.publishedThroughRaceId ?? null;
  const candidateAhead = computedAt !== null && (prevAt === null || raceOrderBefore({ raceStartMs: Date.parse(prevAt), raceId: prevId ?? "" }, { raceStartMs: Date.parse(computedAt), raceId: computedId ?? "" }));
  const pub = reasons.length === 0 && candidateAhead ? { at: computedAt, id: computedId } : { at: prevAt, id: prevId };

  const body = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    status: (contractViolations.length > 0 ? "INCOMPLETE" : lateGap ? "LATE_GAP" : "VALID") as SnapshotStatus,
    sourceArtifactIdentity: {
      jobType: artifact.jobType,
      componentId: artifact.componentId,
      identityKey: modelIdentityKey(model),
      cohortType: model.cohortType,
      cohortStartAt: model.cohortStartAt,
      evaluationMethodVersion: input.identity.evaluationMethodVersion,
      metricDefinitionVersion: MODEL_OPS_METRIC_DEFINITION_VERSION,
      modelBehaviorHash: modelBehaviorHash(input.identity),
    },
    computedThroughRaceAt: computedAt,
    computedThroughRaceId: computedId,
    publishedThroughRaceAt: pub.at,
    publishedThroughRaceId: pub.id,
    currentContiguousThroughRaceAt: computedAt,
    lateGapBeforeWatermark: lateGap,
    lateGapRaceIds,
    windows: modelOpsWindows(agg),
    quality: {
      evaluated: agg.all.n,
      evaluatedBeyondWatermark: beyond,
      unresolved: unresolved.length,
      pending,
      pendingStale,
      failed,
      notProcessed: unresolved.length - failed - pending - pendingStale,
      excluded: {
        preCohort: [...exclusions.values()].filter((x) => x.status === "EXCLUDED_PRE_COHORT").length,
        postStart: [...exclusions.values()].filter((x) => x.status === "EXCLUDED_POST_START").length,
        cancelled: [...exclusions.values()].filter((x) => x.status === "EXCLUDED_CANCELLED").length,
        void: [...exclusions.values()].filter((x) => x.status === "EXCLUDED_VOID").length,
      },
      contractViolations: contractViolations.length,
      reasons,
    },
  };
  const withMeta = { ...body, snapshotVersion: input.snapshotVersion, publishedAt: input.publishedAt };
  return { ...withMeta, contentHash: computeSnapshotContentHash(withMeta as ModelOpsSnapshot) };
}

// ── lastGoodSnapshot semantiği ─────────────────────────────────────────────────────────────────────────────────────
export class SnapshotCorruptError extends Error {
  constructor(message: string) { super(message); this.name = "SnapshotCorruptError"; }
}

/** Aktif snapshot deposu. `swapActive` ATOMİK olmalı: ya tamamen yeni ya tamamen eski görünür. */
export interface SnapshotSink {
  getActive(): ModelOpsSnapshot | null;
  swapActive(next: ModelOpsSnapshot): void;
  /** Opsiyonel: son yayın denemesinin sağlık özeti (gap görünürlüğü). lastGood'u DEĞİŞTİRMEZ; best-effort. */
  saveHealth?(h: SnapshotHealth): void;
}

/**
 * lastGood'un yanında görünür kalan durum: gap'i GİZLEMEZ. Dashboard "aktif snapshot + sağlık" okur.
 * publishedThroughRaceAt (lastGood) asla gerilemez; currentContiguousThroughRaceAt mevcut verinin gerçek kesintisiz noktasıdır.
 */
export interface SnapshotHealth {
  activeSnapshotVersion: number | null;
  publishedThroughRaceAt: string | null;
  currentContiguousThroughRaceAt: string | null;
  lateGapBeforeWatermark: boolean;
  lateGapRaceIds: string[];
  pendingStale: number;
  contractViolations: number;
  lastOutcome: "PUBLISHED" | "UNCHANGED" | "REJECTED";
  reasons: string[];
}

export class InMemorySnapshotSink implements SnapshotSink {
  private active: ModelOpsSnapshot | null = null;
  health: SnapshotHealth | null = null;
  getActive() { return this.active ? structuredClone(this.active) : null; }
  swapActive(next: ModelOpsSnapshot) { this.active = structuredClone(next); }
  saveHealth(h: SnapshotHealth) { this.health = structuredClone(h); }
}

/** Dosya tabanlı (tmp + rename). Yarım kalmış tmp dosyası aktif snapshot'ı ETKİLEMEZ. Bozuk aktif dosya → SnapshotCorruptError (dashboard UNKNOWN). */
export class FileSnapshotSink implements SnapshotSink {
  constructor(private readonly dir: string) {}
  private get file() { return path.join(this.dir, "snapshot.active.json"); }
  getActive(): ModelOpsSnapshot | null {
    if (!fs.existsSync(this.file)) return null;
    let s: ModelOpsSnapshot;
    try { s = JSON.parse(fs.readFileSync(this.file, "utf-8")) as ModelOpsSnapshot; } catch (e) {
      throw new SnapshotCorruptError(`snapshot.active.json okunamadı: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (computeSnapshotContentHash(s) !== s.contentHash) throw new SnapshotCorruptError("snapshot.active.json contentHash uyuşmuyor");
    return s;
  }
  swapActive(next: ModelOpsSnapshot) { atomicWrite(this.file, JSON.stringify(next)); }
  saveHealth(h: SnapshotHealth) { atomicWrite(path.join(this.dir, "snapshot.health.json"), JSON.stringify(h)); }
  getHealth(): SnapshotHealth | null {
    const f = path.join(this.dir, "snapshot.health.json");
    if (!fs.existsSync(f)) return null;
    try { return JSON.parse(fs.readFileSync(f, "utf-8")) as SnapshotHealth; } catch { return null; }
  }
}

export type PublishOutcome =
  | { outcome: "PUBLISHED"; snapshot: ModelOpsSnapshot; health: SnapshotHealth }
  | { outcome: "UNCHANGED"; snapshot: ModelOpsSnapshot; health: SnapshotHealth }
  | { outcome: "REJECTED"; reasons: string[]; active: ModelOpsSnapshot | null; health: SnapshotHealth };



const keyBefore = (aAt: string, aId: string | null, bAt: string, bId: string | null): boolean => {
  const a = Date.parse(aAt), b = Date.parse(bAt);
  return a !== b ? a < b : (aId ?? "") < (bId ?? "");
};

function healthOf(active: ModelOpsSnapshot | null, candidate: ModelOpsSnapshot | null, outcome: SnapshotHealth["lastOutcome"], reasons: string[]): SnapshotHealth {
  return {
    activeSnapshotVersion: active?.snapshotVersion ?? null,
    publishedThroughRaceAt: active?.publishedThroughRaceAt ?? null, // gerilemez: her zaman AKTİF lastGood'un noktası
    currentContiguousThroughRaceAt: candidate ? candidate.currentContiguousThroughRaceAt : active?.currentContiguousThroughRaceAt ?? null,
    lateGapBeforeWatermark: candidate?.lateGapBeforeWatermark ?? false,
    lateGapRaceIds: candidate?.lateGapRaceIds ?? [],
    pendingStale: candidate?.quality.pendingStale ?? active?.quality.pendingStale ?? 0,
    contractViolations: candidate?.quality.contractViolations ?? 0,
    lastOutcome: outcome,
    reasons,
  };
}

/**
 * Yeni snapshot'ı üretir, doğrular, SONRA tek atomik swap ile aktif eder. Üretim/doğrulama/swap'in herhangi bir adımı düşerse eski lastGoodSnapshot
 * AYNEN aktif kalır. `build` sıradaki snapshotVersion'ı ve şu anki lastGood'u alır (yayınlanmış watermark'a göre geç gap tespiti için).
 * Her sonuç bir SnapshotHealth taşır (gap gizlenmez); sink destekliyorsa best-effort kaydedilir.
 */
export function publishSnapshot(sink: SnapshotSink, build: (nextVersion: number, active: ModelOpsSnapshot | null) => ModelOpsSnapshot): PublishOutcome {
  const active = sink.getActive(); // bozuksa SnapshotCorruptError fırlar (sessizce üzerine yazılmaz)
  const finish = (o: PublishOutcome): PublishOutcome => {
    try { sink.saveHealth?.(o.health); } catch { /* sağlık kaydı best-effort: lastGood'u/sonucu etkilemez */ }
    return o;
  };
  let candidate: ModelOpsSnapshot;
  try {
    candidate = build((active?.snapshotVersion ?? 0) + 1, active);
  } catch (e) {
    const reasons = [`BUILD_FAILED: ${e instanceof Error ? e.message : String(e)}`];
    return finish({ outcome: "REJECTED", reasons, active, health: healthOf(active, null, "REJECTED", reasons) });
  }
  const reasons: string[] = [];
  if (candidate.status !== "VALID") reasons.push(`STATUS_${candidate.status}`, ...candidate.quality.reasons);
  if (computeSnapshotContentHash(candidate) !== candidate.contentHash) reasons.push("CONTENT_HASH_MISMATCH");
  if (candidate.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) reasons.push("SCHEMA_VERSION_MISMATCH");
  if (active) {
    const a = active.sourceArtifactIdentity, c = candidate.sourceArtifactIdentity;
    if (a.componentId !== c.componentId || a.cohortType !== c.cohortType || a.identityKey !== c.identityKey) reasons.push("SOURCE_IDENTITY_MISMATCH");
    // Yayınlanmış watermark GERİ GİTMEZ (savunma hattı: builder lastGood'u bilmese bile). Geç gap'in AYRINTISI candidate.lateGap* alanlarında/health'te görünür kalır.
    if (active.publishedThroughRaceAt !== null && (candidate.publishedThroughRaceAt === null || keyBefore(candidate.publishedThroughRaceAt, candidate.publishedThroughRaceId, active.publishedThroughRaceAt, active.publishedThroughRaceId))) {
      reasons.push("WATERMARK_REGRESSION");
    }
    if (reasons.length === 0 && candidate.contentHash === active.contentHash) return finish({ outcome: "UNCHANGED", snapshot: active, health: healthOf(active, candidate, "UNCHANGED", []) });
    if (candidate.snapshotVersion <= active.snapshotVersion) reasons.push("VERSION_NOT_INCREASING");
  }
  if (reasons.length > 0) return finish({ outcome: "REJECTED", reasons, active, health: healthOf(active, candidate, "REJECTED", reasons) });
  try {
    sink.swapActive(candidate);
  } catch (e) {
    const rs = [`SWAP_FAILED: ${e instanceof Error ? e.message : String(e)}`];
    const still = sink.getActive();
    return finish({ outcome: "REJECTED", reasons: rs, active: still, health: healthOf(still, candidate, "REJECTED", rs) });
  }
  return finish({ outcome: "PUBLISHED", snapshot: candidate, health: healthOf(candidate, candidate, "PUBLISHED", []) });
}
