// Model Operations v1 çekirdek kabul testleri — SENTETİK (DB/harness/ChallengerRun/production YOK). Her test bir kabul kriterini kanıtlar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PENDING,
  RECENT_MAX,
  RegistryInvalidationError,
  evaluateRace,
  modelBehaviorHash,
  modelIdentityKey,
  modelOpsAggregateSpec,
  modelOpsArtifactIdentity,
  normalizeModelIdentity,
  raceLifecycle,
  readEvaluationHistory,
  runRaceEvaluations,
  type CohortType,
  type ModelIdentity,
  type ModelOpsIdentity,
  type ModelOpsRacePayload,
  type ModelOpsRaceSource,
  type ModelOpsWindowStats,
  type RaceEvaluationRecord,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "model-ops-test-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const rid = (k: number) => `race-${String(k).padStart(4, "0")}`;
const BASE_MS = Date.UTC(2026, 8, 1, 10, 0, 0);
const COHORT_START = "2026-09-01T00:00:00.000Z";

interface RaceDef { payloadCohort?: CohortType; startMs: number; winners: number[] | null; segment: string; cohort: CohortType; predAtMs: number; gitCommit: string }

/** Sahte dünya: yarış tanımları + yükleme sayacı. Tahmin (probs) yarış numarasından deterministik; sonuç (winners) değiştirilebilir. */
function makeWorld(n: number) {
  const defs = new Map<string, RaceDef>();
  const loads: string[] = [];
  const addRace = (k: number, over: Partial<RaceDef> = {}) =>
    defs.set(rid(k), {
      startMs: BASE_MS + k * 600_000, winners: [(k % 8) + 1], segment: k % 3 === 0 ? "Handikap" : "Diger", cohort: "LIVE",
      predAtMs: BASE_MS + k * 600_000 - 3_600_000, gitCommit: "abc1234", ...over,
    });
  for (let k = 0; k < n; k++) addRace(k);
  const probsFor = (k: number): Record<string, number> => {
    const w = Array.from({ length: 8 }, (_, i) => 1 + ((i * (1 + (k % 3)) + k * 3) % 8));
    const s = w.reduce((a, b) => a + b, 0);
    return Object.fromEntries(w.map((x, i) => [String(i + 1), x / s]));
  };
  const fpOf = (d: RaceDef) => (d.winners ? `w${d.winners.join("+")}` : undefined);
  const source: ModelOpsRaceSource = {
    listRaces: async () => [...defs.entries()].map(([raceId, d]) => ({ raceId, resultFingerprint: fpOf(d), raceStartAt: new Date(d.startMs), cohortType: d.cohort, raceStatus: d.winners ? "COMPLETED" : "STARTED" })),
    loadRace: async (raceId) => {
      loads.push(raceId);
      const d = defs.get(raceId)!;
      if (!d.winners) return PENDING;
      const k = Number(raceId.slice(5));
      const p: ModelOpsRacePayload = {
        predictionId: `pred-${raceId}`, cohortType: d.payloadCohort ?? d.cohort, raceStartAt: new Date(d.startMs).toISOString(), predictionCreatedAt: new Date(d.predAtMs).toISOString(),
        gitCommit: d.gitCommit, segment: d.segment, resultFingerprint: fpOf(d)!, winnerNos: d.winners, probs: probsFor(k),
      };
      return p;
    },
  };
  return { defs, loads, addRace, probsFor, source, fpOf };
}
type World = ReturnType<typeof makeWorld>;

const modelId = (over: Partial<ModelIdentity> = {}): ModelIdentity => ({
  engineVersion: "V5.46", featureSchemaVersion: "feat-v1", dataPipelineVersion: "pipe-v1", calibrationVersion: "cal-v1", postProcessVersion: "post-v1",
  trainingSnapshotId: "train-2026-08", modelRole: "CHAMPION", cohortType: "LIVE", cohortStartAt: COHORT_START, ...over,
});
const identity = (over: Partial<ModelIdentity> = {}, evaluationMethodVersion = "eval-v1"): ModelOpsIdentity => ({ model: modelId(over), evaluationMethodVersion });

