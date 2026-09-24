// Shadow logger PRE-START FREEZE testleri — DB ve motor mock'lu (gerçek DB'ye dokunmaz).
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  races: [] as { id: string; time: string | null; raceDay: { date: Date } }[],
  rows: new Map<string, { computedAt: Date; challengerOutput: unknown }>(),
  upserts: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    race: { findMany: async () => store.races },
    challengerRun: {
      upsert: async (args: { where: { raceId_challengerKey: { raceId: string; challengerKey: string } }; create: { raceId: string; challengerKey: string; challengerOutput: unknown }; update: { computedAt: Date; challengerOutput: unknown } }) => {
        const k = `${args.where.raceId_challengerKey.raceId}|${args.where.raceId_challengerKey.challengerKey}`;
        store.upserts.push(k);
        store.rows.set(k, { computedAt: args.update.computedAt ?? new Date(), challengerOutput: args.update.challengerOutput ?? args.create.challengerOutput });
      },
    },
  },
}));

const runner = (no: number, olasilik: number) => ({ no, olasilik, probTop2: 0, probTop3: 0, teknikSira: no, karar: "x" });
vi.mock("@/lib/methodology/v5-engine", () => ({
  gatherFaz1V5: async () => ({ runners: [{ no: 1 }, { no: 2 }] }),
  faz2V5Sirala: () => [runner(1, 0.6), runner(2, 0.4)],
}));
vi.mock("@/lib/methodology/v6-challenger-registry", () => ({
  CHALLENGER_REGISTRY: [
    { key: "k1", label: "k1", scoreFn: async () => [runner(1, 0.5), runner(2, 0.5)] },
    { key: "k2", label: "k2", scoreFn: async () => [runner(1, 0.7), runner(2, 0.3)] },
  ],
}));

import { runChallengerShadowLog } from "./challenger-shadow-log.service";
import { raceStartAtUtc } from "@/lib/race-start";

const DAY = new Date(Date.UTC(2026, 8, 25)); // 25 Eyl, UTC gece yarısı
const START = new Date("2026-09-25T15:30:00.000Z"); // 18:30 TR
const addRace = (id = "r1", time: string | null = "18:30") => store.races.push({ id, time, raceDay: { date: DAY } });
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

beforeEach(() => { store.races = []; store.rows.clear(); store.upserts = []; });

describe("raceStartAtUtc (production yardımcısı)", () => {
  it("TR saati UTC+3; geçersiz/eksik/kaymış gün null (asla varsayım yok)", () => {
    expect(raceStartAtUtc(DAY, "18:30")!.toISOString()).toBe("2026-09-25T15:30:00.000Z");
    expect(raceStartAtUtc(DAY, "00:05")!.toISOString()).toBe("2026-09-24T21:05:00.000Z");
    for (const bad of [null, undefined, "", "18:60", "24:00", "6:30", "abc"]) expect(raceStartAtUtc(DAY, bad as string)).toBeNull();
    expect(raceStartAtUtc(new Date(Date.UTC(2026, 8, 25, 5)), "18:30")).toBeNull();
    expect(raceStartAtUtc(new Date(NaN), "18:30")).toBeNull();
  });
});

describe("shadow logger pre-start freeze", () => {
  it("raceStartAt − 1sn: yazım/güncelleme YAPILIR (tüm challenger anahtarları)", async () => {
    addRace();
    const r = await runChallengerShadowLog(at(-1000), () => at(-1000));
    expect(store.upserts.sort()).toEqual(["r1|k1", "r1|k2"]);
    expect(r).toMatchObject({ racesChecked: 1, racesProcessed: 1, runsWritten: 2, racesSkippedStarted: 0, upsertsSkippedStarted: 0, errors: [] });
  });

  it("raceStartAt ve sonrası: HİÇ yazım yok (RACE_ALREADY_STARTED), cron hata vermez", async () => {
    for (const off of [0, 1, 60_000, 3_600_000]) {
      store.races = []; store.upserts = [];
      addRace();
      const r = await runChallengerShadowLog(at(off), () => at(off));
      expect(store.upserts, `offset ${off}`).toEqual([]);
      expect(r).toMatchObject({ racesChecked: 1, racesProcessed: 0, runsWritten: 0, racesSkippedStarted: 1, errors: [] });
    }
  });

  it("mevcut pre-start satır, yarış başladıktan sonraki tetiklemede DEĞİŞMEZ (computedAt ve çıktı aynen)", async () => {
    addRace();
    await runChallengerShadowLog(at(-60_000), () => at(-60_000)); // pre-start yazım
    const before = JSON.stringify([...store.rows.entries()]);
    const preComputedAt = new Date(store.rows.get("r1|k1")!.computedAt).getTime();
    store.upserts = [];
    await runChallengerShadowLog(at(29_000), () => at(29_000)); // start + 29sn (gerçek DB'de görülen vaka)
    expect(store.upserts).toEqual([]);
    expect(JSON.stringify([...store.rows.entries()])).toBe(before);
    expect(new Date(store.rows.get("r1|k1")!.computedAt).getTime()).toBe(preComputedAt);
  });

  it("hesap SIRASINDA yarış başlarsa yazım atlanır (yazmadan hemen önce yeniden kontrol); önceki anahtarlar yazılmış kalır", async () => {
    addRace();
    const clock = vi.fn()
      .mockReturnValueOnce(at(-500)) // k1 yazımından önce: hâlâ pre-start
      .mockReturnValue(at(+500)); // k2'den itibaren başlamış
    const r = await runChallengerShadowLog(at(-1000), clock);
    expect(store.upserts).toEqual(["r1|k1"]);
    expect(r).toMatchObject({ runsWritten: 1, upsertsSkippedStarted: 1, racesSkippedStarted: 0, errors: [] });
  });

  it("başlangıç saati bilinmiyorsa (Race.time eksik) eski davranış korunur (fail-open) ve sayılır", async () => {
    addRace("rx", null);
    const r = await runChallengerShadowLog(at(3_600_000), () => at(3_600_000));
    expect(store.upserts.sort()).toEqual(["rx|k1", "rx|k2"]);
    expect(r).toMatchObject({ racesStartUnknown: 1, racesSkippedStarted: 0, runsWritten: 2 });
  });

  it("karışık gün: başlamış yarış atlanır, başlamamış yarış işlenir", async () => {
    addRace("past", "10:00");
    addRace("future", "23:00");
    const now = new Date("2026-09-25T12:00:00.000Z"); // 15:00 TR: 10:00 başlamış, 23:00 başlamamış
    const r = await runChallengerShadowLog(now, () => now);
    expect([...new Set(store.upserts.map((u) => u.split("|")[0]))]).toEqual(["future"]);
    expect(r).toMatchObject({ racesChecked: 2, racesProcessed: 1, racesSkippedStarted: 1 });
  });
});
