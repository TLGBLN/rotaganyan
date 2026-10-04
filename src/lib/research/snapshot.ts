import { createHash } from "crypto";
import { parseTjkDate, tjkTarihOncesiKatiMi } from "@/lib/tjk-date";

export const RESEARCH_SNAPSHOT_SCHEMA_VERSION = 1;
export const HISTORY_ROWS = 5;
export const COVERAGE_THRESHOLD = 0.95;

export type RawHistoryRow = { date?: unknown; finishPos?: unknown; hp?: unknown; classType?: unknown; distance?: unknown; surface?: unknown; weight?: unknown };

export type NormalizedHistoryRow = {
  date: string;
  finishPos: string;
  hp: string;
  classType: string;
  distance: number | null;
  surface: string;
  weight: string;
};

/** snapshotSchemaVersion=2. Checkpoint tuple pozisyonları: [checkpoint:int, timeReal:int(ms), place:int]. Hiçbir alan null değil. */
export const SNAPSHOT_SCHEMA_VERSION = 2;

export type SectionalRaw = {
  horseName: string;
  horseNumber: number;
  finishTimeReal: number;
  raceLength: number;
  splitCount: number;
  checkpoints: { checkpoint: number; timeReal: number; place: number }[];
};

export type CheckpointTuple = [number, number, number];

export type SectionalEncoded = {
  horseName: string;
  horseNumber: number;
  finishTimeReal: number;
  raceLength: number;
  splitCount: number;
  checkpointTuples: CheckpointTuple[];
};

export function encodeSectional(s: SectionalRaw): SectionalEncoded {
  return {
    horseName: s.horseName,
    horseNumber: s.horseNumber,
    finishTimeReal: s.finishTimeReal,
    raceLength: s.raceLength,
    splitCount: s.splitCount,
    checkpointTuples: [...s.checkpoints]
      .sort((a, b) => a.checkpoint - b.checkpoint)
      .map((c): CheckpointTuple => [c.checkpoint, c.timeReal, c.place]),
  };
}

export function decodeCheckpoints(tuples: CheckpointTuple[]): { checkpoint: number; timeReal: number; place: number }[] {
  return tuples.map(([checkpoint, timeReal, place]) => ({ checkpoint, timeReal, place }));
}

export function isResearchSnapshotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RESEARCH_SNAPSHOT_ENABLED === "true";
}

/** Canonical JSON: anahtarlar sıralı; aynı girdi her zaman aynı metni üretir. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Yarış tarihinden KESİN önce, en yeni → eski sıralı en fazla HISTORY_ROWS satır; normalize edilmiş. */
export function selectHistoryRows(rows: RawHistoryRow[], raceDate: Date): NormalizedHistoryRow[] {
  const valid = rows
    .map((r) => ({ r, raw: typeof r.date === "string" ? r.date : "" }))
    .filter(({ raw }) => raw && tjkTarihOncesiKatiMi(raw, raceDate))
    .map(({ r, raw }) => ({ r, d: parseTjkDate(raw)! }))
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return valid.slice(0, HISTORY_ROWS).map(({ r, d }) => ({
    date: d.toISOString().slice(0, 10),
    finishPos: String(r.finishPos ?? ""),
    hp: String(r.hp ?? ""),
    classType: String(r.classType ?? ""),
    distance: typeof r.distance === "number" ? r.distance : Number.isFinite(Number(r.distance)) ? Number(r.distance) : null,
    surface: String(r.surface ?? ""),
    weight: String(r.weight ?? ""),
  }));
}

/** expectedHistoryRows = min(5, cutoff öncesi gerçekten mevcut geçmiş satır sayısı). */
export function expectedHistoryRowsFor(availableBeforeCutoff: number): number {
  return Math.min(HISTORY_ROWS, Math.max(0, availableBeforeCutoff));
}

export type SourceRefs = {
  snapshotSchemaVersion: number;
  horseHistory: { sourceHash: string; rowsUsed: NormalizedHistoryRow[] };
  accurace: { splitInputs: SectionalEncoded[]; raceRevisionId: null; note: string };
};

/** Accurace split revizyonu yoktur; kullanılan normalize sectional girdi snapshot içinde dondurulur. */
export const ACCURACE_LIMITATION_NOTE =
  "AccuraceHorseSplit için revizyon tablosu yok; kullanılan normalize sectional girdiler bu kayıtta dondurulmuştur.";

export function buildSourceRefs(rowsUsed: NormalizedHistoryRow[], splitInputs: SectionalRaw[]): { refs: SourceRefs; refsJson: string; sourceHash: string } {
  const encoded = splitInputs.map(encodeSectional).sort((a, b) => a.horseNumber - b.horseNumber || a.horseName.localeCompare(b.horseName));
  const horseHash = sha256Hex(canonicalJson(rowsUsed));
  const refs: SourceRefs = {
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    horseHistory: { sourceHash: horseHash, rowsUsed },
    accurace: { splitInputs: encoded, raceRevisionId: null, note: ACCURACE_LIMITATION_NOTE },
  };
  const refsJson = canonicalJson(refs);
  return { refs, refsJson, sourceHash: sha256Hex(refsJson) };
}

export function writeCoverage(written: number, expected: number): number | "N/A" {
  return expected === 0 ? "N/A" : written / expected;
}

export function historyCoverage(captured: number, expected: number): number | "N/A" {
  return expected === 0 ? "N/A" : captured / expected;
}

