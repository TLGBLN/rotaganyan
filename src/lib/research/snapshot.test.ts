import { describe, expect, it, vi } from "vitest";
import { analizEtTekYaris } from "@/lib/methodology/pace-analizi";
import {
  decodeCheckpoints,
  encodeSectional,
  ACCURACE_LIMITATION_NOTE,
  buildSourceRefs,
  canonicalJson,
  captureResearchSnapshotBestEffort,
  dataHoldReasons,
  decideRunStatus,
  dbErrorCode,
  expectedHistoryRowsFor,
  historyCoverage,
  isResearchSnapshotEnabled,
  isSystemicDbError,
  maybeCaptureResearchSnapshot,
  selectHistoryRows,
  writeCoverage,
  type PickSnapshotInput,
  type RunInput,
  type SnapshotDeps,
} from "./snapshot";

const RACE_DATE = new Date("2026-10-04T00:00:00Z");

const RUN: RunInput = {
  predictionId: "pred1",
  raceId: "race1",
  engineVersion: "V5.46",
  gitCommitHash: "abc",
  weightsSemanticHash: "w",
  scalerSemanticHash: "s",
  predictionAt: new Date("2026-10-04T09:00:00Z"),
  cutoffAt: RACE_DATE,
  expectedPicks: 2,
};

function rowsOf(dates: string[]) {
  return dates.map((d, i) => ({ date: d, finishPos: String(i + 1), hp: "60", classType: "ŞARTLI 4", distance: 1200, surface: "K:Normal", weight: "57" }));
}

function pick(id: string, available: number, rows = 3): PickSnapshotInput {
  const { refsJson, sourceHash } = buildSourceRefs(selectHistoryRows(rowsOf(["01.09.2026", "15.09.2026", "25.09.2026"]).slice(0, rows), RACE_DATE), []);
  return { pickId: id, predictionId: "pred1", runnerTjkAtId: 1, rowsUsed: selectHistoryRows(rowsOf(["01.09.2026", "15.09.2026", "25.09.2026"]).slice(0, rows), RACE_DATE), availableBeforeCutoff: available, refsJson, sourceHash };
}

function deps(over: Partial<SnapshotDeps> = {}): SnapshotDeps {
  return {
    writeBatch: vi.fn(async () => { throw new Error("Raw query failed. Code: `23505`. Message: unique"); }),
    insertRun: vi.fn(async () => "run1"),
    insertPick: vi.fn(async () => undefined),
    updateRun: vi.fn(async () => undefined),
    log: vi.fn(),
    ...over,
  };
}

