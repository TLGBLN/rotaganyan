// Model Ops sözleşme sertleştirme kabul testleri — SENTETİK (DB/ChallengerRun/production YOK).
// RaceDescriptor sözleşmesi, EXCLUDED_CANCELLED/VOID, PENDING_STALE gözlemi, watermark alanları (published/contiguous/lateGap).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InMemorySnapshotSink,
  PENDING,
  buildSnapshot,
  observeRaceState,
  publishSnapshot,
  raceLifecycle,
  readEvaluationHistory,
  runRaceEvaluations,
  validateRaceDescriptor,
  type CohortType,
  type ModelIdentity,
  type ModelOpsIdentity,
  type ModelOpsRacePayload,
  type ModelOpsRaceSource,
  type ModelOpsSnapshot,
  type RaceDescriptor,
  type RaceStatus,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "model-ops-contract-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const BASE = Date.UTC(2026, 8, 1, 10, 0, 0);
const STEP = 600_000;
const HOUR = 3_600_000;
const rid = (k: number) => `race-${String(k).padStart(3, "0")}`;
const model = (over: Partial<ModelIdentity> = {}): ModelIdentity => ({
  engineVersion: "V5.46", featureSchemaVersion: "f1", dataPipelineVersion: "d1", calibrationVersion: "c1", postProcessVersion: "p1",
  trainingSnapshotId: "t1", modelRole: "CHAMPION", cohortType: "LIVE", cohortStartAt: "2026-09-01T00:00:00Z", ...over,
});
const ident = (over: Partial<ModelIdentity> = {}): ModelOpsIdentity => ({ model: model(over), evaluationMethodVersion: "e1" });

interface Def { startMs: number; winner: number | null; status: RaceStatus; cohort: CohortType }

function makeWorld(n: number) {
  const defs = new Map<string, Def>();
  const raw = new Map<string, Partial<RaceDescriptor> & Record<string, unknown>>(); // bozuk descriptor üretmek için ham geçersiz kılma
  const loads: string[] = [];
  const add = (id: string, startMs: number, over: Partial<Def> = {}) => defs.set(id, { startMs, winner: 1, status: "COMPLETED", cohort: "LIVE", ...over });
  for (let k = 0; k < n; k++) add(rid(k), BASE + k * STEP, { winner: (k % 5) + 1 });
  const setPending = (id: string, status: RaceStatus = "STARTED") => { const d = defs.get(id)!; d.winner = null; d.status = status; };
  const source: ModelOpsRaceSource = {
    listRaces: async () => {
      const out: RaceDescriptor[] = [];
      for (const [raceId, d] of defs) {
        const base: RaceDescriptor = { raceId, raceStartAt: new Date(d.startMs), cohortType: d.cohort, raceStatus: d.status, resultFingerprint: d.winner === null ? undefined : `w${d.winner}` };
        out.push({ ...base, ...(raw.get(raceId) as Partial<RaceDescriptor>) });
      }
      return out;
    },
    loadRace: async (raceId) => {
      loads.push(raceId);
      const d = defs.get(raceId)!;
      if (d.winner === null) return PENDING;
      const p: ModelOpsRacePayload = {
        predictionId: `p-${raceId}`, cohortType: d.cohort, raceStartAt: new Date(d.startMs).toISOString(), predictionCreatedAt: new Date(d.startMs - HOUR).toISOString(),
        segment: "Diger", resultFingerprint: `w${d.winner}`, winnerNos: [d.winner], probs: { "1": 0.4, "2": 0.25, "3": 0.15, "4": 0.12, "5": 0.08 },
      };
      return p;
    },
  };
  return { defs, raw, loads, add, setPending, source };
}
type World = ReturnType<typeof makeWorld>;

const evalRun = (w: World, over: Partial<Parameters<typeof runRaceEvaluations>[0]> = {}) =>
  runRaceEvaluations({ identity: ident(), source: w.source, root, log: quiet, asOf: new Date(BASE).toISOString(), ...over });

const buildFrom = (r: Awaited<ReturnType<typeof evalRun>>, at: string) => (v: number, active: ModelOpsSnapshot | null) =>
  buildSnapshot({ identity: ident(), result: r, previous: active, snapshotVersion: v, publishedAt: at });
const iso = (k: number) => new Date(BASE + k * STEP).toISOString();

