// ChallengerRun kaynak adaptörü kabul testleri — SENTETİK satırlar (DB YOK, hiçbir şey yazılmaz). Adaptör girdisini DEĞİŞTİRMEZ (dondurulmuş satırlar).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MIRROR_HIPPODROME_SLUGS,
  assertExplicitCohort,
  normalizeChallengerRuns,
  parseRunProbs,
  raceStartAtFromTurkey,
  runChallengerEvaluation,
  runChampionOutcomes,
  runRaceEvaluations,
  toChallengerEvaluationSources,
  toModelOpsSource,
  type ChallengerEvaluationIdentity,
  type ChallengerRunRow,
  type ChampionOutcomeIdentity,
  type CohortType,
  type ExplicitCohortKeys,
  type ModelOpsIdentity,
  type NormalizedSet,
  type WindowStats,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "cr-adapter-test-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const KEY = "v6-zemin-mesafe-deneyimi";
const KEYS: ExplicitCohortKeys = { live: [KEY, "v546-c1-low-hiz-off"], replay: [KEY] };
const COHORT_START = new Date("2026-08-01T00:00:00Z");
const ASOF = new Date("2026-12-31T00:00:00Z"); // tüm yarışlar geçmişte
const rid = (k: number) => `race-${String(k).padStart(4, "0")}`;

interface RowOpts { winner?: number[] | null; time?: string | null; computedAtOffsetMs?: number; champ?: unknown; chall?: unknown; slug?: string }
/** k. yarış: gün = 1 + floor(k/8), saat 12:00–19:00 (TR). */
function makeRow(k: number, o: RowOpts = {}): ChallengerRunRow {
  const day = new Date(Date.UTC(2026, 8, 1 + Math.floor(k / 8)));
  const hour = 12 + (k % 8);
  const time = o.time === undefined ? `${String(hour).padStart(2, "0")}:00` : o.time;
  const startUtc = Date.UTC(2026, 8, 1 + Math.floor(k / 8), hour - 3, 0);
  const probs = (seed: number) => {
    const w = Array.from({ length: 6 }, (_, i) => 1 + ((i * (1 + (seed % 3)) + seed * 3) % 7));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x, i) => ({ no: i + 1, olasilik: x / s, teknikSira: i + 1, karar: "x" }));
  };
  const winner = o.winner === undefined ? [(k % 6) + 1] : o.winner;
  return Object.freeze({
    id: `cr-${k}`, raceId: rid(k), challengerKey: KEY,
    computedAt: new Date(startUtc + (o.computedAtOffsetMs ?? -2 * 3_600_000)),
    championSnapshot: o.champ === undefined ? probs(k) : o.champ,
    challengerOutput: o.chall === undefined ? probs(k + 5) : o.chall,
    race: {
      raceNo: (k % 8) + 1, time, classType: k % 3 === 0 ? "Handikap" : "Şartlı 3", raceDay: { date: day, hippodrome: { slug: o.slug ?? "istanbul", name: "İstanbul" } },
      result: winner === null ? null : { winnerNo: winner[0], winnerNos: winner },
    },
  }) as ChallengerRunRow;
}
const rows = (n: number, over: (k: number) => RowOpts = () => ({})) => Array.from({ length: n }, (_, k) => makeRow(k, over(k)));
const segOf = (c: string) => (/hand/i.test(c) ? "Handikap" : "Diger");
const norm = (r: readonly ChallengerRunRow[], over: Partial<Parameters<typeof normalizeChallengerRuns>[1]> = {}): NormalizedSet =>
  normalizeChallengerRuns(r, { cohort: "LIVE", challengerKey: KEY, cohortStartAt: COHORT_START, asOf: ASOF, segmentOf: segOf, keys: KEYS, ...over });

const moIdentity = (cohort: CohortType, role: "CHAMPION" | "CHALLENGER"): ModelOpsIdentity => ({
  model: { engineVersion: role === "CHAMPION" ? "V5.46" : KEY, featureSchemaVersion: "f1", dataPipelineVersion: "d1", calibrationVersion: "c1", postProcessVersion: "p1", trainingSnapshotId: "t1", modelRole: role, cohortType: cohort, cohortStartAt: COHORT_START.toISOString() },
  evaluationMethodVersion: "e1",
});
const champId = (cohort: CohortType): ChampionOutcomeIdentity => ({ championVersion: "V5.46", cohortType: cohort, evaluationMethodVersion: "R2-v1", dataSnapshotId: `shadow-${KEY}` });
const chId = (cohort: CohortType): ChallengerEvaluationIdentity => ({ artifactType: "challenger-evaluation", championVersion: "V5.46", challengerVersion: KEY, challengerConfigHash: "cfg-shadow-runs-000000", cohortType: cohort, evaluationMethodVersion: "R2-v1", dataSnapshotId: `shadow-${KEY}`, segment: "ALL" });

