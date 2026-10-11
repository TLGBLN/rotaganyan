import { describe, expect, it } from "vitest";
import {
  diffPublishedAgainstOptimizer,
  computeBuildKey,
  computeSourcePredictionsHash,
  buildSnapshotPayload,
  evidenceConfidence,
  type PublishIdentity,
  type PublishLegInput,
  type PublishedSelections,
} from "./publish-snapshot";
import type { Width } from "@/lib/methodology/kupon-auto-fill";

const WIDTHS: Width[] = ["narrow", "normal", "wide"];

function emptyByWidth(): Record<Width, Record<number, number[]>> {
  return { narrow: {}, normal: {}, wide: {} };
}

describe("diffPublishedAgainstOptimizer", () => {
  it("fark yoksa manualOverride=false, boş diff", () => {
    const optimizer = emptyByWidth();
    optimizer.narrow[1] = [3];
    optimizer.normal[1] = [3, 5];
    const published: PublishedSelections = emptyByWidth();
    published.narrow[1] = [3];
    published.normal[1] = [3, 5];

    const diff = diffPublishedAgainstOptimizer(optimizer, published, [1], WIDTHS);
    expect(diff.manualOverride).toBe(false);
    expect(diff.overrideAdded).toEqual([]);
    expect(diff.overrideRemoved).toEqual([]);
    expect(diff.entries).toEqual([]);
  });

  it("sıra farkı (aynı küme, farklı dizilim) manualOverride tetiklemez", () => {
    const optimizer = emptyByWidth();
    optimizer.wide[2] = [1, 2, 3];
    const published: PublishedSelections = emptyByWidth();
    published.wide[2] = [3, 1, 2];

    const diff = diffPublishedAgainstOptimizer(optimizer, published, [2], WIDTHS);
    expect(diff.manualOverride).toBe(false);
  });

  it("admin bir at EKLEDİYSE overrideAdded'a girer — K6 tipi senaryo (optimizer [1], published [1,2])", () => {
    const optimizer = emptyByWidth();
    optimizer.narrow[4] = [1];
    const published: PublishedSelections = emptyByWidth();
    published.narrow[4] = [1, 2];

    const diff = diffPublishedAgainstOptimizer(optimizer, published, [4], WIDTHS);
    expect(diff.manualOverride).toBe(true);
    expect(diff.overrideAdded).toEqual([2]);
    expect(diff.overrideRemoved).toEqual([]);
    expect(diff.entries).toEqual([{ raceNo: 4, width: "narrow", added: [2], removed: [] }]);
  });

  it("admin bir at ÇIKARDIYSA overrideRemoved'a girer", () => {
    const optimizer = emptyByWidth();
    optimizer.wide[1] = [1, 2, 3];
    const published: PublishedSelections = emptyByWidth();
    published.wide[1] = [1, 3];

    const diff = diffPublishedAgainstOptimizer(optimizer, published, [1], WIDTHS);
    expect(diff.manualOverride).toBe(true);
    expect(diff.overrideRemoved).toEqual([2]);
  });

  it("birden fazla ayak/genişlikte fark varsa her biri ayrı entry olarak kaydedilir", () => {
    const optimizer = emptyByWidth();
    optimizer.narrow[1] = [1];
    optimizer.normal[1] = [1, 2];
    optimizer.narrow[2] = [5];
    const published: PublishedSelections = emptyByWidth();
    published.narrow[1] = [1, 9]; // eklendi: 9
    published.normal[1] = [1, 2]; // aynı
    published.narrow[2] = []; // çıkarıldı: 5

    const diff = diffPublishedAgainstOptimizer(optimizer, published, [1, 2], WIDTHS);
    expect(diff.manualOverride).toBe(true);
    expect(diff.entries).toHaveLength(2);
    expect(diff.overrideAdded).toEqual([9]);
    expect(diff.overrideRemoved).toEqual([5]);
  });
});