describe("RaceDescriptor sözleşmesi", () => {
  it("validateRaceDescriptor: geçerli descriptor sorunsuz; eksik/geçersiz her alan adıyla raporlanır", () => {
    const ok: RaceDescriptor = { raceId: "r1", raceStartAt: new Date(BASE), cohortType: "LIVE", raceStatus: "SCHEDULED" };
    expect(validateRaceDescriptor(ok, "LIVE")).toEqual([]);
    expect(validateRaceDescriptor({ ...ok, raceId: "" }, "LIVE").join()).toMatch(/raceId/);
    expect(validateRaceDescriptor({ ...ok, raceStartAt: undefined }, "LIVE").join()).toMatch(/raceStartAt/);
    expect(validateRaceDescriptor({ ...ok, raceStartAt: new Date(NaN) }, "LIVE").join()).toMatch(/raceStartAt/);
    expect(validateRaceDescriptor({ ...ok, raceStartAt: "2026-09-01T10:00:00Z" as unknown as Date }, "LIVE").join()).toMatch(/raceStartAt/); // string değil Date
    expect(validateRaceDescriptor({ ...ok, cohortType: undefined }, "LIVE").join()).toMatch(/cohortType/);
    expect(validateRaceDescriptor({ ...ok, cohortType: "REPLAY" }, "LIVE").join()).toMatch(/LIVE ve REPLAY karışamaz/);
    expect(validateRaceDescriptor({ ...ok, raceStatus: "DONE" as RaceStatus }, "LIVE").join()).toMatch(/raceStatus/);
    expect(validateRaceDescriptor(null, "LIVE")).toEqual(["descriptor yok"]);
  });

  it("9) eksik raceStartAt → ADAPTER_CONTRACT_VIOLATION: sessizce atlanmaz, yüksek sesle raporlanır, işlenmez, snapshot INCOMPLETE, yayınlanmaz", async () => {
    const w = makeWorld(30);
    w.raw.set(rid(10), { raceStartAt: undefined });
    w.raw.set(rid(11), { raceStartAt: "yarın" as unknown as Date });
    w.raw.set(rid(12), { raceStatus: "DONE" as RaceStatus });
    const logs: string[] = [];
    const r = await evalRun(w, { log: (l) => logs.push(l) });
    expect(r.contractViolations.map((v) => v.raceId).sort()).toEqual([rid(10), rid(11), rid(12)]);
    expect(logs.some((l) => l.includes("ADAPTER_CONTRACT_VIOLATION"))).toBe(true);
    expect(w.loads.some((id) => [rid(10), rid(11), rid(12)].includes(id))).toBe(false); // işlenmedi
    expect(r.windows.ALL.n).toBe(27);
    const s = buildFrom(r, "T")(1, null);
    expect(s.status).toBe("INCOMPLETE");
    expect(s.quality.reasons).toEqual(["ADAPTER_CONTRACT_VIOLATION_3"]);
    const sink = new InMemorySnapshotSink();
    const out = publishSnapshot(sink, () => s);
    expect(out.outcome).toBe("REJECTED");
    expect(out.health.contractViolations).toBe(3);
    expect(sink.getActive()).toBeNull();
  });

  it("raceId eksik/tekrarlı descriptor da ihlaldir; geçerli yarışlar etkilenmez", async () => {
    const w = makeWorld(5);
    const orig = w.source.listRaces;
    const src: ModelOpsRaceSource = { ...w.source, listRaces: async () => [...(await orig()), { raceId: "", raceStartAt: new Date(BASE), cohortType: "LIVE", raceStatus: "SCHEDULED" }, { ...(await orig())[0] }] };
    const r = await runRaceEvaluations({ identity: ident(), source: src, root, log: quiet, asOf: new Date(BASE).toISOString() });
    expect(r.contractViolations).toHaveLength(2);
    expect(r.contractViolations.some((v) => v.raceId === "(raceId yok)")).toBe(true);
    expect(r.contractViolations.some((v) => v.problems.includes("raceId tekrarlı"))).toBe(true);
    expect(r.windows.ALL.n).toBe(5);
  });

  it("10) LIVE/REPLAY ayrımı korunur: descriptor cohort'u artifact cohort'una uymuyorsa ihlal; REPLAY ayrı artifact", async () => {
    const w = makeWorld(12);
    w.defs.get(rid(4))!.cohort = "REPLAY";
    const live = await evalRun(w);
    expect(live.contractViolations).toHaveLength(1);
    expect(live.contractViolations[0].problems.join()).toMatch(/LIVE ve REPLAY karışamaz/);
    expect(live.windows.ALL.n).toBe(11);
    expect(live.windows.cohortType).toBe("LIVE");

    const w2 = makeWorld(6);
    for (const d of w2.defs.values()) d.cohort = "REPLAY";
    const replay = await evalRun(w2, { identity: ident({ cohortType: "REPLAY" }) });
    expect(replay.contractViolations).toHaveLength(0);
    expect(replay.windows.cohortType).toBe("REPLAY");
    expect(replay.artifactDir).not.toBe(live.artifactDir);
  });
});