function clock() {
  let t = 0;
  return () => new Date(Date.UTC(2031, 0, 1) + t++ * 1000).toISOString(); // her çağrıda ilerler → evaluatedAt hep GELİŞ sırası
}

const run = (world: World, over: Partial<Parameters<typeof runRaceEvaluations>[0]> = {}) =>
  runRaceEvaluations({ identity: identity(), source: world.source, root, log: quiet, now: clock(), asOf: new Date(BASE_MS).toISOString(), ...over });

// ── Bağımsız kaba kuvvet referansı: aggregate/ring kodunu PAYLAŞMAZ ─────────────────────────────────────────────────
interface Ref { id: string; startMs: number; ll: number; top1: boolean; top3: boolean; rank: number; p: number; bmP: boolean; bmR: boolean; segment: string }
function bruteRefs(world: World): Ref[] {
  const out: Ref[] = [];
  for (const [id, d] of world.defs) {
    if (!d.winners) continue;
    const probs = world.probsFor(Number(id.slice(5)));
    const sorted = Object.entries(probs).map(([no, p]) => ({ no: Number(no), p })).sort((a, b) => (b.p !== a.p ? b.p - a.p : a.no - b.no));
    const primary = d.winners[0];
    const idx = sorted.findIndex((e) => e.no === primary);
    const p = sorted[idx].p;
    const rank = idx + 1;
    const nrp = (rank - 1) / (sorted.length - 1);
    out.push({
      id, startMs: d.startMs, ll: -Math.log(Math.max(p, 1e-12)), top1: d.winners.includes(sorted[0].no), top3: sorted.slice(0, 3).some((e) => d.winners!.includes(e.no)),
      rank, p, bmP: p < 0.05, bmR: nrp > 0.7, segment: d.segment,
    });
  }
  out.sort((a, b) => (a.startMs !== b.startMs ? a.startMs - b.startMs : a.id < b.id ? -1 : 1));
  return out;
}
function expectWindow(actual: ModelOpsWindowStats, refs: Ref[]) {
  expect(actual.n).toBe(refs.length);
  expect(actual.top1).toBe(refs.filter((r) => r.top1).length);
  expect(actual.top3).toBe(refs.filter((r) => r.top3).length);
  expect(actual.bigMissP).toBe(refs.filter((r) => r.bmP).length);
  expect(actual.bigMissRank).toBe(refs.filter((r) => r.bmR).length);
  expect(actual.sumWinnerRank).toBe(refs.reduce((a, r) => a + r.rank, 0));
  expect(actual.sumLL).toBeCloseTo(refs.reduce((a, r) => a + r.ll, 0), 9);
  expect(actual.sumWinnerProbability).toBeCloseTo(refs.reduce((a, r) => a + r.p, 0), 9);
  const seg: Record<string, number> = {};
  for (const r of refs) seg[r.segment] = (seg[r.segment] ?? 0) + 1;
  expect(actual.segmentCounts).toEqual(seg);
}
function expectMatchesBrute(res: Awaited<ReturnType<typeof run>>, world: World) {
  const refs = bruteRefs(world);
  expectWindow(res.windows.ALL, refs);
  expectWindow(res.windows.RECENT_300, refs.slice(-300));
  expectWindow(res.windows.RECENT_100, refs.slice(-100));
  expect(res.aggregate.recent.map((r) => r.raceId)).toEqual(refs.slice(-RECENT_MAX).map((r) => r.id));
}

