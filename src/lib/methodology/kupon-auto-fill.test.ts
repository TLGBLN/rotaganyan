import { describe, expect, it } from "vitest";
import { otomatikGroupSelections, computeAllocatorTiers, type AutoFillRace, LIMITS, TOLERANCES, WIDTHS } from "./kupon-auto-fill";

// 2026-10-11 — bu dosya KuponForm.tsx'ten BİREBİR aynı mantıkla taşındı (davranış
// değişmedi); bu test hem taşımanın hem de computeAllocatorTiers'ın (publish-time RCA
// snapshot'ın kullandığı, AYNI DP çağrısının zengin OptimizeResult döndüren hali)
// otomatikGroupSelections ile TUTARLI (aynı seçimleri üreten) olduğunu doğruluyor —
// ikisi birbirinden sapmamalı, aksi halde server'ın "optimizer ne seçerdi" hesabı
// client'ın ⚡ Otomatik Doldur'undan FARKLI çıkar.
const races: AutoFillRace[] = [
  { raceNo: 1, runners: [
    { no: 1, scratched: false, ekuriGroup: null, score: null, scoreExact: 40 },
    { no: 2, scratched: false, ekuriGroup: null, score: null, scoreExact: 30 },
    { no: 3, scratched: false, ekuriGroup: null, score: null, scoreExact: 20 },
    { no: 4, scratched: false, ekuriGroup: null, score: null, scoreExact: 10 },
  ] },
  { raceNo: 2, runners: [
    { no: 1, scratched: false, ekuriGroup: null, score: null, scoreExact: 50 },
    { no: 2, scratched: false, ekuriGroup: null, score: null, scoreExact: 25 },
    { no: 3, scratched: false, ekuriGroup: null, score: null, scoreExact: 25 },
  ] },
];

describe("computeAllocatorTiers ↔ otomatikGroupSelections tutarlılığı", () => {
  it("her kademe için computeAllocatorTiers.selections, otomatikGroupSelections'ın Set'iyle AYNI at numaralarını üretir", () => {
    const groupSel = otomatikGroupSelections(races, 1.25, LIMITS, TOLERANCES);
    const tiers = computeAllocatorTiers(races, 1.25, LIMITS, TOLERANCES);

    for (const tier of tiers) {
      for (const race of races) {
        const fromTiers = [...(tier.selections[race.raceNo] ?? [])].sort((a, b) => a - b);
        const fromGroupSel = [...(groupSel[race.raceNo]?.[tier.width] ?? new Set<number>())].sort((a, b) => a - b);
        expect(fromTiers).toEqual(fromGroupSel);
      }
    }
  });

  it("kademeler bütçeyi aşmaz ve narrow→normal→wide taban-mirası korunur (eksiltme yok)", () => {
    const tiers = computeAllocatorTiers(races, 1.25, LIMITS, TOLERANCES);
    const byWidth = new Map(tiers.map((t) => [t.width, t]));
    for (const w of WIDTHS) expect(byWidth.get(w)!.combinationLimit).toBeGreaterThan(0);

    for (const race of races) {
      const narrowN = byWidth.get("narrow")!.selections[race.raceNo]?.length ?? 0;
      const normalN = byWidth.get("normal")!.selections[race.raceNo]?.length ?? 0;
      const wideN = byWidth.get("wide")!.selections[race.raceNo]?.length ?? 0;
      expect(normalN).toBeGreaterThanOrEqual(narrowN);
      expect(wideN).toBeGreaterThanOrEqual(normalN);
    }
  });
});