describe("EXCLUDED_CANCELLED / EXCLUDED_VOID (yalnız açık kaynak beyanıyla)", () => {
  it("5) CANCELLED watermark'ı tutmaz; 6) VOID watermark'ı tutmaz; terminal, PENDING kalmaz, yükleme yapılmaz, retry tüketmez", async () => {
    const w = makeWorld(30);
    w.setPending(rid(10), "CANCELLED");
    w.setPending(rid(20), "VOID");
    const r = await evalRun(w);
    expect(r.exclusions.get(rid(10))!.status).toBe("EXCLUDED_CANCELLED");
    expect(r.exclusions.get(rid(20))!.status).toBe("EXCLUDED_VOID");
    expect(r.exclusions.get(rid(10))!.reason).toMatch(/açıkça CANCELLED/);
    expect(w.loads.includes(rid(10))).toBe(false); // ne tahmin ne sonuç yüklendi
    expect(w.loads.includes(rid(20))).toBe(false);
    expect(r.pendingRaceIds).toEqual([]); // PENDING kalmadı
    expect(r.job.manifest.failedItems).toEqual({}); // failure değil
    expect(r.windows.ALL.n).toBe(28); // aggregate'e girmedi

    const s = buildFrom(r, "T")(1, null);
    expect(s.status).toBe("VALID");
    expect(s.computedThroughRaceAt).toBe(iso(29)); // watermark hiçbirinde takılmadı
    expect(s.quality).toMatchObject({ unresolved: 0, pending: 0, excluded: { cancelled: 1, void: 1, preCohort: 0, postStart: 0 } });

    const hist = readEvaluationHistory(r.artifactDir);
    expect(raceLifecycle(rid(10), hist).state).toBe("EXCLUDED_CANCELLED");
    expect(raceLifecycle(rid(20), hist).state).toBe("EXCLUDED_VOID");

    w.loads.length = 0;
    const again = await evalRun(w);
    expect(again.job.stats.processed + again.job.stats.noResult).toBe(0); // yeniden işlenmedi
  });

  it("önce bekleyen (watermark'ı tutan) yarış sonradan AÇIKÇA iptal edilirse watermark ilerler; iptal geri alınıp sonuç gelirse EVALUATED (supersede)", async () => {
    const w = makeWorld(30);
    w.setPending(rid(10));
    const r1 = await evalRun(w);
    expect(buildFrom(r1, "T1")(1, null).computedThroughRaceAt).toBe(iso(9)); // 10. yarış tutuyor

    w.defs.get(rid(10))!.status = "CANCELLED"; // kaynak AÇIKÇA iptal bildirdi
    const r2 = await evalRun(w);
    expect(r2.exclusions.get(rid(10))!.status).toBe("EXCLUDED_CANCELLED");
    expect(buildFrom(r2, "T2")(2, null).computedThroughRaceAt).toBe(iso(29));

    Object.assign(w.defs.get(rid(10))!, { status: "COMPLETED", winner: 3 }); // iptal geri alındı, sonuç geldi
    const r3 = await evalRun(w);
    expect(r3.evaluations.has(rid(10))).toBe(true);
    expect(r3.exclusions.has(rid(10))).toBe(false);
    const versions = raceLifecycle(rid(10), readEvaluationHistory(r3.artifactDir)).versions;
    expect(versions.map((v) => v.status)).toEqual(["SUPERSEDED", "EVALUATED"]); // izi korunur
    expect(r3.windows.ALL.n).toBe(30);
  });

  it("durum geçişleri: sonucu OLAN yarış sonradan AÇIKÇA iptal/void edilirse EVALUATED → EXCLUDED (aggregate'ten çıkar, iz korunur); CANCELLED → VOID yeniden etiketlenir", async () => {
    const w = makeWorld(20);
    const r1 = await evalRun(w);
    expect(r1.windows.ALL.n).toBe(20);

    w.defs.get(rid(7))!.status = "CANCELLED"; // sonucu vardı (winner dolu) ama kaynak şimdi iptal bildirdi
    const r2 = await evalRun(w);
    expect(r2.exclusions.get(rid(7))!.status).toBe("EXCLUDED_CANCELLED");
    expect(r2.evaluations.has(rid(7))).toBe(false);
    expect(r2.windows.ALL.n).toBe(19); // aggregate'ten çıktı, çift sayım yok
    expect(raceLifecycle(rid(7), readEvaluationHistory(r2.artifactDir)).versions.map((v) => v.status)).toEqual(["SUPERSEDED", "EXCLUDED_CANCELLED"]);

    w.defs.get(rid(7))!.status = "VOID"; // kaynak durumu VOID olarak düzeltti
    const r3 = await evalRun(w);
    expect(r3.exclusions.get(rid(7))!.status).toBe("EXCLUDED_VOID");
    expect(r3.windows.ALL.n).toBe(19);
  });

  it("CANCELLED/VOID YALNIZ raceStatus ile: UNKNOWN veya sonucu gelmeyen yarış ASLA otomatik iptal olmaz", async () => {
    const w = makeWorld(20);
    w.setPending(rid(5), "UNKNOWN");
    const r = await evalRun(w, { asOf: new Date(BASE + 500 * HOUR).toISOString() }); // çok uzun gecikme
    expect(r.exclusions.size).toBe(0);
    expect(r.pendingRaceIds).toEqual([rid(5)]);
  });
});

