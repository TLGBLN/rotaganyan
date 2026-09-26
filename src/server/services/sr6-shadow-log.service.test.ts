// SR6 Shadow Logger v1 — DB ve motor mock'lu (gerçek DB'ye dokunmaz). challenger-shadow-log
// ile AYNI pre-start-freeze desenini test eder, EK OLARAK SR6'ya özgü immutability/outcome
// sözleşmesini: repeated run → duplicate yok, post-start → hiçbir yazım yok, sonuç geldiğinde
// yalnız outcome alanları değişir, düzeltme sessizce ezmez (audit trail).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string; raceId: string; runnerNo: number; ruleVersion: string;
  agfRank: number; rawRank: number; finalRankAtPrediction: number; nonMarketRank: number;
  surpriseScore: number; supportCount: number; alreadyTop6: boolean; wouldRescueTo6: boolean; displacedRunnerNo: number | null;
  actualFinishPosition: number | null; isWinner: boolean | null; resultFingerprint: string | null; resultHistoryJson: unknown;
};

const store = vi.hoisted(() => ({
  races: [] as { id: string; time: string | null; raceDay: { date: Date }; prediction: { id: string } | null }[],
  rows: [] as Row[],
  results: {} as Record<string, { actualOrder: string[]; winnerNos: number[] }>,
  nextId: 1,
  sirali: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    race: { findMany: async () => store.races },
    sR6ShadowObservation: {
      findFirst: async (args: { where: { raceId: string; ruleVersion: string } }) =>
        store.rows.find((r) => r.raceId === args.where.raceId && r.ruleVersion === args.where.ruleVersion) ?? null,
      create: async (args: { data: Omit<Row, "id" | "actualFinishPosition" | "isWinner" | "resultFingerprint" | "resultHistoryJson"> }) => {
        const row: Row = { id: `row${store.nextId++}`, actualFinishPosition: null, isWinner: null, resultFingerprint: null, resultHistoryJson: null, ...args.data };
        store.rows.push(row);
        return row;
      },
      findMany: async (args: { where: { race: { result: { isNot: null } } } }) =>
        store.rows
          .filter((r) => store.results[r.raceId])
          .map((r) => ({ ...r, race: { result: store.results[r.raceId] } })),
      update: async (args: { where: { id: string }; data: Partial<Row> }) => {
        const row = store.rows.find((r) => r.id === args.where.id)!;
        Object.assign(row, args.data);
        return row;
      },
    },
  },
}));

const rawRunner = (no: number, teknikSira: number, opts: { agfSirasi?: number; upset?: boolean } = {}) => ({
  no,
  agfSirasi: opts.agfSirasi ?? 1,
  olasilik: 1 / (teknikSira + 1),
  teknikSira,
  katkilar: opts.upset ? [0, 0, 0.3, 0.3, 0, 0, 0.3, 0, 0, 0.3, 0, 0, 0] : new Array(13).fill(0),
  bSireKatkisi: 0,
  bZeminMesafeKatkisi: 0,
});

vi.mock("@/lib/methodology/v5-engine", () => ({
  gatherFaz1V5: async () => ({ runners: [{ no: 1 }, { no: 2 }] }),
  faz2V5Sirala: () => store.sirali,
  AGF_KATKI_INDEKSLERI: [0, 4, 7],
}));

import { runSr6ShadowLog, enrichSr6ShadowOutcomes } from "./sr6-shadow-log.service";
import { raceStartAtUtc } from "@/lib/race-start";

const DAY = new Date(Date.UTC(2026, 8, 25));
const START = new Date("2026-09-25T15:30:00.000Z"); // 18:30 TR
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);
const addRace = (id = "r1", time: string | null = "18:30", predictionId: string | null = "pred-1") =>
  store.races.push({ id, time, raceDay: { date: DAY }, prediction: predictionId ? { id: predictionId } : null });

// Bir T3-A adayı üretecek saha: agfRank=7 upset runner rank9'da, others rank1-8 upsetsiz.
function setEligibleField() {
  const upsetRunner = rawRunner(50, 9, { agfSirasi: 7, upset: true });
  const others = Array.from({ length: 8 }, (_, i) => rawRunner(i + 1, i + 1));
  store.sirali = [upsetRunner, ...others];
}
function setNoCandidateField() {
  store.sirali = [rawRunner(1, 1), rawRunner(2, 2)];
}

beforeEach(() => { store.races = []; store.rows = []; store.results = {}; store.nextId = 1; setNoCandidateField(); });

describe("raceStartAtUtc sağlaması (challenger-shadow-log ile paylaşılan yardımcı)", () => {
  it("18:30 TR → 15:30 UTC", () => expect(raceStartAtUtc(DAY, "18:30")!.toISOString()).toBe("2026-09-25T15:30:00.000Z"));
});

