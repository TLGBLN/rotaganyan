// Challenger değerlendirme kabul testleri — SENTETİK (DB/harness/model YOK). Her test bir kabul kriterini kanıtlar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PENDING,
  RegistryInvalidationError,
  artifactDir,
  challengerArtifactIdentity,
  challengerAggregate,
  compareRace,
  cohortWindows,
  runChallengerEvaluation,
  runChampionOutcomes,
  summarizeRace,
  windowStats,
  type ChallengerEvaluationIdentity,
  type ChampionOutcomeIdentity,
  type CohortType,
  type RaceEvaluation,
  type RacePayload,
  type RaceSource,
  type WindowStats,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "challenger-test-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const rid = (k: number) => `race-${String(k).padStart(4, "0")}`;

interface RaceDef { orderKey: string; segment: string; winner: number | null }

/** Sahte dünya: yarış tanımları + champion/challenger için ayrı kaynaklar + yükleme sayaçları. */
function makeEnv(n: number, variant = 0) {
  const defs = new Map<string, RaceDef>();
  const champLoads: string[] = [];
  const challLoads: string[] = [];
  const addRace = (k: number, winner: number | null = (k % 8) + 1) =>
    defs.set(rid(k), { orderKey: new Date(Date.UTC(2026, 7, 16) + k * 3_600_000).toISOString(), segment: k % 3 === 0 ? "Handikap" : "Diger", winner });
  for (let k = 0; k < n; k++) addRace(k);

  const probsFor = (k: number, kind: "champ" | "chall") => {
    const w = Array.from({ length: 8 }, (_, i) => 1 + ((i + k * (kind === "champ" ? 1 : 3) + (kind === "chall" ? variant : 0)) % 8));
    const s = w.reduce((a, b) => a + b, 0);
    return Object.fromEntries(w.map((x, i) => [String(i + 1), x / s]));
  };
  const source = (kind: "champ" | "chall", loads: string[]): RaceSource => ({
    listRaces: async () => [...defs.entries()].map(([raceId, d]) => ({ raceId, fingerprint: `w${d.winner ?? ""}` })),
    loadRace: async (raceId) => {
      loads.push(raceId);
      const d = defs.get(raceId)!;
      if (d.winner === null) return PENDING;
      const k = Number(raceId.slice(5));
      const p: RacePayload = { orderKey: d.orderKey, segment: d.segment, winnerNos: [d.winner], probs: probsFor(k, kind) };
      return p;
    },
  });
  return { defs, addRace, champLoads, challLoads, champSource: source("champ", champLoads), challSource: source("chall", challLoads), probsFor };
}

const champId = (cohortType: CohortType = "LIVE", over: Partial<ChampionOutcomeIdentity> = {}): ChampionOutcomeIdentity => ({
  championVersion: "V5.46", cohortType, evaluationMethodVersion: "R2-v1", dataSnapshotId: "labels-v1", ...over,
});
const chId = (cohortType: CohortType = "LIVE", over: Partial<ChallengerEvaluationIdentity> = {}): ChallengerEvaluationIdentity => ({
  artifactType: "challenger-evaluation", championVersion: "V5.46", challengerVersion: "C1-LOW-HIZ-OFF", challengerConfigHash: "cfg-aaaaaaaaaaaaaaaa",
  cohortType, evaluationMethodVersion: "R2-v1", dataSnapshotId: "labels-v1", segment: "ALL", ...over,
});

async function runBoth(env: ReturnType<typeof makeEnv>, cohort: CohortType = "LIVE", opts: { ch?: Partial<ChallengerEvaluationIdentity>; champ?: Partial<ChampionOutcomeIdentity>; maxChall?: number } = {}) {
  const champion = await runChampionOutcomes({ identity: champId(cohort, opts.champ), source: env.champSource, root, log: quiet });
  const result = await runChallengerEvaluation({ identity: chId(cohort, opts.ch), source: env.challSource, champion, root, log: quiet, maxItemsThisRun: opts.maxChall });
  return { champion, result };
}