describe("PENDING_STALE (kalıcı durum değil, gözlem etiketi)", () => {
  it("7) geciken ama iptal bilgisi olmayan yarış PENDING_STALE; CANCELLED olmaz, failure değil, aggregate'e girmez, watermark'ı tutar ve görünür", async () => {
    const w = makeWorld(30);
    w.setPending(rid(15), "UNKNOWN");
    const notYet = await evalRun(w, { asOf: new Date(BASE + 15 * STEP + 2 * HOUR).toISOString() });
    expect(notYet.pendingStaleRaceIds).toEqual([]); // SLA (24s) dolmadı → normal PENDING_RESULT

    const r = await evalRun(w, { asOf: new Date(BASE + 15 * STEP + 25 * HOUR).toISOString() });
    expect(r.pendingStaleRaceIds).toEqual([rid(15)]);
    expect(r.pendingRaceIds).toEqual([rid(15)]);
    expect(r.exclusions.has(rid(15))).toBe(false); // CANCELLED DEĞİL
    expect(r.job.manifest.failedItems).toEqual({}); // failure DEĞİL
    expect(r.windows.ALL.n).toBe(29);
    const s = buildFrom(r, "T")(1, null);
    expect(s.status).toBe("VALID");
    expect(s.quality).toMatchObject({ pendingStale: 1, pending: 0, unresolved: 1, failed: 0 });
    expect(s.computedThroughRaceAt).toBe(iso(14)); // hâlâ çözülmemiş → watermark orada durur (görünür uyarı ile)
    const desc = { raceId: rid(15), raceStartAt: new Date(BASE + 15 * STEP), cohortType: "LIVE" as const, raceStatus: "UNKNOWN" as const };
    expect(observeRaceState(desc, undefined, new Date(BASE + 15 * STEP + 25 * HOUR).toISOString())).toBe("PENDING_STALE");
    expect(observeRaceState(desc, undefined, new Date(BASE + 15 * STEP + 2 * HOUR).toISOString())).toBe("PENDING_RESULT");
    expect(observeRaceState({ ...desc, raceStatus: "SCHEDULED" }, undefined, new Date(BASE).toISOString())).toBe("SCHEDULED");
  });

  it("8) PENDING_STALE daha sonra sonuç gelince EVALUATED olur (terminal değil); geç gelen gerçek sonuç kaçmaz", async () => {
    const w = makeWorld(30);
    w.setPending(rid(15), "UNKNOWN");
    const stale = await evalRun(w, { asOf: new Date(BASE + 100 * HOUR).toISOString() });
    expect(stale.pendingStaleRaceIds).toEqual([rid(15)]);
    expect(raceLifecycle(rid(15), readEvaluationHistory(stale.artifactDir)).state).toBe("PENDING_RESULT"); // kalıcı kayıt YOK: yalnız gözlem

    Object.assign(w.defs.get(rid(15))!, { winner: 2, status: "COMPLETED" }); // günler sonra gerçek sonuç
    w.loads.length = 0;
    const done = await evalRun(w, { asOf: new Date(BASE + 100 * HOUR).toISOString() });
    expect(w.loads).toEqual([rid(15)]); // yalnız o yarış
    expect(done.evaluations.has(rid(15))).toBe(true);
    expect(done.pendingStaleRaceIds).toEqual([]);
    expect(done.windows.ALL.n).toBe(30);
    expect(buildFrom(done, "T")(1, null).computedThroughRaceAt).toBe(iso(29));
  });
});