describe("saf değerlendirme (evaluateRace)", () => {
  const base: ModelOpsRacePayload = {
    predictionId: "p1", cohortType: "LIVE", raceStartAt: "2026-09-01T12:00:00Z", predictionCreatedAt: "2026-09-01T11:00:00Z", segment: "Diger",
    resultFingerprint: "w2", winnerNos: [2], probs: { "1": 0.5, "2": 0.3, "3": 0.2 },
  };
  it("elle hesaplanmış örnek: rank/LL/winnerP/NRP/Top1/Top3", () => {
    const e = evaluateRace("r1", base, "k", "2031-01-01T00:00:00.000Z");
    expect(e.winnerRank).toBe(2);
    expect(e.winnerProbability).toBe(0.3);
    expect(e.winnerLL).toBeCloseTo(-Math.log(0.3), 12);
    expect(e.winnerNrp).toBe(0.5);
    expect(e.hitTop1).toBe(false);
    expect(e.hitTop3).toBe(true);
    expect(e.bigMissP).toBe(false);
    expect(e.bigMissRank).toBe(false);
    expect(e.status).toBe("EVALUATED");
  });
  it("BigMiss: p<%5 ve NRP>0.70", () => {
    const probs: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) probs[String(i)] = i === 9 ? 0.02 : i === 10 ? 0.01 : 0.97 / 8;
    const e = evaluateRace("r1", { ...base, winnerNos: [9], probs }, "k", "t");
    expect(e.winnerRank).toBe(9);
    expect(e.bigMissP).toBe(true);
    expect(e.bigMissRank).toBe(true); // (9-1)/(10-1)=0.889
  });
  it("dead heat: birincil ilk numara, isabet herhangi bir kazananla", () => {
    const e = evaluateRace("r1", { ...base, winnerNos: [3, 1] }, "k", "t");
    expect(e.winnerProbability).toBe(0.2); // birincil = 3
    expect(e.winnerRank).toBe(3);
    expect(e.hitTop1).toBe(true); // 1 numaralı at da kazanan → lider isabet
  });
  it("gitCommit/predictionCreatedAt PROVENANCE olarak kayıtta", () => {
    const e = evaluateRace("r1", { ...base, gitCommit: "deadbee" }, "k", "t");
    expect(e.gitCommit).toBe("deadbee");
    expect(e.predictionCreatedAt).toBe("2026-09-01T11:00:00.000Z");
  });
});

describe("model kimliği", () => {
  it("eksik/boş alan sessizce kabul edilmez", () => {
    expect(() => normalizeModelIdentity({ ...modelId(), calibrationVersion: "" })).toThrow(/calibrationVersion/);
    expect(() => normalizeModelIdentity({ ...modelId(), cohortStartAt: "yarın" })).toThrow(/cohortStartAt/);
  });
  it("cohortStartAt kanonikleşir; aynı an farklı yazım → aynı anahtar; farklı an → farklı anahtar", () => {
    expect(modelIdentityKey(modelId({ cohortStartAt: "2026-09-01" }))).toBe(modelIdentityKey(modelId({ cohortStartAt: "2026-09-01T00:00:00Z" })));
    expect(modelIdentityKey(modelId({ cohortStartAt: "2026-09-02" }))).not.toBe(modelIdentityKey(modelId()));
  });
  it("kimliğin HER alanı artifact anahtarını değiştirir; LIVE/REPLAY ayrı dizin", () => {
    const base = modelIdentityKey(modelId());
    for (const over of [
      { engineVersion: "V5.47" }, { featureSchemaVersion: "feat-v2" }, { dataPipelineVersion: "pipe-v2" }, { calibrationVersion: "cal-v2" },
      { postProcessVersion: "post-v2" }, { trainingSnapshotId: "train-x" }, { modelRole: "CHALLENGER" as const }, { cohortType: "REPLAY" as const },
    ]) expect(modelIdentityKey(modelId(over))).not.toBe(base);
    const live = modelOpsArtifactIdentity({ model: modelId(), evaluationMethodVersion: "e" });
    const replay = modelOpsArtifactIdentity({ model: modelId({ cohortType: "REPLAY" }), evaluationMethodVersion: "e" });
    expect(live.cohortType).toBe("LIVE");
    expect(replay.cohortType).toBe("REPLAY");
    expect(live.componentId).not.toBe(replay.componentId);
  });
});

