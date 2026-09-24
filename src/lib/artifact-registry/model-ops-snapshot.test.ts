// Model Operations v1 snapshot / lastGoodSnapshot kabul testleri — SENTETİK, DB publish YOK.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FileSnapshotSink,
  InMemorySnapshotSink,
  PENDING,
  SnapshotCorruptError,
  buildSnapshot,
  computeSnapshotContentHash,
  publishSnapshot,
  runRaceEvaluations,
  type ModelIdentity,
  type ModelOpsIdentity,
  type ModelOpsRacePayload,
  type ModelOpsRaceSource,
  type ModelOpsSnapshot,
  type SnapshotSink,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "model-ops-snap-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const BASE = Date.UTC(2026, 8, 1, 10, 0, 0);
const rid = (k: number) => `race-${String(k).padStart(3, "0")}`;
const model = (over: Partial<ModelIdentity> = {}): ModelIdentity => ({
  engineVersion: "V5.46", featureSchemaVersion: "f1", dataPipelineVersion: "d1", calibrationVersion: "c1", postProcessVersion: "p1",
  trainingSnapshotId: "t1", modelRole: "CHAMPION", cohortType: "LIVE", cohortStartAt: "2026-09-01T00:00:00Z", ...over,
});
const ident = (over: Partial<ModelIdentity> = {}): ModelOpsIdentity => ({ model: model(over), evaluationMethodVersion: "e1" });

function makeSource(n: number, opts: { pendingFrom?: number } = {}) {
  const winners = new Map<string, number | null>();
  for (let k = 0; k < n; k++) winners.set(rid(k), opts.pendingFrom !== undefined && k >= opts.pendingFrom ? null : (k % 5) + 1);
  const source: ModelOpsRaceSource = {
    listRaces: async () => [...winners.entries()].map(([raceId, w]) => ({ raceId, resultFingerprint: w === null ? undefined : `w${w}` })),
    loadRace: async (raceId) => {
      const w = winners.get(raceId);
      if (w === null || w === undefined) return PENDING;
      const k = Number(raceId.slice(5));
      const start = BASE + k * 600_000;
      const p: ModelOpsRacePayload = {
        predictionId: `p-${raceId}`, cohortType: "LIVE", raceStartAt: new Date(start).toISOString(), predictionCreatedAt: new Date(start - 3_600_000).toISOString(),
        segment: "Diger", resultFingerprint: `w${w}`, winnerNos: [w], probs: { "1": 0.4, "2": 0.25, "3": 0.15, "4": 0.12, "5": 0.08 },
      };
      return p;
    },
  };
  return { winners, source };
}

const evalRun = (source: ModelOpsRaceSource, over: Partial<Parameters<typeof runRaceEvaluations>[0]> = {}) =>
  runRaceEvaluations({ identity: ident(), source, root, log: quiet, ...over });

async function snapshotOf(source: ModelOpsRaceSource, version: number, publishedAt = "2031-01-01T00:00:00.000Z"): Promise<ModelOpsSnapshot> {
  const result = await evalRun(source);
  return buildSnapshot({ identity: ident(), result, snapshotVersion: version, publishedAt });
}