/** Kaba kuvvet referans: tüm yarışları doğrudan hesapla, sırala, pencereleri dilimle. */
function brute(env: ReturnType<typeof makeEnv>) {
  const evs: RaceEvaluation[] = [];
  for (const [id, d] of env.defs) {
    if (d.winner === null) continue;
    const k = Number(id.slice(5));
    const champ = { raceId: id, orderKey: d.orderKey, segment: d.segment, winnerNos: [d.winner], ...summarizeRace(env.probsFor(k, "champ"), [d.winner]) };
    evs.push(compareRace(champ, summarizeRace(env.probsFor(k, "chall"), [d.winner])));
  }
  evs.sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.raceId < b.raceId ? -1 : 1));
  // Pencereler tüm sıralı listeyi DİLİMLEYİP toplamları AYRI bir döngüyle hesaplar — aggregate/ring kodunu PAYLAŞMAZ.
  const ref = (size: number | null): WindowStats => {
    const slice = size === null ? evs : evs.slice(-size);
    const t: WindowStats = {
      window: "ALL", n: slice.length, sumDeltaLL: 0, championTop1: 0, challengerTop1: 0, championTop3: 0, challengerTop3: 0, leaderFlipCount: 0,
      sumWinnerRankDelta: 0, segmentCounts: {}, meanDeltaLL: null, meanWinnerRankDelta: null, championTop1Rate: null, challengerTop1Rate: null,
      championTop3Rate: null, challengerTop3Rate: null,
    };
    for (const e of slice) {
      t.sumDeltaLL += e.deltaLL; t.sumWinnerRankDelta += e.winnerRankDelta;
      t.championTop1 += +e.championTop1Hit; t.challengerTop1 += +e.challengerTop1Hit;
      t.championTop3 += +e.championTop3Hit; t.challengerTop3 += +e.challengerTop3Hit;
      t.leaderFlipCount += +e.leaderFlip;
      t.segmentCounts[e.segment] = (t.segmentCounts[e.segment] ?? 0) + 1;
    }
    return t;
  };
  return { evs, windows: { ALL: ref(null), RECENT_100: ref(100), RECENT_300: ref(300) } };
}
function expectStatsClose(a: WindowStats, b: WindowStats) {
  expect(a.n).toBe(b.n);
  expect(a.sumDeltaLL).toBeCloseTo(b.sumDeltaLL, 9);
  expect(a.championTop1).toBe(b.championTop1);
  expect(a.challengerTop1).toBe(b.challengerTop1);
  expect(a.championTop3).toBe(b.championTop3);
  expect(a.challengerTop3).toBe(b.challengerTop3);
  expect(a.leaderFlipCount).toBe(b.leaderFlipCount);
  expect(a.sumWinnerRankDelta).toBe(b.sumWinnerRankDelta);
  expect(a.segmentCounts).toEqual(b.segmentCounts);
}