describe("artımlı işletim (Registry üzerinde)", () => {
  it("1) 300 yarış ilk kez işlenir; pencereler kaba kuvvetle birebir", async () => {
    const w = makeWorld(300);
    const r = await run(w);
    expect(r.job.status).toBe("COMPLETE");
    expect(r.job.stats.processed).toBe(300);
    expect(w.loads.length).toBe(300);
    expect(r.windows.ALL.n).toBe(300);
    expect(r.windows.RECENT_300.n).toBe(300);
    expect(r.windows.RECENT_100.n).toBe(100);
    expectMatchesBrute(r, w);
  });

  it("2) yeni yarış gelince YALNIZ 1 yeni evaluation; 3) aynı fingerprint tekrar → 0 iş", async () => {
    const w = makeWorld(300);
    await run(w);
    w.loads.length = 0;
    w.addRace(300);
    const r2 = await run(w);
    expect(r2.job.plan.newWork).toBe(1);
    expect(r2.job.stats.processed).toBe(1);
    expect(w.loads).toEqual([rid(300)]);
    expect(r2.windows.ALL.n).toBe(301);
    expectMatchesBrute(r2, w);

    w.loads.length = 0;
    const r3 = await run(w);
    expect(w.loads).toEqual([]);
    expect(r3.job.stats.processed).toBe(0);
    expect(r3.job.plan.newWork + r3.job.plan.reprocess).toBe(0);
    expectMatchesBrute(r3, w);
  });

  it("4) sonucu olmayan yarış PENDING_RESULT (hata değil, deneme tüketmez); 5) sonuç gelince YALNIZ o yarış", async () => {
    const w = makeWorld(20);
    w.defs.get(rid(7))!.winners = null;
    let r = await run(w);
    for (let i = 0; i < 5; i++) r = await run(w); // 5 kez daha: deneme hakkı tükenmemeli
    expect(r.pendingRaceIds).toEqual([rid(7)]);
    expect(r.job.manifest.failedItems).toEqual({});
    expect(r.windows.ALL.n).toBe(19);
    expect(raceLifecycle(rid(7), readEvaluationHistory(r.artifactDir)).state).toBe("PENDING_RESULT");
    expect(w.loads.includes(rid(7))).toBe(false); // sonuç listede yoksa yükleme bile yapılmaz

    w.defs.get(rid(7))!.winners = [4];
    w.loads.length = 0;
    const done = await run(w);
    expect(w.loads).toEqual([rid(7)]);
    expect(done.pendingRaceIds).toEqual([]);
    expect(done.windows.ALL.n).toBe(20);
    expect(raceLifecycle(rid(7), readEvaluationHistory(done.artifactDir)).state).toBe("EVALUATED");
    expectMatchesBrute(done, w);
  });

  it("6) fingerprint değişirse eski SUPERSEDED, yeni sürüm aktif; eski kayıt dosyada KORUNUR; 7) aggregate çift saymaz", async () => {
    const w = makeWorld(350);
    const first = await run(w);
    const oldRec = first.evaluations.get(rid(340))!;

    w.defs.get(rid(340))!.winners = [1, 2]; // sonuç düzeltmesi (dead heat oldu)
    w.loads.length = 0;
    const r = await run(w);
    expect(r.job.plan.reprocess).toBe(1);
    expect(w.loads).toEqual([rid(340)]);

    const hist = readEvaluationHistory(r.artifactDir).get(rid(340))!;
    expect(hist.length).toBe(2);
    expect(hist[0].status).toBe("SUPERSEDED");
    expect(hist[0].supersededByVersion).toBe(2);
    expect(hist[0].record).toEqual(oldRec); // eski değerlendirme AYNEN duruyor
    expect(hist[1].status).toBe("EVALUATED");
    expect(hist[1].record.resultFingerprint).toBe("w1+2");
    expect(r.evaluations.get(rid(340))!.resultFingerprint).toBe("w1+2"); // aktif = yeni sürüm
    // yalnız düzeltilen yarışın geçmişi 2 sürümlü, diğerleri 1
    const all = readEvaluationHistory(r.artifactDir);
    expect([...all.values()].filter((v) => v.length > 1).length).toBe(1);

    expect(r.windows.ALL.n).toBe(350); // çift sayım YOK
    expectMatchesBrute(r, w); // toplamlar yeni (düzeltilmiş) sonuçla birebir
  });

  it("8) geç gelen eski yarış evaluatedAt'e göre DEĞİL raceStartAt konumuna girer", async () => {
    const w = makeWorld(350);
    w.defs.get(rid(340))!.winners = null;
    w.defs.get(rid(20))!.winners = null;
    const shared = clock(); // iki çalıştırma TEK saati paylaşır → geç gelenin evaluatedAt'i kesin en büyük
    const first = await run(w, { now: shared });
    expect(first.windows.ALL.n).toBe(348);

    w.defs.get(rid(340))!.winners = [2];
    w.defs.get(rid(20))!.winners = [3];
    w.loads.length = 0;
    const r = await run(w, { now: shared });
    expect(w.loads.sort()).toEqual([rid(20), rid(340)]);
    const ids = r.aggregate.recent.map((x) => x.raceId);
    expect(ids[ids.length - 1]).toBe(rid(349)); // son = en geç yarış, en geç değerlendirilen DEĞİL
    expect(ids.indexOf(rid(340))).toBe(ids.indexOf(rid(339)) + 1);
    expect(ids.includes(rid(20))).toBe(false); // halkadaki en eskiden de eski → yalnız ALL'a
    expect(r.windows.ALL.n).toBe(350);
    expect(r.evaluations.get(rid(340))!.evaluatedAt > r.evaluations.get(rid(349))!.evaluatedAt).toBe(true);
    expectMatchesBrute(r, w);
  });

  it("9) aynı raceStartAt'te raceId deterministik tie-break (geliş sırasından bağımsız)", async () => {
    const w = makeWorld(0);
    const order = [7, 2, 9, 0, 5, 3, 8, 1, 6, 4];
    for (const k of order) w.addRace(k, { startMs: BASE_MS, predAtMs: BASE_MS - 3_600_000 });
    const r1 = await run(w, { maxItemsThisRun: 4 }); // ilk parti geliş sırasına göre
    expect(r1.job.status).toBe("PAUSED");
    const r2 = await run(w);
    const ids = r2.aggregate.recent.map((x) => x.raceId);
    expect(ids).toEqual(order.slice().sort((a, b) => a - b).map(rid));
    expectMatchesBrute(r2, w);
  });

  it("9b) sıra raceId'ye değil yarış ZAMANINA bağlı: id sırası zaman sırasının TERSİ olan dünyada da kaba kuvvetle birebir", async () => {
    const n = 330;
    const w = makeWorld(0);
    for (let k = 0; k < n; k++) w.addRace(k, { startMs: BASE_MS + (n - k) * 600_000, predAtMs: BASE_MS + (n - k) * 600_000 - 3_600_000 }); // büyük id = erken yarış
    w.defs.get(rid(5))!.winners = null; // geç gelen: zaman olarak EN GEÇ yarışlardan biri
    w.defs.get(rid(300))!.winners = null; // zaman olarak erken
    await run(w, { maxItemsThisRun: 100 });
    await run(w);
    w.defs.get(rid(5))!.winners = [3];
    w.defs.get(rid(300))!.winners = [6];
    const r = await run(w);
    expectMatchesBrute(r, w);
    const ids = r.aggregate.recent.map((x) => x.raceId);
    expect(ids[ids.length - 1]).toBe(rid(0)); // en geç başlayan = id 0 (k küçük → startMs büyük)
    expect(ids).not.toEqual([...ids].sort()); // id sırasına göre DEĞİL
  });

  it("10) karışık veri (segment, dead heat, düzeltme, geç sonuç) R100/R300/ALL kaba kuvvetle birebir", async () => {
    const w = makeWorld(420);
    for (const k of [11, 200, 333, 400]) w.defs.get(rid(k))!.winners = null;
    for (const k of [15, 250, 380]) w.defs.get(rid(k))!.winners = [(k % 8) + 1, ((k + 3) % 8) + 1];
    await run(w, { maxItemsThisRun: 150 });
    await run(w, { maxItemsThisRun: 150 });
    await run(w);
    for (const k of [11, 200, 333]) w.defs.get(rid(k))!.winners = [((k + 5) % 8) + 1];
    w.defs.get(rid(250))!.winners = [8];
    const r = await run(w);
    expectMatchesBrute(r, w);
    expect(r.pendingRaceIds).toEqual([rid(400)]);
  });

  it("11) LIVE ve REPLAY karışmaz: descriptor cohort uyuşmazlığı ADAPTER_CONTRACT_VIOLATION, payload uyuşmazlığı item hatası, aggregate çapraz kabul etmez, dizinler ayrı", async () => {
    // (a) payload düzeyi savunma: descriptor LIVE der ama yükleme REPLAY döner → item fail-closed
    const wp = makeWorld(10);
    wp.defs.get(rid(3))!.payloadCohort = "REPLAY";
    const p = await run(wp, { root: path.join(root, "payload") });
    expect(p.job.stats.failed).toBe(1);
    expect(Object.keys(p.job.manifest.failedItems)).toEqual([rid(3)]);
    expect(p.windows.ALL.n).toBe(9);

    // (b) descriptor düzeyi: REPLAY yarış LIVE artifact'ına listelenirse sözleşme ihlali (işlenmez, sessizce atlanmaz)
    const w = makeWorld(10);
    w.defs.get(rid(3))!.cohort = "REPLAY";
    const live = await run(w);
    expect(live.contractViolations).toHaveLength(1);
    expect(live.contractViolations[0].problems.join(" ")).toMatch(/LIVE ve REPLAY karışamaz/);
    expect(w.loads.includes(rid(3))).toBe(false);
    expect(live.windows.ALL.n).toBe(9);
    expect(live.windows.cohortType).toBe("LIVE");
    expect(live.evaluations.has(rid(3))).toBe(false); // uyuşmayan kayıt HİÇ saklanmadı (yalnız aggregate'ten değil, kalıcı kayıttan da dışarıda)
    expect(readEvaluationHistory(live.artifactDir).has(rid(3))).toBe(false);

    // aggregate doğrudan: REPLAY kaydı LIVE aggregate'e eklenemez, tersi de
    const spec = modelOpsAggregateSpec("LIVE");
    const rec = live.evaluations.values().next().value as RaceEvaluationRecord;
    expect(() => spec.add(spec.init(), "x", { ...rec, cohortType: "REPLAY" })).toThrow(/LIVE ve REPLAY karışamaz/);
    expect(() => modelOpsAggregateSpec("REPLAY").add(modelOpsAggregateSpec("REPLAY").init(), "x", rec)).toThrow(/LIVE ve REPLAY karışamaz/);

    // aynı dünyayı REPLAY artifact'ı olarak koştur: ayrı dizin, ayrı aggregate
    const w2 = makeWorld(10);
    for (const d of w2.defs.values()) d.cohort = "REPLAY";
    const replay = await run(w2, { identity: identity({ cohortType: "REPLAY" }) });
    expect(replay.artifactDir).not.toBe(live.artifactDir);
    expect(replay.windows.cohortType).toBe("REPLAY");
    expect(replay.windows.ALL.n).toBe(10);
    expect(live.windows.ALL.n).toBe(9); // REPLAY koşusu LIVE'ı etkilemedi
  });

  it("11b) LIVE uygunluğu: cohort öncesi ve yarıştan sonra üretilen tahmin EXCLUDED (terminal, hata değil, aggregate dışı, yeniden denenmez)", async () => {
    const w = makeWorld(10);
    w.defs.get(rid(2))!.predAtMs = Date.parse(COHORT_START) - 1000; // cohort başlamadan önce
    w.defs.get(rid(4))!.predAtMs = w.defs.get(rid(4))!.startMs + 1000; // yarış başladıktan sonra
    w.defs.get(rid(6))!.predAtMs = w.defs.get(rid(6))!.startMs; // TAM yarış başlangıcı: >= → post-start
    const r = await run(w);
    expect(r.job.stats.failed).toBe(0); // job FAILURE değil
    expect(r.job.manifest.failedItems).toEqual({});
    expect(r.windows.ALL.n).toBe(7); // aggregate'e girmedi
    expect(r.evaluations.has(rid(2))).toBe(false);
    expect(r.exclusions.get(rid(2))!.status).toBe("EXCLUDED_PRE_COHORT");
    expect(r.exclusions.get(rid(4))!.status).toBe("EXCLUDED_POST_START");
    expect(r.exclusions.get(rid(6))!.status).toBe("EXCLUDED_POST_START");
    expect(r.exclusions.get(rid(4))!.reason).toMatch(/leakage/); // açıklanabilir şekilde saklanır
    const hist = readEvaluationHistory(r.artifactDir);
    expect(raceLifecycle(rid(2), hist).state).toBe("EXCLUDED_PRE_COHORT");
    expect(raceLifecycle(rid(4), hist).state).toBe("EXCLUDED_POST_START");

    w.loads.length = 0;
    const again = await run(w);
    expect(w.loads).toEqual([]); // terminal: yeniden denenmedi
    expect(again.job.stats.processed + again.job.stats.noResult).toBe(0);
    expect(again.exclusions.size).toBe(3);

    // REPLAY cohort'unda aynı tahmin zamanları dışlama nedeni DEĞİLDİR
    const w2 = makeWorld(10);
    for (const d of w2.defs.values()) { d.cohort = "REPLAY"; d.predAtMs = d.startMs + 5_000; }
    const rep = await run(w2, { identity: identity({ cohortType: "REPLAY" }) });
    expect(rep.exclusions.size).toBe(0);
    expect(rep.windows.ALL.n).toBe(10);
  });

  it("12c) davranış tanımlayıcıları dependencyHash'te: modelBehaviorHash yalnız davranış alanlarına duyarlı, cohort/git'e değil", async () => {
    const w = makeWorld(5);
    const a = await run(w);
    const deps = a.job.manifest.dependencies;
    for (const k of ["extra:featureSchemaVersion", "extra:dataPipelineVersion", "extra:calibrationVersion", "extra:postProcessVersion", "extra:modelBehaviorHash", "engineVersion", "trainingSnapshotId", "evaluationMethodVersion"]) {
      expect(deps[k], k).toBeDefined();
    }
    const h = (over: Partial<ModelIdentity>, ev = "eval-v1") => modelBehaviorHash({ model: modelId(over), evaluationMethodVersion: ev });
    expect(h({})).toBe(h({ cohortStartAt: "2026-05-05" })); // cohort davranış değildir
    expect(h({})).toBe(h({ modelRole: "CHALLENGER", cohortType: "REPLAY" }));
    for (const over of [{ engineVersion: "x" }, { featureSchemaVersion: "x" }, { dataPipelineVersion: "x" }, { calibrationVersion: "x" }, { postProcessVersion: "x" }, { trainingSnapshotId: "x" }]) expect(h(over)).not.toBe(h({}));
    expect(h({}, "eval-v2")).not.toBe(h({}));
  });

  it("12) model kimliği değişirse YENİ artifact (eski korunur, reuse yok); değerlendirme yöntemi değişirse DUR", async () => {
    const w = makeWorld(30);
    const a = await run(w);
    const manifestA = fs.readFileSync(path.join(a.artifactDir, "manifest.json"), "utf-8");

    w.loads.length = 0;
    const b = await run(w, { identity: identity({ calibrationVersion: "cal-v2" }) });
    expect(b.artifactDir).not.toBe(a.artifactDir);
    expect(b.job.plan.reason).toBe("FIRST_BUILD");
    expect(w.loads.length).toBe(30); // sessiz reuse yok
    expect(fs.readFileSync(path.join(a.artifactDir, "manifest.json"), "utf-8")).toBe(manifestA); // eski artifact dokunulmadı

    const c = await run(w, { identity: identity({ cohortStartAt: "2026-08-15T00:00:00Z" }) }); // yalnız cohortStartAt
    expect(c.artifactDir).not.toBe(a.artifactDir);
    expect(c.artifactDir).not.toBe(b.artifactDir);

    w.loads.length = 0;
    await expect(run(w, { identity: identity({}, "eval-v2") })).rejects.toBeInstanceOf(RegistryInvalidationError);
    expect(w.loads).toEqual([]); // durdu, hiçbir yarış yüklenmedi
    try { await run(w, { identity: identity({}, "eval-v2") }); } catch (e) { expect((e as RegistryInvalidationError).reasons).toContain("EVALUATION_METHOD_CHANGED"); }

    const rebuilt = await run(w, { identity: identity({}, "eval-v2"), rebuild: true });
    expect(rebuilt.job.plan.reason).toBe("EVALUATION_METHOD_CHANGED");
    expect(fs.readdirSync(a.artifactDir).some((f) => f.startsWith("items.EVALUATION_METHOD_CHANGED.") && f.endsWith(".jsonl.bak"))).toBe(true); // arşiv, silme değil
    expect(rebuilt.windows.ALL.n).toBe(30);
  });

  it("12b) gitCommit yalnız provenance: değişince cohort bölünmez, yeniden değerlendirme olmaz", async () => {
    const w = makeWorld(30);
    const a = await run(w);
    for (const d of w.defs.values()) d.gitCommit = "fffffff";
    w.loads.length = 0;
    const b = await run(w);
    expect(b.artifactDir).toBe(a.artifactDir);
    expect(w.loads).toEqual([]);
    expect(b.job.stats.processed).toBe(0);
  });

  it("13) crash/restart: tamamlanmış yarışlar tekrar hesaplanmaz, kalan yalnız devam eder", async () => {
    const w = makeWorld(100);
    let served = 0;
    const flaky: ModelOpsRaceSource = {
      listRaces: () => w.source.listRaces(),
      loadRace: async (id) => { if (served >= 40) throw new Error("connection terminated unexpectedly"); served++; return w.source.loadRace(id); },
    };
    const first = await run(w, { source: flaky, abortAfterConsecutiveFailures: 5 });
    expect(first.job.status).toBe("PAUSED");
    expect(first.windows.ALL.n).toBe(40);
    const doneIds = new Set(first.evaluations.keys());
    expect(doneIds.size).toBe(40);

    w.loads.length = 0;
    const second = await run(w); // sağlıklı kaynak
    expect(w.loads.length).toBe(60);
    expect(w.loads.some((id) => doneIds.has(id))).toBe(false); // tamamlananlar bir daha yüklenmedi/hesaplanmadı
    expect(second.job.status).toBe("COMPLETE");
    expect(second.windows.ALL.n).toBe(100);
    expectMatchesBrute(second, w);
  });
});