async function evalPair(set: NormalizedSet, over: { root?: string } = {}) {
  const src = toChallengerEvaluationSources(set);
  const champion = await runChampionOutcomes({ identity: champId(set.cohort), source: src.champion, root: over.root ?? root, log: quiet });
  const result = await runChallengerEvaluation({ identity: chId(set.cohort), source: src.challenger, champion, root: over.root ?? root, log: quiet });
  return { champion, result, src };
}

describe("saf yardımcılar", () => {
  it("raceStartAtFromTurkey: TR saati UTC+3; gün sınırını doğru aşar; geçersiz girdi undefined", () => {
    const d = new Date(Date.UTC(2026, 8, 25));
    expect(raceStartAtFromTurkey(d, "18:30")!.toISOString()).toBe("2026-09-25T15:30:00.000Z");
    expect(raceStartAtFromTurkey(d, "00:05")!.toISOString()).toBe("2026-09-24T21:05:00.000Z");
    expect(raceStartAtFromTurkey(d, "02:59")!.toISOString()).toBe("2026-09-24T23:59:00.000Z");
    for (const bad of [null, undefined, "", "18:60", "24:00", "6:30", "18.30", "abc"]) expect(raceStartAtFromTurkey(d, bad as string), String(bad)).toBeUndefined();
    expect(raceStartAtFromTurkey(new Date(Date.UTC(2026, 8, 25, 5)), "18:30")).toBeUndefined(); // kaymış gün
    expect(raceStartAtFromTurkey(new Date(NaN), "18:30")).toBeUndefined();
  });

  it("parseRunProbs: geçerli dizi → harita; bozuk şekiller null", () => {
    expect(parseRunProbs([{ no: 1, olasilik: 0.4 }, { no: 2, olasilik: 0.6 }])).toEqual({ "1": 0.4, "2": 0.6 });
    for (const bad of [null, {}, [], [{ no: 1 }], [{ no: 1.5, olasilik: 0.1 }], [{ no: 1, olasilik: -1 }], [{ no: 1, olasilik: NaN }], [{ no: 1, olasilik: 0.1 }, { no: 1, olasilik: 0.2 }], "x", [null]]) {
      expect(parseRunProbs(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("cohort AÇIK anahtar listesinden gelir; listede olmayan anahtar için fırlatır (tarihten uydurma yok); aynı anahtar iki cohort'ta olabilir", () => {
    expect(() => assertExplicitCohort("LIVE", "bilinmeyen", KEYS)).toThrow(/AÇIKÇA tanımlı değil/);
    expect(() => assertExplicitCohort("REPLAY", "v546-c1-low-hiz-off", KEYS)).toThrow(/AÇIKÇA/);
    expect(() => assertExplicitCohort("LIVE", KEY, KEYS)).not.toThrow();
    expect(() => assertExplicitCohort("REPLAY", KEY, KEYS)).not.toThrow();
    expect(() => norm([makeRow(0)], { challengerKey: "bilinmeyen" })).toThrow(/AÇIKÇA/);
  });

  it("karma / perak-malezya aynaları kaynak filtresi sabiti olarak tanımlı", () => {
    expect([...MIRROR_HIPPODROME_SLUGS]).toEqual(["karma", "perak-malezya"]);
  });
});

describe("normalizasyon: sözleşme, ihlaller, durum", () => {
  it("raceStartAt eksik → ADAPTER_CONTRACT_VIOLATION: adaptör raporlar VE çekirdek raporlar; yarış işlenmez, sessiz skip yok", async () => {
    const r = [...rows(10), makeRow(10, { time: null }), makeRow(11, { time: "25:99" })];
    const set = norm(r);
    expect(set.descriptorViolations.map((v) => v.raceId).sort()).toEqual([rid(10), rid(11)]);
    const logs: string[] = [];
    const res = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(set, "CHAMPION"), root, log: (l) => logs.push(l), asOf: ASOF.toISOString() });
    expect(res.contractViolations.map((v) => v.raceId).sort()).toEqual([rid(10), rid(11)]);
    expect(logs.some((l) => l.includes("ADAPTER_CONTRACT_VIOLATION"))).toBe(true);
    expect(res.windows.ALL.n).toBe(10);
  });

  it("şekil ihlali (dizi olmayan snapshot) raporlanır, işlenmez, sessiz değil", () => {
    const set = norm([makeRow(0), makeRow(1, { chall: { risk: "x" } }), makeRow(2, { champ: [] })]);
    expect(set.runs).toHaveLength(1);
    expect(set.shapeViolations.map((v) => v.raceId)).toEqual([rid(1), rid(2)]);
  });

  it("raceStatus: sonuç varsa COMPLETED; yoksa SCHEDULED (gelecek) / UNKNOWN; HİÇBİR ZAMAN CANCELLED/VOID (kaynakta bilgi yok)", () => {
    const soon = new Date(Date.UTC(2026, 8, 1, 12 - 3, 0) - 3_600_000);
    const set = norm([makeRow(0, { winner: null }), makeRow(1), makeRow(9, { winner: null })], { asOf: soon });
    const by = new Map(set.runs.map((r) => [r.raceId, r.descriptor.raceStatus]));
    expect(by.get(rid(0))).toBe("SCHEDULED");
    expect(by.get(rid(1))).toBe("COMPLETED");
    const late = norm(rows(40, (k) => ({ winner: k % 4 === 0 ? null : undefined })), { asOf: ASOF });
    const statuses = new Set(late.runs.map((r) => r.descriptor.raceStatus));
    expect(statuses.has("CANCELLED" as never)).toBe(false);
    expect(statuses.has("VOID" as never)).toBe(false);
    expect([...statuses].sort()).toEqual(["COMPLETED", "UNKNOWN"]);
  });

  it("LIVE uygunluğu: tahmin cohortStartAt'tan önce veya yarıştan sonra → dışlama; REPLAY'de dışlama yok", () => {
    const r = [makeRow(0), makeRow(1, { computedAtOffsetMs: +1000 }), makeRow(2, { computedAtOffsetMs: 0 })];
    const live = norm(r);
    expect(live.runs.map((x) => x.liveExclusion)).toEqual([null, "EXCLUDED_POST_START", "EXCLUDED_POST_START"]);
    const pre = norm([makeRow(0)], { cohortStartAt: new Date("2026-12-01T00:00:00Z") });
    expect(pre.runs[0].liveExclusion).toBe("EXCLUDED_PRE_COHORT");
    const replay = norm(r, { cohort: "REPLAY" });
    expect(replay.runs.every((x) => x.liveExclusion === null)).toBe(true);
  });

  it("adaptör girdi satırlarını DEĞİŞTİRMEZ (satırlar dondurulmuş; yazma girişimi TypeError verirdi)", () => {
    const r = rows(5);
    const before = JSON.stringify(r);
    norm(r);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("Registry'ye bağlama: kritik kabul kriterleri", () => {
  it("Model Ops (champion & challenger rolleri): LIVE cohort bir kez işlenir; rerun 0 iş; 1 yeni yarış 1 iş; bekleyen PENDING (failure değil); sonuç gelince yalnız o yarış", async () => {
    const base = rows(30, (k) => ({ winner: k === 12 ? null : undefined }));
    for (const role of ["CHAMPION", "CHALLENGER"] as const) {
      const id = moIdentity("LIVE", role);
      const run = (r: readonly ChallengerRunRow[]) => runRaceEvaluations({ identity: id, source: toModelOpsSource(norm(r), role), root, log: quiet, asOf: ASOF.toISOString() });

      const first = await run(base);
      expect(first.job.stats.processed).toBe(29);
      expect(first.pendingRaceIds).toEqual([rid(12)]);
      expect(first.job.manifest.failedItems).toEqual({}); // PENDING failure değil
      for (let i = 0; i < 3; i++) expect((await run(base)).job.stats.processed).toBe(0); // rerun: 0 iş

      const withNew = [...base, makeRow(30)];
      const second = await run(withNew);
      expect(second.job.stats.processed).toBe(1); // 1 yeni ChallengerRun → 1 iş (bekleyen 12. yarış yalnız PENDING kontrolü, işlenmedi)
      expect(second.job.stats.pending).toBe(1);

      const resolved = withNew.map((x) => (x.raceId === rid(12) ? makeRow(12) : x)); // sonuç sonradan geldi
      const third = await run(resolved);
      expect(third.job.stats.processed).toBe(1); // yalnız o yarış
      expect(third.windows.ALL.n).toBe(31);
      expect(third.pendingRaceIds).toEqual([]);
    }
  });

  it("Model Ops rolleri doğru olasılık kaynağını okur: CHAMPION=championSnapshot, CHALLENGER=challengerOutput (LL toplamı ham satırlardan bağımsız hesapla eşit)", async () => {
    const data = rows(60);
    const refLL = (pick: (r: ChallengerRunRow) => unknown) => data.reduce((s, row) => {
      const w = row.race.result!.winnerNos[0];
      const p = (pick(row) as { no: number; olasilik: number }[]).find((e) => e.no === w)!.olasilik;
      return s + -Math.log(Math.max(p, 1e-12));
    }, 0);
    const champ = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(norm(data), "CHAMPION"), root, log: quiet, asOf: ASOF.toISOString() });
    const chall = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHALLENGER"), source: toModelOpsSource(norm(data), "CHALLENGER"), root, log: quiet, asOf: ASOF.toISOString() });
    expect(champ.windows.ALL.sumLL).toBeCloseTo(refLL((r) => r.championSnapshot), 9);
    expect(chall.windows.ALL.sumLL).toBeCloseTo(refLL((r) => r.challengerOutput), 9);
    expect(champ.windows.ALL.sumLL).not.toBeCloseTo(chall.windows.ALL.sumLL, 6); // sentetik veride iki taraf gerçekten farklı
  });

  it("LIVE ve REPLAY karışmaz: aynı yarışlar iki cohort'ta ayrı artifact/aggregate; cohort mismatch descriptor'ı ihlal", async () => {
    const r = rows(20);
    const live = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(norm(r), "CHAMPION"), root, log: quiet, asOf: ASOF.toISOString() });
    const replay = await runRaceEvaluations({ identity: moIdentity("REPLAY", "CHAMPION"), source: toModelOpsSource(norm(r, { cohort: "REPLAY" }), "CHAMPION"), root, log: quiet, asOf: ASOF.toISOString() });
    expect(live.artifactDir).not.toBe(replay.artifactDir);
    expect(live.windows.cohortType).toBe("LIVE");
    expect(replay.windows.cohortType).toBe("REPLAY");
    expect(live.windows.ALL.n).toBe(20);
    expect(replay.windows.ALL.n).toBe(20);
    // REPLAY descriptor'ları LIVE artifact'ına verilirse çekirdek ihlal olarak reddeder
    const cross = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(norm(r, { cohort: "REPLAY" }), "CHAMPION"), root: path.join(root, "x"), log: quiet, asOf: ASOF.toISOString() });
    expect(cross.contractViolations).toHaveLength(20);
    expect(cross.windows.ALL.n).toBe(0);
  });

  it("challenger değerlendirmesi: ilk run tüm yarışlar, rerun 0 iş, 1 yeni satır 1 iş, sonuç sonradan gelirse yalnız o yarış; bekleyen PENDING", async () => {
    const base = rows(40, (k) => ({ winner: k === 7 ? null : undefined }));
    const a = await evalPair(norm(base));
    expect(a.champion.job.stats.processed).toBe(39);
    expect(a.result.job.stats.processed).toBe(39);
    expect(a.result.job.manifest.failedItems).toEqual({});
    expect(a.result.job.pendingItems).toEqual([rid(7)]);

    const b = await evalPair(norm(base));
    expect(b.champion.job.stats.processed + b.result.job.stats.processed).toBe(0);

    const c = await evalPair(norm([...base, makeRow(40)]));
    expect(c.champion.job.stats.processed).toBe(1);
    expect(c.result.job.stats.processed).toBe(1);

    const d = await evalPair(norm([...base, makeRow(40)].map((x) => (x.raceId === rid(7) ? makeRow(7) : x))));
    expect(d.result.job.stats.processed).toBe(1);
    expect(d.result.windows.ALL.n).toBe(41);
  });

  it("challenger aggregate'leri bağımsız kaba-kuvvet referansla BİREBİR: ALL/R100/R300, ΔLL, Top1/Top3, leader flip, winner-rank delta", async () => {
    const data = rows(350, (k) => ({ winner: k % 17 === 0 ? [(k % 6) + 1, ((k + 2) % 6) + 1] : k % 41 === 0 ? null : undefined }));
    const { result } = await evalPair(norm(data));

    // referans: ham satırlardan, adaptör/aggregate kodunu paylaşmadan
    interface Ref { id: string; start: number; dLL: number; c1: boolean; h1: boolean; c3: boolean; h3: boolean; flip: boolean; drank: number; seg: string }
    const refs: Ref[] = [];
    for (const row of data) {
      if (!row.race.result) continue;
      const winners = row.race.result.winnerNos;
      const side = (snap: unknown) => {
        const arr = (snap as { no: number; olasilik: number }[]).slice().sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.no - b.no));
        const idx = arr.findIndex((e) => e.no === winners[0]);
        return { ll: -Math.log(Math.max(arr[idx].olasilik, 1e-12)), rank: idx + 1, top1: arr[0].no, hit1: winners.includes(arr[0].no), hit3: arr.slice(0, 3).some((e) => winners.includes(e.no)) };
      };
      const c = side(row.championSnapshot), h = side(row.challengerOutput);
      const start = Date.UTC(2026, 8, 1 + Math.floor(Number(row.raceId.slice(5)) / 8), 12 + (Number(row.raceId.slice(5)) % 8) - 3);
      refs.push({ id: row.raceId, start, dLL: h.ll - c.ll, c1: c.hit1, h1: h.hit1, c3: c.hit3, h3: h.hit3, flip: c.top1 !== h.top1, drank: h.rank - c.rank, seg: segOf(row.race.classType) });
    }
    refs.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.id < b.id ? -1 : 1));
    const check = (act: WindowStats, ref: Ref[]) => {
      expect(act.n).toBe(ref.length);
      expect(act.sumDeltaLL).toBeCloseTo(ref.reduce((s, r) => s + r.dLL, 0), 9);
      expect(act.championTop1).toBe(ref.filter((r) => r.c1).length);
      expect(act.challengerTop1).toBe(ref.filter((r) => r.h1).length);
      expect(act.championTop3).toBe(ref.filter((r) => r.c3).length);
      expect(act.challengerTop3).toBe(ref.filter((r) => r.h3).length);
      expect(act.leaderFlipCount).toBe(ref.filter((r) => r.flip).length);
      expect(act.sumWinnerRankDelta).toBe(ref.reduce((s, r) => s + r.drank, 0));
      const seg: Record<string, number> = {};
      for (const r of ref) seg[r.seg] = (seg[r.seg] ?? 0) + 1;
      expect(act.segmentCounts).toEqual(seg);
    };
    check(result.windows.ALL, refs);
    check(result.windows.RECENT_300, refs.slice(-300));
    check(result.windows.RECENT_100, refs.slice(-100));
    expect(result.aggregate.recent.map((e) => e.raceId)).toEqual(refs.slice(-300).map((r) => r.id));
  });

  it("LIVE-dışlanan yarış (tahmin yarış sonrası) challenger değerlendirmesine girmez ve raporlanır; Model Ops'ta terminal dışlama", async () => {
    const data = rows(20, (k) => (k === 4 ? { computedAtOffsetMs: +60_000 } : {}));
    const set = norm(data);
    const { result, src } = await evalPair(set);
    expect(src.excluded).toEqual([{ raceId: rid(4), status: "EXCLUDED_POST_START" }]);
    expect(result.windows.ALL.n).toBe(19);
    const mo = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHALLENGER"), source: toModelOpsSource(set, "CHALLENGER"), root, log: quiet, asOf: ASOF.toISOString() });
    expect(mo.exclusions.get(rid(4))!.status).toBe("EXCLUDED_POST_START");
    expect(mo.job.manifest.failedItems).toEqual({});
  });

  it("gecikmiş sonuç: iptal bilgisi yok → PENDING_STALE, asla iptal/dışlama; sonra gelirse EVALUATED", async () => {
    const data = rows(20, (k) => ({ winner: k === 9 ? null : undefined }));
    const asOf = new Date("2026-10-30T00:00:00Z"); // 9. yarıştan haftalar sonra
    const set = norm(data, { asOf });
    const r = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(set, "CHAMPION"), root, log: quiet, asOf: asOf.toISOString() });
    expect(r.pendingStaleRaceIds).toEqual([rid(9)]);
    expect(r.exclusions.size).toBe(0);
    const done = await runRaceEvaluations({ identity: moIdentity("LIVE", "CHAMPION"), source: toModelOpsSource(norm(data.map((x) => (x.raceId === rid(9) ? makeRow(9) : x)), { asOf }), "CHAMPION"), root, log: quiet, asOf: asOf.toISOString() });
    expect(done.evaluations.has(rid(9))).toBe(true);
    expect(done.pendingStaleRaceIds).toEqual([]);
  });
});