describe("artımlı akış — bir yarış bir kez işlenir", () => {
  it("100 eski LIVE yarış BİR kez işlenir; aynı değerlendirme yeniden çağrılınca 0 yeni iş", async () => {
    const env = makeEnv(100);
    const a = await runBoth(env);
    expect(a.result.windows.ALL.n).toBe(100);
    expect(env.champLoads).toHaveLength(100);
    expect(env.challLoads).toHaveLength(100);
    env.champLoads.length = 0; env.challLoads.length = 0;
    const b = await runBoth(env);
    expect(env.champLoads).toHaveLength(0); // <<< champion tekrar hesaplanmadı
    expect(env.challLoads).toHaveLength(0); // <<< challenger tekrar hesaplanmadı
    expect(b.result.job.plan.alreadyProcessed).toBe(100);
    expect(b.result.windows.ALL.n).toBe(100);
  });

  it("yeni LIVE yarış gelince YALNIZ 1 yeni iş (champion 1 + challenger 1); sonra aynı yarış tekrar → 0", async () => {
    const env = makeEnv(100);
    await runBoth(env);
    env.champLoads.length = 0; env.challLoads.length = 0;
    env.addRace(100);
    const r = await runBoth(env);
    expect(env.champLoads).toEqual([rid(100)]);
    expect(env.challLoads).toEqual([rid(100)]);
    expect(r.result.windows.ALL.n).toBe(101);
    env.champLoads.length = 0; env.challLoads.length = 0;
    await runBoth(env);
    expect(env.champLoads).toHaveLength(0);
    expect(env.challLoads).toHaveLength(0);
  });

  it("yarıda kalan (crash/bütçe) challenger işi kaldığı item'dan devam eder; her yarış tek kez", async () => {
    const env = makeEnv(100);
    const champion = await runChampionOutcomes({ identity: champId(), source: env.champSource, root, log: quiet });
    const p1 = await runChallengerEvaluation({ identity: chId(), source: env.challSource, champion, root, log: quiet, maxItemsThisRun: 40 });
    expect(p1.job.status).toBe("PAUSED");
    expect(p1.windows.ALL.n).toBe(40);
    const p2 = await runChallengerEvaluation({ identity: chId(), source: env.challSource, champion, root, log: quiet });
    expect(p2.job.status).toBe("COMPLETE");
    expect(p2.windows.ALL.n).toBe(100);
    expect(env.challLoads).toHaveLength(100); // 40 + 60, hiç tekrar yok
    expect(new Set(env.challLoads).size).toBe(100);
  });
});

describe("PENDING_RESULT — sonuç henüz yok ≠ başarısız", () => {
  it("sonuçsuz yarış PENDING (hata/deneme tüketmez); defalarca denense de vazgeçilmez; sonuç gelince YALNIZ o yarış işlenir", async () => {
    const env = makeEnv(100);
    env.defs.get(rid(50))!.winner = null;
    const first = await runBoth(env);
    expect(first.result.windows.ALL.n).toBe(99);
    expect(first.result.job.pendingItems).toEqual([rid(50)]);
    expect(first.result.job.stats.failed).toBe(0);

    for (let i = 0; i < 6; i++) await runBoth(env); // maxAttempts(3)'ten çok fazla deneme
    const r = await runBoth(env);
    expect(r.result.job.manifest.failedItems).toEqual({});
    expect(r.result.job.plan.givenUp).toBe(0);
    expect(r.result.windows.ALL.n).toBe(99);

    env.champLoads.length = 0; env.challLoads.length = 0;
    env.defs.get(rid(50))!.winner = 3; // sonuç geldi
    const done = await runBoth(env);
    expect(done.result.windows.ALL.n).toBe(100);
    expect(env.champLoads).toEqual([rid(50)]); // yalnız o yarış
    expect(env.challLoads).toEqual([rid(50)]);
  });

  it("champion çıktısı olmayan yarış challenger'da da PENDING (retryable)", async () => {
    const env = makeEnv(10);
    env.defs.get(rid(4))!.winner = null;
    const r = await runBoth(env);
    expect(r.result.job.stats.pending).toBe(1);
    expect(r.champion.job.pendingItems).toEqual([rid(4)]);
  });
});