describe("snapshot üretimi (saf veri yapısı)", () => {
  it("kompakt: sürüm + kaynak kimliği + computedThroughRaceAt + publishedAt + status=VALID + üç pencere", async () => {
    const { source } = makeSource(120, { pendingFrom: 110 });
    const s = await snapshotOf(source, 1);
    expect(s.status).toBe("VALID");
    expect(s.snapshotVersion).toBe(1);
    expect(s.publishedAt).toBe("2031-01-01T00:00:00.000Z");
    expect(s.sourceArtifactIdentity.cohortType).toBe("LIVE");
    expect(s.sourceArtifactIdentity.cohortStartAt).toBe("2026-09-01T00:00:00.000Z");
    expect(s.computedThroughRaceAt).toBe(new Date(BASE + 109 * 600_000).toISOString()); // sonucu gelen en geç yarış
    expect(s.windows.cohortType).toBe("LIVE");
    expect(s.windows.ALL.n).toBe(110);
    expect(s.windows.RECENT_100.n).toBe(100);
    expect(s.quality).toMatchObject({ evaluated: 110, pending: 10, failed: 0, jobStatus: "COMPLETE" });
    expect(computeSnapshotContentHash(s)).toBe(s.contentHash);
    expect(JSON.stringify(s).length).toBeLessThan(5_000); // kompakt: yarış listesi/halka içermez
  });

  it("yarım çalıştırma (PAUSED) veya başarısız item → INCOMPLETE, asla VALID değil", async () => {
    const { source } = makeSource(50);
    const paused = await evalRun(source, { maxItemsThisRun: 10 });
    const s = buildSnapshot({ identity: ident(), result: paused, snapshotVersion: 1, publishedAt: "t" });
    expect(s.status).toBe("INCOMPLETE");
    expect(s.quality.reasons).toContain("JOB_PAUSED");
  });

  it("contentHash publishedAt/snapshotVersion'dan bağımsız (idempotency anahtarı), içerikten bağımlı", async () => {
    const { source, winners } = makeSource(30);
    const a = await snapshotOf(source, 1, "2031-01-01T00:00:00.000Z");
    const b = await snapshotOf(source, 7, "2032-02-02T00:00:00.000Z");
    expect(b.contentHash).toBe(a.contentHash);
    winners.set(rid(3), 5); // sonuç düzeltmesi
    const c = await snapshotOf(source, 1);
    expect(c.contentHash).not.toBe(a.contentHash);
  });
});

describe("atomik lastGoodSnapshot semantiği", () => {
  it("ilk publish → PUBLISHED; aynı içerik tekrar → UNCHANGED (sürüm artmaz, idempotent)", async () => {
    const { source } = makeSource(40);
    const sink = new InMemorySnapshotSink();
    const p1 = publishSnapshot(sink, (v) => { throw new Error("henüz sync build"); }); // build async olamaz: aşağıda hazır sonuçla
    expect(p1.outcome).toBe("REJECTED");
    expect(sink.getActive()).toBeNull();

    const result = await evalRun(source);
    const mk = (v: number, at: string) => buildSnapshot({ identity: ident(), result, snapshotVersion: v, publishedAt: at });
    const pub = publishSnapshot(sink, (v) => mk(v, "2031-01-01T00:00:00.000Z"));
    expect(pub.outcome).toBe("PUBLISHED");
    expect(sink.getActive()!.snapshotVersion).toBe(1);

    const again = publishSnapshot(sink, (v) => mk(v, "2031-06-01T00:00:00.000Z"));
    expect(again.outcome).toBe("UNCHANGED");
    expect(sink.getActive()!.snapshotVersion).toBe(1);
    expect(sink.getActive()!.publishedAt).toBe("2031-01-01T00:00:00.000Z"); // yeniden yayınlanmadı
  });

  it("yeni sonuç gelince yeni sürüm; eski lastGood yeni TAM hazır olana kadar aktif", async () => {
    const { source, winners } = makeSource(60, { pendingFrom: 50 });
    const sink = new InMemorySnapshotSink();
    const r1 = await evalRun(source);
    publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r1, snapshotVersion: v, publishedAt: "T1" }));
    expect(sink.getActive()!.windows.ALL.n).toBe(50);

    for (let k = 50; k < 60; k++) winners.set(rid(k), 2);
    const r2 = await evalRun(source);
    const out = publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r2, snapshotVersion: v, publishedAt: "T2" }));
    expect(out.outcome).toBe("PUBLISHED");
    expect(sink.getActive()!.snapshotVersion).toBe(2);
    expect(sink.getActive()!.windows.ALL.n).toBe(60);
  });

  it("14) üretim yarıda kalırsa (build hata / INCOMPLETE / bozuk hash / swap hata) eski lastGoodSnapshot korunur", async () => {
    const { source } = makeSource(40);
    const sink = new InMemorySnapshotSink();
    const good = await evalRun(source);
    publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: good, snapshotVersion: v, publishedAt: "T1" }));
    const before = JSON.stringify(sink.getActive());

    // (a) build ortasında hata
    const a = publishSnapshot(sink, () => { throw new Error("ortada çöktü"); });
    expect(a.outcome).toBe("REJECTED");
    expect(a.outcome === "REJECTED" && a.reasons[0]).toMatch(/BUILD_FAILED/);

    // (b) yarım çalıştırmadan INCOMPLETE snapshot
    const { source: s2 } = makeSource(80);
    const partial = await evalRun(s2, { maxItemsThisRun: 5 });
    const b = publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: partial, snapshotVersion: v, publishedAt: "T2" }));
    expect(b.outcome).toBe("REJECTED");

    // (c) içeriği bozulmuş (hash uyuşmuyor) aday
    const c = publishSnapshot(sink, (v) => {
      const s = buildSnapshot({ identity: ident(), result: good, snapshotVersion: v, publishedAt: "T3" });
      return { ...s, windows: { ...s.windows, ALL: { ...s.windows.ALL, n: 9999 } } };
    });
    expect(c.outcome === "REJECTED" && c.reasons).toContain("CONTENT_HASH_MISMATCH");

    // (d) swap sırasında hata
    const boom: SnapshotSink = { getActive: () => sink.getActive(), swapActive: () => { throw new Error("disk dolu"); } };
    const { source: s3, winners } = makeSource(40);
    winners.set(rid(1), 4);
    const changed = await evalRun(s3);
    const d = publishSnapshot(boom, (v) => buildSnapshot({ identity: ident(), result: changed, snapshotVersion: v, publishedAt: "T4" }));
    expect(d.outcome === "REJECTED" && d.reasons[0]).toMatch(/SWAP_FAILED/);

    expect(JSON.stringify(sink.getActive())).toBe(before); // hiçbiri lastGood'u değiştirmedi
  });

  it("başka model/cohort kimliğinin snapshot'ı aynı sink'i EZEMEZ", async () => {
    const { source } = makeSource(30);
    const sink = new InMemorySnapshotSink();
    const r1 = await evalRun(source);
    publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r1, snapshotVersion: v, publishedAt: "T1" }));
    const otherIdent = ident({ calibrationVersion: "c2" });
    const r2 = await evalRun(source, { identity: otherIdent });
    const out = publishSnapshot(sink, (v) => buildSnapshot({ identity: otherIdent, result: r2, snapshotVersion: v, publishedAt: "T2" }));
    expect(out.outcome === "REJECTED" && out.reasons).toContain("SOURCE_IDENTITY_MISMATCH");
    expect(sink.getActive()!.snapshotVersion).toBe(1);
  });
});

