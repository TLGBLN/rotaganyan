import { describe, expect, it } from "vitest";
import { computeAgfSignalsFromSnapshots, type AgfRunnerInput, type AgfSnapshotRow } from "./agf";

const cutoff = new Date("2026-07-16T18:00:00.000Z");

function snap(agf: number, isoDate: string): AgfSnapshotRow {
  return { agf, capturedAt: new Date(isoDate) };
}

describe("computeAgfSignalsFromSnapshots — AGF_01 (nokta-zamanlı payı+sıra)", () => {
  it("cutoff'tan ÖNCEKİ son snapshot'ı kullanır, SONRAKİNİ (yarış-sonrası/kapanış) KULLANMAZ", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T17:00:00.000Z"), snap(40, "2026-07-16T19:00:00.000Z") /* cutoff SONRASI — kapanış, KULLANILMAMALI */]],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    expect(result.raceQuality).toBe("OK");
    const a = result.runners.find((r) => r.no === 1)!;
    const agf01 = a.signals.find((s) => s.code === "AGF_01")!;
    // cutoff sonrası 40 DEĞİL, cutoff öncesi 10 kullanılmalı
    expect(agf01.rawValue).toBe(10);
    expect(agf01.observed).toBe(true);
  });

  it("eküri ortakları TOPLU paya göre AYNI sırayı paylaşır (hesaplaAgfSirasi reuse)", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: 1 },
      { id: "b", no: 2, ekuriGroup: 1 },
      { id: "c", no: 3, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(15, "2026-07-16T17:00:00.000Z")]],
      ["b", [snap(15, "2026-07-16T17:00:00.000Z")]], // eküri toplamı 30 > c'nin 25'i
      ["c", [snap(25, "2026-07-16T17:00:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    const b = result.runners.find((r) => r.no === 2)!;
    const c = result.runners.find((r) => r.no === 3)!;
    expect(a.marketRank).toBe(1);
    expect(b.marketRank).toBe(1); // eküri ortağıyla AYNI sıra
    expect(c.marketRank).toBe(2);
  });

  it("cutoff'tan önce hiç snapshot yoksa AGF_01 gözlemsiz (uydurulmaz)", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", []],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    const agf01 = a.signals.find((s) => s.code === "AGF_01")!;
    expect(agf01.observed).toBe(false);
    expect(agf01.rawValue).toBeNull();
    expect(agf01.missingReason).toMatch(/hiç AgfSnapshot/);
  });
});

describe("computeAgfSignalsFromSnapshots — veri kalitesi (şüpheli tekdüze AGF)", () => {
  it("TÜM atlarda AYNI AGF (ör. hepsi 1) — gerçek vaka: 2026-07-03 İstanbul K6 — SUSPECT_UNIFORM_AGF, observed=false", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
      { id: "c", no: 3, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(1, "2026-07-16T17:00:00.000Z")]],
      ["b", [snap(1, "2026-07-16T17:00:00.000Z")]],
      ["c", [snap(1, "2026-07-16T17:00:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    expect(result.raceQuality).toBe("SUSPECT_UNIFORM_AGF");
    for (const r of result.runners) {
      const agf01 = r.signals.find((s) => s.code === "AGF_01")!;
      expect(agf01.observed).toBe(false);
      expect(r.marketRank).toBeNull();
    }
  });

  it("GERÇEK eşitlik (yalnız İKİ at aynı, geri kalanı farklı) şüpheli SAYILMAZ", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
      { id: "c", no: 3, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T17:00:00.000Z")]],
      ["b", [snap(10, "2026-07-16T17:00:00.000Z")]],
      ["c", [snap(30, "2026-07-16T17:00:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    expect(result.raceQuality).toBe("OK");
  });
});

describe("computeAgfSignalsFromSnapshots — AGF_02 (hareket)", () => {
  it("son - ilk (ikisi de cutoff'tan ÖNCE) farkını döner", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T10:00:00.000Z"), snap(14, "2026-07-16T14:00:00.000Z"), snap(16, "2026-07-16T17:30:00.000Z")]],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    const agf02 = a.signals.find((s) => s.code === "AGF_02")!;
    expect(agf02.rawValue).toBe(6); // 16 - 10
    expect(agf02.observed).toBe(true);
  });

  it("zaman aralığını (span) AÇIKÇA taşır — hareketin kaç saatte ölçüldüğü KAYITLI", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T10:00:00.000Z"), snap(16, "2026-07-16T16:00:00.000Z")]],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    expect(a.agf02SpanHours).toBeCloseTo(6, 10);
  });

  it("aynı zaman damgalı (span=0) snapshot'lar hareket TANIMLAMAZ — observed=false, 0 UYDURULMAZ", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T17:00:00.000Z"), snap(12, "2026-07-16T17:00:00.000Z")]],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    const agf02 = a.signals.find((s) => s.code === "AGF_02")!;
    expect(agf02.observed).toBe(false);
    expect(agf02.rawValue).toBeNull();
    expect(a.agf02SpanHours).toBeNull();
  });

  it("tek snapshot varsa hareket TANIMSIZ (0 UYDURULMAZ) — observed=false", () => {
    const runners: AgfRunnerInput[] = [
      { id: "a", no: 1, ekuriGroup: null },
      { id: "b", no: 2, ekuriGroup: null },
    ];
    const snaps = new Map<string, AgfSnapshotRow[]>([
      ["a", [snap(10, "2026-07-16T17:00:00.000Z")]],
      ["b", [snap(20, "2026-07-16T17:30:00.000Z")]],
    ]);
    const result = computeAgfSignalsFromSnapshots(runners, snaps, cutoff);
    const a = result.runners.find((r) => r.no === 1)!;
    const agf02 = a.signals.find((s) => s.code === "AGF_02")!;
    expect(agf02.observed).toBe(false);
    expect(agf02.rawValue).toBeNull();
    expect(agf02.missingReason).toMatch(/yalnız 1 snapshot/);
  });
});

describe("computeAgfSignalsFromSnapshots — saha büyüklüğü koruması", () => {
  it("2'den az at varsa INSUFFICIENT_RUNNERS, hiçbir sinyal gözlemli değil", () => {
    const runners: AgfRunnerInput[] = [{ id: "a", no: 1, ekuriGroup: null }];
    const result = computeAgfSignalsFromSnapshots(runners, new Map(), cutoff);
    expect(result.raceQuality).toBe("INSUFFICIENT_RUNNERS");
    expect(result.runners[0].signals.every((s) => !s.observed)).toBe(true);
  });
});
