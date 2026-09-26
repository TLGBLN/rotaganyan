import { describe, expect, it } from "vitest";
import { detectSr6Candidate, SR6_RULE_VERSION, type Sr6RaceSnapshot, type Sr6RunnerSnapshot } from "./sr6-shadow";

// Feature index sırası (toFeatureVector): 0 agfSirasi,1 idmJokey,2 jokeyOrani,3 antrenorOrani,
// 4 agfPayi,5 h2hNetSkor,6 hizDerecesi,7 agfPayi²,8 zeminToleransi,9 yakinsama2Plus,
// 10 sonIdmanSprint,11 takiDegisikligi,12 yarisGidisatiSkoru. Bu testler yalnız SR6'nın
// okuduğu 5 indeksi (2,3,6,9,12) doldurur, gerisi 0.
function katkilar(overrides: Partial<Record<2 | 3 | 6 | 9 | 12, number>> = {}): number[] {
  const arr = new Array(13).fill(0);
  for (const [idx, v] of Object.entries(overrides)) arr[Number(idx)] = v;
  return arr;
}

function runner(partial: Partial<Sr6RunnerSnapshot> & { runnerNo: number }): Sr6RunnerSnapshot {
  return {
    agfRank: 1,
    olasilik: 0.1,
    finalRank: partial.runnerNo,
    katkilar: katkilar(),
    bSireKatkisi: 0,
    bZeminMesafeKatkisi: 0,
    marketBlockContribution: 0,
    ...partial,
  };
}

// T3-A'yı GERÇEKTEN karşılayan bir runner: agfRank>=5, 4 pozitif sinyal (nonMarketRank<=2
// olacak kadar yüksek nonMarketScore), maxSingleShare<=0.6 (tek sinyal domine etmesin).
function eligibleRunner(runnerNo: number, finalRank: number, extra: Partial<Sr6RunnerSnapshot> = {}): Sr6RunnerSnapshot {
  return runner({
    runnerNo,
    finalRank,
    agfRank: 7,
    katkilar: katkilar({ 2: 0.3, 3: 0.3, 6: 0.3, 9: 0.3, 12: 0 }), // 4 pozitif, eşit paylı (maxShare=0.25)
    ...extra,
  });
}

function race(runners: Sr6RunnerSnapshot[], overrides: Partial<Sr6RaceSnapshot> = {}): Sr6RaceSnapshot {
  return { raceId: "race-1", predictionId: "pred-1", raceStartAt: new Date("2026-09-27T12:00:00Z"), runners, ...overrides };
}

describe("detectSr6Candidate — T3-A frozen predicate", () => {
  it("uygun aday yok → null (NO_CANDIDATE)", () => {
    const r = [runner({ runnerNo: 1, finalRank: 1 }), runner({ runnerNo: 2, finalRank: 2, agfRank: 8 })];
    expect(detectSr6Candidate(race(r))).toBeNull();
  });

  it("aday zaten Top6 (finalRank=3) → logged ama alreadyTop6=true, wouldRescueTo6=false, displaced=null", () => {
    const r = [eligibleRunner(9, 3), ...Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 === 3 ? 99 : i + 1 }))];
    const c = detectSr6Candidate(race(r));
    expect(c).not.toBeNull();
    expect(c!.runnerNo).toBe(9);
    expect(c!.alreadyTop6).toBe(true);
    expect(c!.wouldRescueTo6).toBe(false);
    expect(c!.displacedRunnerNo).toBeNull();
  });

  it("aday rank 9 → wouldRescueTo6=true, displaced = o anki GERÇEK 6.sıradaki at", () => {
    const others = Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }));
    const r = [eligibleRunner(50, 9), ...others];
    const c = detectSr6Candidate(race(r));
    expect(c!.runnerNo).toBe(50);
    expect(c!.finalRankAtPrediction).toBe(9);
    expect(c!.alreadyTop6).toBe(false);
    expect(c!.wouldRescueTo6).toBe(true);
    expect(c!.displacedRunnerNo).toBe(6); // finalRank===6 olan runnerNo=6
  });

  it("aday tam rank 6 → sınırda no-op (alreadyTop6=true, wouldRescueTo6=false)", () => {
    const others = Array.from({ length: 5 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }));
    const r = [eligibleRunner(60, 6), ...others];
    const c = detectSr6Candidate(race(r));
    expect(c!.finalRankAtPrediction).toBe(6);
    expect(c!.alreadyTop6).toBe(true);
    expect(c!.wouldRescueTo6).toBe(false);
  });

  it("iki uygun aday → deterministic tek kazanan (en yüksek upsetScore)", () => {
    const strong = eligibleRunner(11, 10, { katkilar: katkilar({ 2: 0.5, 3: 0.5, 6: 0.5, 9: 0.5, 12: 0 }) }); // upsetScore=2.0
    const weak = eligibleRunner(12, 11); // upsetScore=1.2
    const others = Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }));
    const c = detectSr6Candidate(race([strong, weak, ...others]));
    expect(c!.runnerNo).toBe(11);
  });

  it("iki uygun aday upsetScore EŞİT → deterministic tie-break: en düşük runnerNo", () => {
    const a = eligibleRunner(20, 10);
    const b = eligibleRunner(15, 11); // aynı katkılar → aynı upsetScore
    const others = Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }));
    const c = detectSr6Candidate(race([a, b, ...others]));
    expect(c!.runnerNo).toBe(15);
  });

  it("determinism: aynı girdi → aynı çıktı (yapısal eşitlik)", () => {
    const r = [eligibleRunner(9, 9), ...Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }))];
    const snapshot = race(r);
    expect(detectSr6Candidate(snapshot)).toEqual(detectSr6Candidate(snapshot));
  });

  it("saf fonksiyon: girdi snapshot'ı MUTASYONA UĞRATILMAZ (deep-freeze ile kanıtlanır)", () => {
    const r = [eligibleRunner(9, 9), ...Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }))];
    const snapshot = race(r);
    const frozen = JSON.parse(JSON.stringify(snapshot)) as Sr6RaceSnapshot;
    Object.freeze(frozen);
    frozen.runners.forEach((x) => Object.freeze(x));
    expect(() => detectSr6Candidate(frozen)).not.toThrow();
  });

  it("ruleVersion sabit, kod dışında değişmez", () => {
    const r = [eligibleRunner(9, 9), ...Array.from({ length: 8 }, (_, i) => runner({ runnerNo: i + 1, finalRank: i + 1 }))];
    const c = detectSr6Candidate(race(r));
    expect(c!.ruleVersion).toBe(SR6_RULE_VERSION);
    expect(c!.ruleHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