describe("SR6 candidate detection + immutable yazım", () => {
  it("aday yoksa satır yazılmaz (NO_CANDIDATE)", async () => {
    setNoCandidateField();
    addRace();
    const r = await runSr6ShadowLog(at(-1000), () => at(-1000));
    expect(store.rows).toEqual([]);
    expect(r).toMatchObject({ candidatesFound: 0, rowsWritten: 0 });
  });

  it("uygun aday varsa pre-start'ta satır yazılır", async () => {
    setEligibleField();
    addRace();
    const r = await runSr6ShadowLog(at(-1000), () => at(-1000));
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ raceId: "r1", runnerNo: 50, wouldRescueTo6: true, displacedRunnerNo: 6 });
    expect(r).toMatchObject({ candidatesFound: 1, rowsWritten: 1 });
  });

  it("REPEATED RUN → duplicate satır YOK (immutable, ChallengerRun'ın aksine üzerine yazılmaz)", async () => {
    setEligibleField();
    addRace();
    await runSr6ShadowLog(at(-10_000), () => at(-10_000));
    expect(store.rows).toHaveLength(1);
    const firstRow = { ...store.rows[0] };
    // ikinci koşuda motor çıktısı DEĞİŞSE bile (upsetScore farklı) satır AYNI kalmalı
    const changed = rawRunner(50, 9, { agfSirasi: 7, upset: true });
    changed.katkilar = [0, 0, 0.9, 0.9, 0, 0, 0.9, 0, 0, 0.9, 0, 0, 0];
    store.sirali = [changed, ...Array.from({ length: 8 }, (_, i) => rawRunner(i + 1, i + 1))];
    const r2 = await runSr6ShadowLog(at(-5_000), () => at(-5_000));
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toEqual(firstRow); // hiçbir alan değişmedi
    expect(r2).toMatchObject({ alreadyRecorded: 1, rowsWritten: 0 });
  });

  it("POST-START: yarış başladıysa hiçbir yazım/hesap yapılmaz", async () => {
    setEligibleField();
    addRace();
    const r = await runSr6ShadowLog(at(0), () => at(0));
    expect(store.rows).toEqual([]);
    expect(r).toMatchObject({ racesSkippedStarted: 1, rowsWritten: 0 });
  });

  it("hesap SIRASINDA yarış başlarsa yazmadan hemen önceki kontrol yazımı engeller", async () => {
    setEligibleField();
    addRace();
    const r = await runSr6ShadowLog(at(-1000), () => at(+500));
    expect(store.rows).toEqual([]);
    expect(r).toMatchObject({ candidatesFound: 1, writesSkippedStarted: 1, rowsWritten: 0 });
  });

  it("başlangıç saati bilinmiyorsa fail-open (eski davranış), yalnız sayılır", async () => {
    setEligibleField();
    addRace("rx", null);
    const r = await runSr6ShadowLog(at(3_600_000), () => at(3_600_000));
    expect(store.rows).toHaveLength(1);
    expect(r).toMatchObject({ racesStartUnknown: 1, racesSkippedStarted: 0, rowsWritten: 1 });
  });

  it("predictionId yoksa (admin henüz analiz girmemiş) null olarak kaydedilir, akış bloklanmaz", async () => {
    setEligibleField();
    addRace("r1", "18:30", null);
    const r = await runSr6ShadowLog(at(-1000), () => at(-1000));
    expect(store.rows[0].raceId).toBe("r1");
    expect((store.rows[0] as unknown as { predictionId: string | null }).predictionId).toBeNull();
    expect(r.rowsWritten).toBe(1);
  });
});

describe("enrichSr6ShadowOutcomes — YALNIZ outcome alanları değişir", () => {
  it("sonuç geldiğinde actualFinishPosition/isWinner/resultFingerprint dolar, aday-anı alanları AYNI kalır", async () => {
    setEligibleField();
    addRace();
    await runSr6ShadowLog(at(-1000), () => at(-1000));
    const beforeCandidateFields = { ...store.rows[0] };
    store.results["r1"] = { actualOrder: ["50", "1", "2", "3", "4", "5", "6", "7", "8"], winnerNos: [] };

    const r = await enrichSr6ShadowOutcomes();
    expect(r).toMatchObject({ rowsUpdated: 1, corrections: 0 });
    const row = store.rows[0];
    expect(row.actualFinishPosition).toBe(1);
    expect(row.isWinner).toBe(true);
    expect(row.resultFingerprint).toMatch(/^[0-9a-f]{64}$/);
    // aday-anı (immutable) alanlar HİÇ değişmedi:
    for (const key of ["agfRank", "rawRank", "finalRankAtPrediction", "nonMarketRank", "surpriseScore", "supportCount", "alreadyTop6", "wouldRescueTo6", "displacedRunnerNo"] as const) {
      expect(row[key]).toEqual((beforeCandidateFields as Row)[key]);
    }
  });

  it("aynı sonuç TEKRAR gelirse idempotent no-op (fingerprint aynıysa güncelleme yok)", async () => {
    setEligibleField();
    addRace();
    await runSr6ShadowLog(at(-1000), () => at(-1000));
    store.results["r1"] = { actualOrder: ["50", "1", "2", "3", "4", "5", "6", "7", "8"], winnerNos: [] };
    await enrichSr6ShadowOutcomes();
    const r2 = await enrichSr6ShadowOutcomes();
    expect(r2).toMatchObject({ rowsUpdated: 0, corrections: 0 });
  });

  it("TJK sonucu SONRADAN DÜZELTİRSE eski kanıt sessizce ezilmez — resultHistoryJson'a eklenir", async () => {
    setEligibleField();
    addRace();
    await runSr6ShadowLog(at(-1000), () => at(-1000));
    store.results["r1"] = { actualOrder: ["50", "1", "2", "3", "4", "5", "6", "7", "8"], winnerNos: [] };
    await enrichSr6ShadowOutcomes();
    const oldFingerprint = store.rows[0].resultFingerprint;

    // düzeltme: #50 artık 1. değil 2. sırada
    store.results["r1"] = { actualOrder: ["1", "50", "2", "3", "4", "5", "6", "7", "8"], winnerNos: [] };
    const r2 = await enrichSr6ShadowOutcomes();
    expect(r2).toMatchObject({ rowsUpdated: 1, corrections: 1 });
    const row = store.rows[0];
    expect(row.actualFinishPosition).toBe(2);
    expect(row.isWinner).toBe(false);
    expect(row.resultFingerprint).not.toBe(oldFingerprint);
    expect(Array.isArray(row.resultHistoryJson)).toBe(true);
    expect((row.resultHistoryJson as Array<{ previousFingerprint: string }>)[0].previousFingerprint).toBe(oldFingerprint);
  });
});