describe("LIVE ≠ REPLAY", () => {
  it("aynı raceId'ler LIVE ve REPLAY'de AYRI artifact/aggregate; biri diğerini etkilemez", async () => {
    const live = makeEnv(30, 0);
    const replay = makeEnv(30, 5); // farklı challenger çıktısı
    const l = await runBoth(live, "LIVE");
    const rp = await runBoth(replay, "REPLAY");
    expect(l.result.windows.cohortType).toBe("LIVE");
    expect(rp.result.windows.cohortType).toBe("REPLAY");
    expect(l.result.windows.ALL.sumDeltaLL).not.toBeCloseTo(rp.result.windows.ALL.sumDeltaLL, 6); // farklı sonuçlar birleşmedi
    expect(artifactDir(root, challengerArtifactIdentity(chId("LIVE")))).not.toBe(artifactDir(root, challengerArtifactIdentity(chId("REPLAY"))));

    // LIVE'a yeni yarış → REPLAY artifact'ı DEĞİŞMEZ
    const replayItems = fs.readFileSync(path.join(artifactDir(root, challengerArtifactIdentity(chId("REPLAY"))), "items.jsonl"), "utf-8");
    live.addRace(30);
    await runBoth(live, "LIVE");
    expect(fs.readFileSync(path.join(artifactDir(root, challengerArtifactIdentity(chId("REPLAY"))), "items.jsonl"), "utf-8")).toBe(replayItems);
  });

  it("challenger LIVE iken REPLAY champion outcome'ları verilirse HATA (cohort karışamaz)", async () => {
    const env = makeEnv(5);
    const replayChampion = await runChampionOutcomes({ identity: champId("REPLAY"), source: env.champSource, root, log: quiet });
    await expect(runChallengerEvaluation({ identity: chId("LIVE"), source: env.challSource, champion: replayChampion, root, log: quiet })).rejects.toThrow(/LIVE ve REPLAY karışamaz/);
  });
});