describe("bayrak ve yardımcılar", () => {
  it("bayrak yalnızca 'true' ise açık", () => {
    expect(isResearchSnapshotEnabled({ RESEARCH_SNAPSHOT_ENABLED: "true" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isResearchSnapshotEnabled({ RESEARCH_SNAPSHOT_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isResearchSnapshotEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("flag kapalıyken hiçbir DB çağrısı yapılmaz (parity)", async () => {
    const d = deps();
    const r = await maybeCaptureResearchSnapshot(false, RUN, [pick("p1", 5), pick("p2", 5)], d);
    expect(r).toBeNull();
    expect(d.insertRun).not.toHaveBeenCalled();
    expect(d.insertPick).not.toHaveBeenCalled();
    expect(d.updateRun).not.toHaveBeenCalled();
  });

  it("canonicalJson anahtar sırasından bağımsızdır", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

describe("geçmiş satır seçimi", () => {
  it("cutoff öncesi, en yeni → eski, en fazla 5 satır", () => {
    const rows = rowsOf(["01.09.2026", "15.09.2026", "25.09.2026", "30.09.2026", "02.10.2026", "03.10.2026", "04.10.2026", "05.10.2026"]);
    const out = selectHistoryRows(rows, RACE_DATE);
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.date)).toEqual(["2026-10-03", "2026-10-02", "2026-09-30", "2026-09-25", "2026-09-15"]);
  });
  it("aynı gün ve sonraki günler kesinlikle dışarıda", () => {
    const out = selectHistoryRows(rowsOf(["04.10.2026", "05.10.2026"]), RACE_DATE);
    expect(out).toHaveLength(0);
  });
  it("bozuk tarih dışarıda (fail-closed)", () => {
    expect(selectHistoryRows(rowsOf(["bozuk", "03.10.2026"]), RACE_DATE).map((r) => r.date)).toEqual(["2026-10-03"]);
  });
  it("expectedHistoryRows = min(5, mevcut)", () => {
    expect(expectedHistoryRowsFor(0)).toBe(0);
    expect(expectedHistoryRowsFor(2)).toBe(2);
    expect(expectedHistoryRowsFor(9)).toBe(5);
  });
});

describe("deterministik kaynak referansı", () => {
  it("aynı girdi aynı hash ve aynı JSON'u verir", () => {
    const rows = selectHistoryRows(rowsOf(["01.09.2026", "15.09.2026"]), RACE_DATE);
    const splits = [{ horseName: "A", horseNumber: 1, finishTimeReal: 1000, raceLength: 1200, splitCount: 8, checkpoints: [{ checkpoint: 1, timeReal: 12000, place: 3 }] }];
    const a = buildSourceRefs(rows, splits);
    const b = buildSourceRefs(rows, [...splits]);
    expect(a.refsJson).toBe(b.refsJson);
    expect(a.sourceHash).toBe(b.sourceHash);
  });
  it("sectional girdi değişince hash değişir", () => {
    const rows = selectHistoryRows(rowsOf(["01.09.2026"]), RACE_DATE);
    const a = buildSourceRefs(rows, [{ horseName: "A", horseNumber: 1, checkpoints: [], finishTimeReal: 1000, raceLength: 1200, splitCount: 8 }]);
    const b = buildSourceRefs(rows, [{ horseName: "A", horseNumber: 1, checkpoints: [], finishTimeReal: 1001, raceLength: 1200, splitCount: 8 }]);
    expect(a.sourceHash).not.toBe(b.sourceHash);
  });
  it("Accurace sınırlaması belgeye girer; revizyon yok", () => {
    const { refs } = buildSourceRefs([], []);
    expect(refs.accurace.raceRevisionId).toBeNull();
    expect(refs.accurace.note).toBe(ACCURACE_LIMITATION_NOTE);
  });
});

describe("sürümleme (aynı tahmin tekrar kaydedilince)", () => {
  it("ikinci kayıt yeni run ve kendi pick snapshot'larını üretir; eski kayıt değişmez", async () => {
    let runSeq = 0;
    const d = deps({ insertRun: vi.fn(async () => `run${++runSeq}`) });
    await captureResearchSnapshotBestEffort(RUN, [pick("p1", 3, 3)], d);
    await captureResearchSnapshotBestEffort(RUN, [pick("p1", 3, 3)], d);
    const runIds = (d.insertPick as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(runIds).toEqual(["run1", "run2"]);
    expect(d.updateRun).toHaveBeenCalledWith("run1", expect.anything());
    expect(d.updateRun).toHaveBeenCalledWith("run2", expect.anything());
  });
});

describe("sectional yeniden üretilebilirlik (snapshotSchemaVersion=2)", () => {
  const CP = [
    { checkpoint: 1, timeReal: 12000, place: 5 },
    { checkpoint: 2, timeReal: 24500, place: 4 },
    { checkpoint: 3, timeReal: 37000, place: 3 },
    { checkpoint: 4, timeReal: 49800, place: 2 },
    { checkpoint: 5, timeReal: 62100, place: 1 },
  ];
  const RAW = { horseName: "KALİKİ", horseNumber: 6, finishTimeReal: 62100, raceLength: 1400, splitCount: 9, checkpoints: CP };

  it("payload raceLength ve splitCount içerir", () => {
    const { refs } = buildSourceRefs([], [RAW]);
    expect(refs.snapshotSchemaVersion).toBe(2);
    expect(refs.accurace.splitInputs[0].raceLength).toBe(1400);
    expect(refs.accurace.splitInputs[0].splitCount).toBe(9);
  });

  it("tuple decode mevcut üretim checkpoint yapısıyla birebir aynı", () => {
    const enc = encodeSectional(RAW);
    expect(enc.checkpointTuples).toEqual([[1, 12000, 5], [2, 24500, 4], [3, 37000, 3], [4, 49800, 2], [5, 62100, 1]]);
    expect(decodeCheckpoints(enc.checkpointTuples)).toEqual(CP);
  });

  it("snapshot'tan yeniden kurulan analiz, üretim girdisiyle aynı sonucu verir", () => {
    const enc = encodeSectional(RAW);
    const fromSnapshot = analizEtTekYaris(decodeCheckpoints(enc.checkpointTuples), enc.raceLength, enc.splitCount);
    const fromProduction = analizEtTekYaris(CP, RAW.raceLength, RAW.splitCount);
    expect(fromSnapshot).not.toBeNull();
    expect(fromSnapshot).toEqual(fromProduction);
  });

  it("aynı normalize payload her zaman aynı sourceHash'i üretir", () => {
    const rows = selectHistoryRows(rowsOf(["01.09.2026"]), RACE_DATE);
    expect(buildSourceRefs(rows, [RAW]).sourceHash).toBe(buildSourceRefs(rows, [{ ...RAW, checkpoints: [...CP].reverse() }]).sourceHash);
  });
});

describe("coverage ve durum", () => {
  it("expectedHistoryRows=0 → historyCoverage N/A ve DATA_HOLD nedeni değil", () => {
    expect(historyCoverage(0, 0)).toBe("N/A");
    expect(dataHoldReasons("N/A", "N/A")).toEqual([]);
  });
  it("oranlar ve eşik", () => {
    expect(writeCoverage(96, 100)).toBe(0.96);
    expect(dataHoldReasons(0.96, 0.94)).toEqual(["HISTORY_CAPTURE_COVERAGE"]);
    expect(dataHoldReasons(0.9, 0.97)).toEqual(["SNAPSHOT_WRITE_COVERAGE"]);
  });
  it("PASS / PARTIAL / FAILED", () => {
    expect(decideRunStatus(2, 2)).toBe("PASS");
    expect(decideRunStatus(1, 2)).toBe("PARTIAL");
    expect(decideRunStatus(0, 2)).toBe("FAILED");
  });
});

describe("fail-open write-path", () => {
  it("run insert başarısızsa throw etmez, RUN_NOT_WRITTEN döner", async () => {
    const d = deps({ insertRun: vi.fn(async () => { throw new Error("db down"); }) });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("p1", 5), pick("p2", 5)], d);
    expect(r.status).toBe("RUN_NOT_WRITTEN");
    expect(r.errorCode).toBe("RUN_INSERT_FAILED");
    expect(d.insertPick).not.toHaveBeenCalled();
    expect(d.log).toHaveBeenCalledWith("RESEARCH_RUN_INSERT_FAILED", expect.anything());
  });
  it("tüm pick insert başarısızsa FAILED, throw yok", async () => {
    const d = deps({ insertPick: vi.fn(async () => { throw new Error("x"); }) });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("p1", 5), pick("p2", 5)], d);
    expect(r.status).toBe("FAILED");
    expect(r.writtenPicks).toBe(0);
  });
  it("kısmi pick hatası PARTIAL, kayıt güncellenir", async () => {
    let n = 0;
    const d = deps({ insertPick: vi.fn(async () => { n++; if (n === 2) throw new Error("x"); }) });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("p1", 5), pick("p2", 5)], d);
    expect(r.status).toBe("PARTIAL");
    expect(r.errorCode).toBe("PICK_INSERT_PARTIAL");
    expect(d.updateRun).toHaveBeenCalledWith("run1", expect.objectContaining({ status: "PARTIAL", writtenPicks: 1 }));
  });
  it("tam başarı PASS, hata kodu yok", async () => {
    const d = deps();
    const full = (id: string) => pick(id, 3, 3);
    const r = await captureResearchSnapshotBestEffort(RUN, [full("p1"), full("p2")], d);
    expect(r.status).toBe("PASS");
    expect(r.errorCode).toBeNull();
    expect(r.dataHold).toEqual([]);
  });
  it("update başarısızsa da throw etmez", async () => {
    const d = deps({ updateRun: vi.fn(async () => { throw new Error("x"); }) });
    await expect(captureResearchSnapshotBestEffort(RUN, [pick("p1", 5)], d)).resolves.toBeDefined();
  });
  it("beklenmeyen hata maybeCapture içinde yutulur", async () => {
    const d = deps({ log: vi.fn(() => { throw new Error("log down"); }), insertRun: vi.fn(async () => { throw new Error("db"); }) });
    await expect(maybeCaptureResearchSnapshot(true, RUN, [pick("p1", 5)], d)).resolves.toBeDefined();
  });
  it("debutant (geçmişsiz) pick için historyCoverage N/A, DATA_HOLD yok", async () => {
    const d = deps();
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("p1", 0, 0), pick("p2", 0, 0)], d);
    expect(r.expectedHistoryRows).toBe(0);
    expect(r.dataHold).toEqual([]);
    expect(r.status).toBe("PASS");
  });
});

describe("batch yazım ve kontrollü fallback", () => {
  it("batch başarılıysa tek yazım yapılır, pick-bazlı yola geçilmez", async () => {
    const d = deps({ writeBatch: vi.fn(async () => "runB") });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("a", 5), pick("b", 5)], d);
    expect(d.writeBatch).toHaveBeenCalledTimes(1);
    expect(d.insertRun).not.toHaveBeenCalled();
    expect(d.insertPick).not.toHaveBeenCalled();
    expect(d.updateRun).not.toHaveBeenCalled();
    expect(r).toMatchObject({ status: "PASS", writtenPicks: 2, expectedPicks: 2, errorCode: null });
  });

  it("bağlantı/sistemik hatada pick döngüsüne girilmez, run FAILED yazılır", async () => {
    const d = deps({ writeBatch: vi.fn(async () => { throw new Error("Can't reach database server"); }) });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("a", 5), pick("b", 5)], d);
    expect(d.insertPick).not.toHaveBeenCalled();
    expect(d.insertRun).toHaveBeenCalledTimes(1);
    expect(d.insertRun).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED", errorCode: "SYSTEMIC_DB_ERROR" }));
    expect(r).toMatchObject({ status: "FAILED", errorCode: "SYSTEMIC_DB_ERROR" });
  });

  it("satır bazlı hata (kısıt/tetikleyici) pick-bazlı fallback'e düşer ve PARTIAL üretir", async () => {
    let n = 0;
    const d = deps({
      writeBatch: vi.fn(async () => { throw new Error("Raw query failed. Code: `P0001`. Message: IT_FAULT_PICK"); }),
      insertPick: vi.fn(async () => { n++; if (n === 2) throw new Error("x"); }),
    });
    const r = await captureResearchSnapshotBestEffort(RUN, [pick("a", 5), pick("b", 5), pick("c", 5)], d);
    expect(d.insertRun).toHaveBeenCalledWith(expect.objectContaining({ status: "PENDING" }));
    expect(d.insertPick).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ status: "PARTIAL", writtenPicks: 2, errorCode: "PICK_INSERT_PARTIAL" });
  });

  it("hata kodu ayrıştırma ve sınıflandırma", () => {
    expect(dbErrorCode(new Error("Raw query failed. Code: `23505`. Message: x"))).toBe("23505");
    expect(dbErrorCode({ code: "22P02" })).toBe("22P02");
    expect(dbErrorCode(new Error("boom"))).toBeNull();
    expect(isSystemicDbError(new Error("Raw query failed. Code: `23505`"))).toBe(false);
    expect(isSystemicDbError(new Error("Raw query failed. Code: `22001`"))).toBe(false);
    expect(isSystemicDbError(new Error("Raw query failed. Code: `P0001`"))).toBe(false);
    expect(isSystemicDbError(new Error("Raw query failed. Code: `42P01`"))).toBe(true);
    expect(isSystemicDbError(new Error("Raw query failed. Code: `57014`"))).toBe(true);
    expect(isSystemicDbError(new Error("Can't reach database"))).toBe(true);
    const wrapped = Object.assign(new Error("Raw query failed. Code: `23505`. Message: unique"), { code: "P2010" });
    expect(dbErrorCode(wrapped)).toBe("23505");
    expect(isSystemicDbError(wrapped)).toBe(false);
  });
});
