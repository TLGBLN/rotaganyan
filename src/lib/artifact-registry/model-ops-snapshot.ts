// Model Operations v1 — kompakt SNAPSHOT modeli + atomik lastGoodSnapshot semantiği (saf veri yapısı; DB publish YOK).
//
// Dashboard hesaplamaz, hazır snapshot'ı okur. Yeni snapshot TAMAMEN hazır ve doğrulanmış olmadan eski lastGoodSnapshot aktif kalır;
// dashboard hiçbir zaman yarım snapshot görmez. Publish idempotent: içerik değişmediyse sürüm artmaz (UNCHANGED).
import fs from "node:fs";
import path from "node:path";
import { atomicWrite, sha256, stableStringify } from "./store";
import type { CohortType } from "./challenger-evaluation";
import { MODEL_OPS_METRIC_DEFINITION_VERSION, modelOpsWindows, type ModelOpsAggregate, type ModelOpsIdentity, type ModelOpsWindows, type RaceEvaluationsResult } from "./model-ops-core";
import { modelIdentityKey, modelOpsArtifactIdentity, normalizeModelIdentity } from "./model-ops-core";

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type SnapshotStatus = "VALID" | "INCOMPLETE";

export interface SnapshotSourceIdentity {
  jobType: string;
  componentId: string;
  identityKey: string;
  cohortType: CohortType;
  cohortStartAt: string;
  evaluationMethodVersion: string;
  metricDefinitionVersion: string;
}

export interface ModelOpsSnapshot {
  schemaVersion: number;
  snapshotVersion: number;
  status: SnapshotStatus;
  sourceArtifactIdentity: SnapshotSourceIdentity;
  /** En geç AKTİF değerlendirilmiş yarışın raceStartAt'i (yoksa null). */
  computedThroughRaceAt: string | null;
  publishedAt: string;
  windows: ModelOpsWindows;
  quality: { evaluated: number; pending: number; failed: number; jobStatus: string; reasons: string[] };
  /** snapshotVersion/publishedAt/contentHash HARİÇ tüm içeriğin sha256'sı — idempotency + bütünlük. */
  contentHash: string;
}

export function computeSnapshotContentHash(s: Omit<ModelOpsSnapshot, "contentHash" | "snapshotVersion" | "publishedAt"> | ModelOpsSnapshot): string {
  const { contentHash: _c, snapshotVersion: _v, publishedAt: _p, ...content } = s as ModelOpsSnapshot;
  void _c; void _v; void _p;
  return sha256(stableStringify(content));
}

/** Saf: bir çalıştırma sonucundan snapshot üretir. Yarım/eksik çalıştırma (PAUSED, başarısız item) → INCOMPLETE (asla VALID değil). */
export function buildSnapshot(input: {
  identity: ModelOpsIdentity;
  result: Pick<RaceEvaluationsResult, "aggregate" | "pendingRaceIds" | "job">;
  snapshotVersion: number;
  publishedAt: string;
}): ModelOpsSnapshot {
  const model = normalizeModelIdentity(input.identity.model);
  const artifact = modelOpsArtifactIdentity({ model, evaluationMethodVersion: input.identity.evaluationMethodVersion });
  const agg: ModelOpsAggregate = input.result.aggregate;
  const failed = Object.keys(input.result.job.manifest.failedItems).length;
  const jobStatus = input.result.job.status;
  const reasons: string[] = [];
  if (jobStatus !== "COMPLETE") reasons.push(`JOB_${jobStatus}`);
  if (failed > 0) reasons.push(`FAILED_ITEMS_${failed}`);
  const body = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    status: (reasons.length === 0 ? "VALID" : "INCOMPLETE") as SnapshotStatus,
    sourceArtifactIdentity: {
      jobType: artifact.jobType,
      componentId: artifact.componentId,
      identityKey: modelIdentityKey(model),
      cohortType: model.cohortType,
      cohortStartAt: model.cohortStartAt,
      evaluationMethodVersion: input.identity.evaluationMethodVersion,
      metricDefinitionVersion: MODEL_OPS_METRIC_DEFINITION_VERSION,
    },
    computedThroughRaceAt: agg.recent.length > 0 ? agg.recent[agg.recent.length - 1].raceStartAt : null,
    windows: modelOpsWindows(agg),
    quality: { evaluated: agg.all.n, pending: input.result.pendingRaceIds.length, failed, jobStatus, reasons },
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
}

export class InMemorySnapshotSink implements SnapshotSink {
  private active: ModelOpsSnapshot | null = null;
  getActive() { return this.active ? structuredClone(this.active) : null; }
  swapActive(next: ModelOpsSnapshot) { this.active = structuredClone(next); }
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
}

export type PublishOutcome =
  | { outcome: "PUBLISHED"; snapshot: ModelOpsSnapshot }
  | { outcome: "UNCHANGED"; snapshot: ModelOpsSnapshot }
  | { outcome: "REJECTED"; reasons: string[]; active: ModelOpsSnapshot | null };

/**
 * Yeni snapshot'ı üretir, doğrular, SONRA tek atomik swap ile aktif eder. Üretim/doğrulama/swap'in herhangi bir adımı düşerse
 * eski lastGoodSnapshot AYNEN aktif kalır. `build` sıradaki snapshotVersion'ı alır.
 */
export function publishSnapshot(sink: SnapshotSink, build: (nextVersion: number) => ModelOpsSnapshot): PublishOutcome {
  const active = sink.getActive(); // bozuksa SnapshotCorruptError fırlar (sessizce üzerine yazılmaz)
  let candidate: ModelOpsSnapshot;
  try {
    candidate = build((active?.snapshotVersion ?? 0) + 1);
  } catch (e) {
    return { outcome: "REJECTED", reasons: [`BUILD_FAILED: ${e instanceof Error ? e.message : String(e)}`], active };
  }
  const reasons: string[] = [];
  if (candidate.status !== "VALID") reasons.push(`STATUS_${candidate.status}`, ...candidate.quality.reasons);
  if (computeSnapshotContentHash(candidate) !== candidate.contentHash) reasons.push("CONTENT_HASH_MISMATCH");
  if (candidate.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) reasons.push("SCHEMA_VERSION_MISMATCH");
  if (active) {
    const a = active.sourceArtifactIdentity, c = candidate.sourceArtifactIdentity;
    if (a.componentId !== c.componentId || a.cohortType !== c.cohortType || a.identityKey !== c.identityKey) reasons.push("SOURCE_IDENTITY_MISMATCH");
    if (reasons.length === 0 && candidate.contentHash === active.contentHash) return { outcome: "UNCHANGED", snapshot: active };
    if (candidate.snapshotVersion <= active.snapshotVersion) reasons.push("VERSION_NOT_INCREASING");
  }
  if (reasons.length > 0) return { outcome: "REJECTED", reasons, active };
  try {
    sink.swapActive(candidate);
  } catch (e) {
    return { outcome: "REJECTED", reasons: [`SWAP_FAILED: ${e instanceof Error ? e.message : String(e)}`], active: sink.getActive() };
  }
  return { outcome: "PUBLISHED", snapshot: candidate };
}