describe("kimlik değişimi: eski artifact otomatik reuse edilmez", () => {
  it("challenger config hash değişirse YENİ artifact (baştan), eski artifact KORUNUR ve reuse edilmez", async () => {
    const env = makeEnv(40);
    await runBoth(env);
    env.challLoads.length = 0;
    const b = await runBoth(env, "LIVE", { ch: { challengerConfigHash: "cfg-bbbbbbbbbbbbbbbb" } });
    expect(env.challLoads).toHaveLength(40); // yeni config: hepsi yeniden değerlendirildi
    expect(b.result.job.plan.reason).toBe("FIRST_BUILD");
    // eski artifact yerinde ve tam
    const old = await runChallengerEvaluation({ identity: chId(), source: env.challSource, champion: b.champion, root, log: quiet, dryRun: true });
    expect(old.job.plan.alreadyProcessed).toBe(40);
  });

  it("champion sürümü değişirse hem champion outcome'ları hem challenger artifact'ı YENİDEN üretilir; eskiler reuse edilmez", async () => {
    const env = makeEnv(25);
    await runBoth(env);
    env.champLoads.length = 0; env.challLoads.length = 0;
    await runBoth(env, "LIVE", { champ: { championVersion: "V5.47" }, ch: { championVersion: "V5.47" } });
    expect(env.champLoads).toHaveLength(25);
    expect(env.challLoads).toHaveLength(25);
  });

  it("evaluationMethodVersion / dataSnapshotId değişirse (aynı artifact) DUR — sessiz reuse ve sessiz rebuild yok", async () => {
    const env = makeEnv(10);
    await runBoth(env);
    let err: unknown;
    try { await runBoth(env, "LIVE", { champ: { evaluationMethodVersion: "R2-v2" } }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(RegistryInvalidationError);
    expect((err as RegistryInvalidationError).reasons).toEqual(["EVALUATION_METHOD_CHANGED"]);
    try { await runBoth(env, "LIVE", { champ: { dataSnapshotId: "labels-v2" } }); } catch (e) { err = e; }
    expect((err as RegistryInvalidationError).reasons).toEqual(["DATA_SNAPSHOT_CHANGED"]);
  });
});

describe("champion bir kez hesaplanır ve paylaşılır", () => {
  it("iki challenger aynı champion outcome artifact'ını kullanır: champion yüklemesi 2N değil N", async () => {
    const env = makeEnv(60);
    await runBoth(env);
    await runBoth(env, "LIVE", { ch: { challengerVersion: "C2-OTHER", challengerConfigHash: "cfg-cccccccccccccccc" } });
    expect(env.champLoads).toHaveLength(60);
    expect(env.challLoads).toHaveLength(120); // her challenger kendi 60'ını
  });
});

describe("bozulma", () => {
  it("challenger artifact'ında sessiz değer değişikliği → DATA_CORRUPTION ile DURUR", async () => {
    const env = makeEnv(20);
    const { champion } = await runBoth(env);
    const f = path.join(artifactDir(root, challengerArtifactIdentity(chId())), "items.jsonl");
    fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace(/"deltaLL":/, '"deltaLL":9'));
    await expect(runChallengerEvaluation({ identity: chId(), source: env.challSource, champion, root, log: quiet })).rejects.toMatchObject({ reasons: ["DATA_CORRUPTION"] });
  });
});

describe("aggregate ve pencereler", () => {
  it("350 yarış + gecikmeli gelen ESKİ sonuçlar: ALL / RECENT-100 / RECENT-300 kaba kuvvet referansla BİREBİR aynı", async () => {
    const env = makeEnv(350);
    for (let k = 0; k < 350; k += 7) env.defs.get(rid(k))!.winner = null; // her 7'nci yarışın sonucu henüz yok (bunlar SONRA, eski yarışlar olarak gelir)
    await runBoth(env);
    for (let k = 0; k < 350; k += 7) env.defs.get(rid(k))!.winner = (k % 8) + 1; // gecikmeli sonuçlar
    const r = await runBoth(env);
    const ref = brute(env);
    expect(r.result.windows.ALL.n).toBe(350);
    for (const w of ["ALL", "RECENT_100", "RECENT_300"] as const) expectStatsClose(r.result.windows[w], ref.windows[w]);
    expect(r.result.aggregate.recent.length).toBeLessThanOrEqual(300); // halka sınırlı: tüm geçmiş her seferinde reduce edilmiyor
    const keys = r.result.aggregate.recent.map((e) => e.orderKey);
    expect([...keys].sort()).toEqual(keys); // halka orderKey sırasında
  });

  it("halka doluyken gelen eski yarış yalnız ALL'a girer, RECENT'i bozmaz", () => {
    let agg = challengerAggregate.init();
    const mk = (k: number): RaceEvaluation => ({
      raceId: rid(k), orderKey: new Date(Date.UTC(2026, 0, 1) + k * 3_600_000).toISOString(), segment: "Diger", championLL: 1, challengerLL: 1, deltaLL: 0.5,
      championTop1Hit: false, challengerTop1Hit: true, championTop3Hit: true, challengerTop3Hit: true, leaderFlip: true, winnerRankChampion: 2, winnerRankChallenger: 1, winnerRankDelta: -1,
    });
    for (let k = 1000; k < 1300; k++) agg = challengerAggregate.add(agg, rid(k), mk(k)); // 300 yeni
    const firstKey = agg.recent[0].orderKey;
    agg = challengerAggregate.add(agg, rid(5), mk(5)); // çok eski
    expect(agg.all.n).toBe(301);
    expect(agg.recent).toHaveLength(300);
    expect(agg.recent[0].orderKey).toBe(firstKey);
  });

  it("sonuç düzeltmesi (fingerprint değişti): YALNIZ o yarış yeniden işlenir, aggregate doğru yeniden katlanır", async () => {
    const env = makeEnv(60);
    await runBoth(env);
    env.champLoads.length = 0; env.challLoads.length = 0;
    env.defs.get(rid(10))!.winner = 8; // label düzeltildi
    const r = await runBoth(env);
    expect(env.champLoads).toEqual([rid(10)]);
    expect(env.challLoads).toEqual([rid(10)]);
    expect(r.result.job.plan.reprocess).toBe(1);
    const ref = brute(env);
    for (const w of ["ALL", "RECENT_100", "RECENT_300"] as const) expectStatsClose(r.result.windows[w], ref.windows[w]);
  });

  it("boş cohort: ortalamalar/oranlar null (0'a bölme yok), pencereler cohortType etiketini taşır", () => {
    const w = cohortWindows("REPLAY", challengerAggregate.init());
    expect(w.cohortType).toBe("REPLAY");
    expect(w.ALL.n).toBe(0);
    expect(w.ALL.meanDeltaLL).toBeNull();
    expect(w.RECENT_100.challengerTop1Rate).toBeNull();
  });

  it("aggregate manifest'e JSON olarak yazılıp geri okunabilir (process restart sonrası aynı durum)", async () => {
    const env = makeEnv(30);
    const a = await runBoth(env);
    const b = await runBoth(env); // ikinci çalıştırma aggregate'i manifest'ten okur (0 iş)
    expectStatsClose(b.result.windows.ALL, a.result.windows.ALL);
    expectStatsClose(b.result.windows.RECENT_100, a.result.windows.RECENT_100);
  });
});

describe("saf metrik matematiği", () => {
  it("sıralama, LL, top1/top3 ve beraberlikte deterministik sıra (küçük at numarası önce)", () => {
    const s = summarizeRace({ "1": 0.1, "2": 0.4, "3": 0.4, "4": 0.1 }, [4]);
    expect(s.top1No).toBe(2); // 2 ve 3 eşit → küçük numara önce
    expect(s.top3Nos).toEqual([2, 3, 1]);
    expect(s.winnerRank).toBe(4);
    expect(s.hitTop1).toBe(false);
    expect(s.hitTop3).toBe(false);
    expect(s.winnerLL).toBeCloseTo(-Math.log(0.1), 12);
  });

  it("beraberlik (dead heat): isabet HERHANGİ bir kazanan için, LL/rank birincil (ilk) kazanan için", () => {
    const s = summarizeRace({ "1": 0.5, "2": 0.3, "3": 0.2 }, [3, 1]);
    expect(s.hitTop1).toBe(true); // 1 kazananlardan
    expect(s.winnerRank).toBe(3); // birincil = 3
    expect(s.winnerLL).toBeCloseTo(-Math.log(0.2), 12);
  });

  it("kazanan sahada yoksa rank=n+1 ve LL tavanlı; geçersiz olasılık/boş sonuç hata", () => {
    const s = summarizeRace({ "1": 0.6, "2": 0.4 }, [9]);
    expect(s.winnerRank).toBe(3);
    expect(Number.isFinite(s.winnerLL)).toBe(true);
    expect(() => summarizeRace({ "1": -0.1 }, [1])).toThrow();
    expect(() => summarizeRace({ "1": NaN }, [1])).toThrow();
    expect(() => summarizeRace({}, [1])).toThrow();
    expect(() => summarizeRace({ "1": 1 }, [])).toThrow(/PENDING/);
  });

  it("compareRace: negatif ΔLL / rank farkı = challenger daha iyi; lider değişimi", () => {
    const champ = { raceId: "r", orderKey: "k", segment: "S", winnerNos: [1], ...summarizeRace({ "1": 0.2, "2": 0.8 }, [1]) };
    const chall = summarizeRace({ "1": 0.7, "2": 0.3 }, [1]);
    const e = compareRace(champ, chall);
    expect(e.deltaLL).toBeLessThan(0);
    expect(e.winnerRankDelta).toBe(-1);
    expect(e.leaderFlip).toBe(true);
    expect(e.championTop1Hit).toBe(false);
    expect(e.challengerTop1Hit).toBe(true);
  });

  it("challenger ile champion sonucu uyuşmazsa yarış BAŞARISIZ sayılır (aggregate'e girmez)", async () => {
    const env = makeEnv(5);
    const champion = await runChampionOutcomes({ identity: champId(), source: env.champSource, root, log: quiet });
    const skew: RaceSource = { ...env.challSource, loadRace: async (id) => { const p = await env.challSource.loadRace(id); return p === PENDING || id !== rid(2) ? p : { ...p, winnerNos: [7] }; } };
    const r = await runChallengerEvaluation({ identity: chId(), source: skew, champion, root, log: quiet });
    expect(r.windows.ALL.n).toBe(4);
    expect(r.job.stats.failed).toBe(1);
    expect(r.job.manifest.failedItems[rid(2)].lastError).toMatch(/Sonuç uyuşmazlığı/);
  });
});