describe("computeSourcePredictionsHash / computeBuildKey", () => {
  const legs: PublishLegInput[] = [
    { raceNo: 1, raceId: "r1", runners: [{ raceId: "r1", runnerNo: 1, scoreExact: 25.6, modelRank: 1, agf: 30, marketRank: 1, fundamentalRank: 2, ekuriGroup: null, scratched: false }] },
  ];

  it("aynı girdi her zaman aynı hash'i üretir (deterministik)", () => {
    const h1 = computeSourcePredictionsHash(legs);
    const h2 = computeSourcePredictionsHash(JSON.parse(JSON.stringify(legs)));
    expect(h1).toBe(h2);
  });

  it("tek bir sayısal fark bile hash'i değiştirir", () => {
    const legs2: PublishLegInput[] = JSON.parse(JSON.stringify(legs));
    legs2[0].runners[0].scoreExact = 25.7;
    expect(computeSourcePredictionsHash(legs)).not.toBe(computeSourcePredictionsHash(legs2));
  });

  it("buildKey allocator config + identity'ye bağlıdır, biri değişince hash değişir", () => {
    const allocator = { stakePerCombination: 1.25, tiers: [], optimizerSelections: emptyByWidth(), coverageProbability: { narrow: 0, normal: 0, wide: 0 }, configHash: "" };
    const id1 = { raceDay: "2026-10-11", hippodrome: "ankara", slot: 1 };
    const id2 = { raceDay: "2026-10-11", hippodrome: "ankara", slot: 2 };
    expect(computeBuildKey(allocator, id1)).not.toBe(computeBuildKey(allocator, id2));
  });
});

describe("buildSnapshotPayload", () => {
  const identity: PublishIdentity = {
    homeKuponId: "",
    raceDay: "2026-10-11",
    hippodrome: "ankara",
    hippodromeLabel: "Ankara — 2. Altılı",
    couponGroupType: "altili",
    slot: 2,
    publishedAt: "2026-10-11T12:00:00.000Z",
    rcaSnapshotVersion: 1,
  };
  const legs: PublishLegInput[] = [
    { raceNo: 5, raceId: "r5", runners: [
      { raceId: "r5", runnerNo: 1, scoreExact: 40, modelRank: 1, agf: 50, marketRank: 1, fundamentalRank: 1, ekuriGroup: null, scratched: false },
      { raceId: "r5", runnerNo: 2, scoreExact: 20, modelRank: 2, agf: 10, marketRank: 2, fundamentalRank: 3, ekuriGroup: null, scratched: false },
    ] },
  ];

  it("optimizer önerisiyle BİREBİR aynı publish → manualOverride=false, UNKNOWN'a açık kalır", () => {
    const optimizer = emptyByWidth();
    optimizer.narrow[5] = [1];
    const published: PublishedSelections = emptyByWidth();
    published.narrow[5] = [1];

    const payload = buildSnapshotPayload({
      identity, model: { engineVersion: "V5.46.1", weightsHash: null },
      legs,
      allocator: { stakePerCombination: 1.25, tiers: [], optimizerSelections: optimizer, coverageProbability: { narrow: 0.4, normal: 0, wide: 0 } },
      publishedSelections: published,
      widths: WIDTHS,
    });

    expect(payload.publish.diff.manualOverride).toBe(false);
    expect(payload.model.sourcePredictionsHash).toHaveLength(64); // sha256 hex
    expect(payload.allocator.configHash).toHaveLength(64);
  });

  it("K6-tipi senaryo: optimizer [1], published [1,2] → manualOverride=true + diff tam yakalanır", () => {
    const optimizer = emptyByWidth();
    optimizer.narrow[5] = [1];
    const published: PublishedSelections = emptyByWidth();
    published.narrow[5] = [1, 2];

    const payload = buildSnapshotPayload({
      identity, model: { engineVersion: "V5.46.1", weightsHash: null },
      legs,
      allocator: { stakePerCombination: 1.25, tiers: [], optimizerSelections: optimizer, coverageProbability: { narrow: 0.4, normal: 0, wide: 0 } },
      publishedSelections: published,
      widths: WIDTHS,
    });

    expect(payload.publish.diff.manualOverride).toBe(true);
    expect(payload.publish.diff.overrideAdded).toEqual([2]);
    expect(payload.publish.diff.entries).toEqual([{ raceNo: 5, width: "narrow", added: [2], removed: [] }]);
  });
});

describe("evidenceConfidence", () => {
  it("PUBLISH_SNAPSHOT tam güven (1), LEGACY_RECONSTRUCTED düşük güven verir", () => {
    expect(evidenceConfidence("PUBLISH_SNAPSHOT")).toBe(1);
    expect(evidenceConfidence("LEGACY_RECONSTRUCTED")).toBeLessThan(1);
    expect(evidenceConfidence("LEGACY_RECONSTRUCTED")).toBeGreaterThan(0);
  });
});