describe("watermark: publishedThroughRaceAt / currentContiguousThroughRaceAt / lateGap", () => {
  async function publishedBase() {
    const w = makeWorld(40);
    const sink = new InMemorySnapshotSink();
    const r = await evalRun(w);
    const out = publishSnapshot(sink, buildFrom(r, "T1"));
    expect(out.outcome).toBe("PUBLISHED");
    return { w, sink };
  }

  it("1) yayınlanmış watermark geriye gitmez (gap, savunma hattı ve normal ilerleme boyunca monoton)", async () => {
    const { w, sink } = await publishedBase();
    const seen: string[] = [sink.getActive()!.publishedThroughRaceAt!];
    expect(seen[0]).toBe(iso(39));

    // builder lastGood'u BİLMESE bile (savunma hattı): daha geride bir aday yayınlanamaz
    const older = makeWorld(20);
    const rOlder = await evalRun(older, { root: path.join(root, "older") });
    const blind = publishSnapshot(sink, (v) => buildSnapshot({ identity: ident(), result: rOlder, snapshotVersion: v, publishedAt: "X" }));
    expect(blind.outcome === "REJECTED" && blind.reasons).toContain("WATERMARK_REGRESSION");
    expect(sink.getActive()!.publishedThroughRaceAt).toBe(iso(39));

    // gap sırasında da gerilemez
    w.add("race-late", BASE + 10 * STEP + 1, { winner: null, status: "STARTED" });
    publishSnapshot(sink, buildFrom(await evalRun(w), "T2"));
    seen.push(sink.getActive()!.publishedThroughRaceAt!);

    // ilerleme
    for (let k = 40; k < 45; k++) w.add(rid(k), BASE + k * STEP, { winner: 2 });
    Object.assign(w.defs.get("race-late")!, { winner: 1, status: "COMPLETED" });
    publishSnapshot(sink, buildFrom(await evalRun(w), "T3"));
    seen.push(sink.getActive()!.publishedThroughRaceAt!);
    expect(seen).toEqual([iso(39), iso(39), iso(44)]);
    for (let i = 1; i < seen.length; i++) expect(Date.parse(seen[i])).toBeGreaterThanOrEqual(Date.parse(seen[i - 1]));
  });

  it("2) watermark gerisinde yeni gap bulunursa lateGapBeforeWatermark=true; gap gizlenmez (aday ve health'te görünür)", async () => {
    const { w, sink } = await publishedBase();
    w.add("race-late", BASE + 10 * STEP + 1, { winner: null, status: "STARTED" }); // yayınlanmış noktanın (39) GERİSİNDE, çözülmemiş
    const r = await evalRun(w);
    const cand = buildFrom(r, "T2")(2, sink.getActive());
    expect(cand.lateGapBeforeWatermark).toBe(true);
    expect(cand.lateGapRaceIds).toEqual(["race-late"]);
    expect(cand.status).toBe("LATE_GAP");
    expect(cand.publishedThroughRaceAt).toBe(iso(39)); // yayınlanmış nokta korunur
    expect(cand.currentContiguousThroughRaceAt).toBe(iso(10)); // mevcut veri gerçekte burada kesintisiz (10. yarış ile race-late arası)
    expect(cand.windows.ALL.n).toBe(11); // içerik yalnız kesintisiz noktaya kadar
    const out = publishSnapshot(sink, buildFrom(r, "T2"));
    expect(out.health).toMatchObject({ lateGapBeforeWatermark: true, lateGapRaceIds: ["race-late"], publishedThroughRaceAt: iso(39), currentContiguousThroughRaceAt: iso(10), lastOutcome: "REJECTED" });
  });

  it("3) gap varken yeni VALID snapshot yayınlanmaz; lastGood aynen korunur", async () => {
    const { w, sink } = await publishedBase();
    const before = JSON.stringify(sink.getActive());
    w.add("race-late", BASE + 10 * STEP + 1, { winner: null, status: "STARTED" });
    for (let k = 40; k < 50; k++) w.add(rid(k), BASE + k * STEP, { winner: 4 }); // ileride yeni sonuçlar da var — yine de yayınlanmamalı
    const out = publishSnapshot(sink, buildFrom(await evalRun(w), "T2"));
    expect(out.outcome).toBe("REJECTED");
    expect(out.outcome === "REJECTED" && out.reasons).toContain("LATE_GAP_BEFORE_WATERMARK");
    expect(JSON.stringify(sink.getActive())).toBe(before);
    expect(sink.health!.lateGapBeforeWatermark).toBe(true); // sink'te de görünür
  });

  it("4) gap çözülünce yayın devam eder (lateGap=false, watermark ileri)", async () => {
    const { w, sink } = await publishedBase();
    w.add("race-late", BASE + 10 * STEP + 1, { winner: null, status: "STARTED" });
    for (let k = 40; k < 50; k++) w.add(rid(k), BASE + k * STEP, { winner: 4 });
    expect(publishSnapshot(sink, buildFrom(await evalRun(w), "T2")).outcome).toBe("REJECTED");

    Object.assign(w.defs.get("race-late")!, { winner: 3, status: "COMPLETED" }); // gap çözüldü
    const out = publishSnapshot(sink, buildFrom(await evalRun(w), "T3"));
    expect(out.outcome).toBe("PUBLISHED");
    const s = sink.getActive()!;
    expect(s.lateGapBeforeWatermark).toBe(false);
    expect(s.lateGapRaceIds).toEqual([]);
    expect(s.publishedThroughRaceAt).toBe(iso(49));
    expect(s.windows.ALL.n).toBe(51);
    expect(sink.health!.lateGapBeforeWatermark).toBe(false);
  });

  it("gap, açık CANCELLED ile çözülürse de yayın devam eder", async () => {
    const { w, sink } = await publishedBase();
    w.add("race-late", BASE + 10 * STEP + 1, { winner: null, status: "STARTED" });
    expect(publishSnapshot(sink, buildFrom(await evalRun(w), "T2")).outcome).toBe("REJECTED");
    w.defs.get("race-late")!.status = "CANCELLED";
    w.add(rid(40), BASE + 40 * STEP, { winner: 2 });
    expect(publishSnapshot(sink, buildFrom(await evalRun(w), "T3")).outcome).toBe("PUBLISHED");
    expect(sink.getActive()!.publishedThroughRaceAt).toBe(iso(40));
  });

  it("aynı start'ta (tie) çözülmemiş yarış zaten watermark'ın ARKASINDAYDI → sahte gap üretilmez (raceId tie-break)", async () => {
    const w = makeWorld(10);
    w.add("race-zzz", BASE + 5 * STEP, { winner: null, status: "STARTED" }); // race-005 ile AYNI start, id daha büyük → 005'ten SONRA gelir
    const sink = new InMemorySnapshotSink();
    publishSnapshot(sink, buildFrom(await evalRun(w), "T1"));
    expect(sink.getActive()!.computedThroughRaceAt).toBe(iso(5)); // race-005 (id < "zzz") çözülmüş ve watermark'ın parçası; kesim "zzz"de
    const again = publishSnapshot(sink, buildFrom(await evalRun(w), "T2"));
    expect(again.outcome).toBe("UNCHANGED"); // ikinci koşuda gap YOK
    expect(again.health.lateGapBeforeWatermark).toBe(false);
  });
});