export type RunStatus = "PASS" | "PARTIAL" | "FAILED";

export function decideRunStatus(writtenPicks: number, expectedPicks: number): RunStatus {
  if (expectedPicks === 0 || writtenPicks === expectedPicks) return "PASS";
  if (writtenPicks === 0) return "FAILED";
  return "PARTIAL";
}

export type DataHoldReason = "SNAPSHOT_WRITE_COVERAGE" | "HISTORY_CAPTURE_COVERAGE";

/** N/A eksiklik sayılmaz; sayısal oran eşiğin altındaysa DATA_HOLD nedeni döner. */
export function dataHoldReasons(writeCov: number | "N/A", histCov: number | "N/A"): DataHoldReason[] {
  const reasons: DataHoldReason[] = [];
  if (writeCov !== "N/A" && writeCov < COVERAGE_THRESHOLD) reasons.push("SNAPSHOT_WRITE_COVERAGE");
  if (histCov !== "N/A" && histCov < COVERAGE_THRESHOLD) reasons.push("HISTORY_CAPTURE_COVERAGE");
  return reasons;
}

export type PickSnapshotInput = {
  pickId: string;
  predictionId: string;
  runnerTjkAtId: number | null;
  rowsUsed: NormalizedHistoryRow[];
  availableBeforeCutoff: number;
  refsJson: string;
  sourceHash: string;
};

export type RunInput = {
  predictionId: string;
  raceId: string;
  engineVersion: string;
  gitCommitHash: string | null;
  weightsSemanticHash: string | null;
  scalerSemanticHash: string | null;
  predictionAt: Date;
  cutoffAt: Date;
  expectedPicks: number;
};

export type SnapshotDeps = {
  insertRun: (run: RunInput & { status: "PENDING" }) => Promise<string>;
  insertPick: (runId: string, pick: PickSnapshotInput) => Promise<void>;
  updateRun: (runId: string, fields: { writtenPicks: number; expectedHistoryRows: number; capturedHistoryRows: number; status: RunStatus; errorCode: string | null }) => Promise<void>;
  log: (event: string, detail: Record<string, unknown>) => void;
};

export type CaptureResult = {
  status: RunStatus | "RUN_NOT_WRITTEN";
  writtenPicks: number;
  expectedPicks: number;
  capturedHistoryRows: number;
  expectedHistoryRows: number;
  dataHold: DataHoldReason[];
  errorCode: string | null;
};

/** Fail-open: hiçbir koşulda throw etmez; çağıran tahmin akışı bundan etkilenmez. */
export async function captureResearchSnapshotBestEffort(run: RunInput, picks: PickSnapshotInput[], deps: SnapshotDeps): Promise<CaptureResult> {
  const expectedHistory = picks.reduce((s, p) => s + expectedHistoryRowsFor(p.availableBeforeCutoff), 0);
  const capturedHistory = picks.reduce((s, p) => s + Math.min(p.rowsUsed.length, expectedHistoryRowsFor(p.availableBeforeCutoff)), 0);
  let runId: string;
  try {
    runId = await deps.insertRun({ ...run, status: "PENDING" });
  } catch (e) {
    deps.log("RESEARCH_RUN_INSERT_FAILED", { predictionId: run.predictionId, error: String(e) });
    return { status: "RUN_NOT_WRITTEN", writtenPicks: 0, expectedPicks: picks.length, capturedHistoryRows: 0, expectedHistoryRows: expectedHistory, dataHold: [], errorCode: "RUN_INSERT_FAILED" };
  }
  let written = 0;
  let pickErrors = 0;
  for (const p of picks) {
    try {
      await deps.insertPick(runId, p);
      written++;
    } catch (e) {
      pickErrors++;
      deps.log("RESEARCH_PICK_INSERT_FAILED", { predictionId: run.predictionId, pickId: p.pickId, error: String(e) });
    }
  }
  const status = decideRunStatus(written, picks.length);
  const writeCov = writeCoverage(written, picks.length);
  const histCov = historyCoverage(capturedHistory, expectedHistory);
  try {
    await deps.updateRun(runId, {
      writtenPicks: written,
      expectedHistoryRows: expectedHistory,
      capturedHistoryRows: capturedHistory,
      status,
      errorCode: pickErrors > 0 ? "PICK_INSERT_PARTIAL" : null,
    });
  } catch (e) {
    deps.log("RESEARCH_RUN_UPDATE_FAILED", { predictionId: run.predictionId, error: String(e) });
  }
  return {
    status,
    writtenPicks: written,
    expectedPicks: picks.length,
    capturedHistoryRows: capturedHistory,
    expectedHistoryRows: expectedHistory,
    dataHold: dataHoldReasons(writeCov, histCov),
    errorCode: pickErrors > 0 ? "PICK_INSERT_PARTIAL" : null,
  };
}

/** Bayrak kapalıyken hiçbir DB çağrısı yapılmaz; çağıran için no-op. */
export async function maybeCaptureResearchSnapshot(enabled: boolean, run: RunInput, picks: PickSnapshotInput[], deps: SnapshotDeps): Promise<CaptureResult | null> {
  if (!enabled) return null;
  try {
    return await captureResearchSnapshotBestEffort(run, picks, deps);
  } catch (e) {
    try { deps.log("RESEARCH_SNAPSHOT_UNEXPECTED", { predictionId: run.predictionId, error: String(e) }); } catch { /* son çare */ }
    return null;
  }
}