describe("FileSnapshotSink (tmp + rename)", () => {
  it("yarım kalmış tmp dosyası aktif snapshot'ı etkilemez; sonraki publish çalışır", async () => {
    const { source, winners } = makeSource(40, { pendingFrom: 30 });
    const dir = path.join(root, "sink");
    const sink = new FileSnapshotSink(dir);
    const r1 = await evalRun(source);
    expect(publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r1, snapshotVersion: v, publishedAt: "T1" })).outcome).toBe("PUBLISHED");

    fs.writeFileSync(path.join(dir, "snapshot.active.json.99999.tmp"), '{"schemaVersion":1,"snapshotVersion":2,"status":"VAL'); // swap ortasında çökme kalıntısı
    expect(sink.getActive()!.snapshotVersion).toBe(1);

    for (let k = 30; k < 40; k++) winners.set(rid(k), 1);
    const r2 = await evalRun(source);
    expect(publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r2, snapshotVersion: v, publishedAt: "T2" })).outcome).toBe("PUBLISHED");
    expect(new FileSnapshotSink(dir).getActive()!.windows.ALL.n).toBe(40);
  });

  it("bozuk aktif dosya sessizce ezilmez → SnapshotCorruptError (dashboard UNKNOWN)", async () => {
    const { source } = makeSource(20);
    const dir = path.join(root, "sink2");
    const sink = new FileSnapshotSink(dir);
    const r = await evalRun(source);
    publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r, snapshotVersion: v, publishedAt: "T1" }));
    const file = path.join(dir, "snapshot.active.json");
    fs.writeFileSync(file, fs.readFileSync(file, "utf-8").replace(/"n":20/, '"n":21')); // içerik değişti, hash aynı
    expect(() => sink.getActive()).toThrow(SnapshotCorruptError);
    expect(() => publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: r, snapshotVersion: v, publishedAt: "T2" }))).toThrow(SnapshotCorruptError);
  });
});
