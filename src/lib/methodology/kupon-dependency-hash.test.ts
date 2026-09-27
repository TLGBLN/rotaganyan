import { describe, expect, it } from "vitest";
import { dependencyHashForRace, toClientDependencyInput, type OptimizerConfig } from "./kupon-dependency-hash";

// 2026-09-27 — Adana 2.Altılı bulgusu ("Otomatik Doldur dediğimde yaratılanla yansıyan
// farklı"): STALE_CLIENT_VIEW koruması, istemcinin EKRANDA gördüğü ham veriden
// (toClientDependencyInput) çıkardığı hash'in, sunucunun TAZE DB okumasından çıkardığı
// hash'le (aynı dependencyHashForRace fonksiyonu, farklı girdi) doğru şekilde eşleşip
// eşleşmediğini denetler. Bu testler o kıyaslamanın GERÇEKTEN çalıştığını kanıtlıyor.
const config: OptimizerConfig = { stakePerCombination: 1.25, limits: { narrow: 600, normal: 1500, wide: 3000 }, tolerances: { narrow: 1, normal: 1.1, wide: 1.1 } };

describe("toClientDependencyInput + dependencyHashForRace (STALE_CLIENT_VIEW temeli)", () => {
  const races = [
    {
      raceNo: 1,
      pistDuyarliligi: null,
      gecmisRiskSeviyesi: null,
      runners: [
        { no: 1, name: "AT A", score: 40, scoreExact: 40.3, scratched: false, ekuriGroup: null, agfSirasi: 1 },
        { no: 2, name: "AT B", score: 25, scoreExact: 24.8, scratched: false, ekuriGroup: null, agfSirasi: 2 },
      ],
    },
  ];

  it("aynı veriden (istemci snapshot vs sunucu şekli) aynı hash üretir", () => {
    const clientHash = dependencyHashForRace(toClientDependencyInput(races), config);
    const serverShape = [
      {
        raceNo: 1,
        pistDuyarliligi: null,
        gecmisRiskSeviyesi: null,
        runners: [
          { no: 1, olasilik: 40.3 / 100, scratched: false, ekuriGroup: null },
          { no: 2, olasilik: 24.8 / 100, scratched: false, ekuriGroup: null },
        ],
      },
    ];
    const serverHash = dependencyHashForRace(serverShape, config);
    expect(clientHash).toBe(serverHash);
  });

  it("bir at scratched olunca (diğer alanlar aynı kalsa bile) hash değişir", () => {
    const before = dependencyHashForRace(toClientDependencyInput(races), config);
    const scratchedRaces = [{ ...races[0], runners: races[0].runners.map((r, i) => (i === 1 ? { ...r, scratched: true } : r)) }];
    const after = dependencyHashForRace(toClientDependencyInput(scratchedRaces), config);
    expect(after).not.toBe(before);
  });

  it("bir atın olasılığı (scoreExact) değişince hash değişir — arka planda reanaliz senaryosu", () => {
    const before = dependencyHashForRace(toClientDependencyInput(races), config);
    const reanalyzed = [{ ...races[0], runners: races[0].runners.map((r, i) => (i === 0 ? { ...r, scoreExact: 55.0, score: 55 } : r)) }];
    const after = dependencyHashForRace(toClientDependencyInput(reanalyzed), config);
    expect(after).not.toBe(before);
  });

  it("yalnız istemcide-taşınan alanlar (name/agfSirasi) değişse hash AYNI kalır", () => {
    const before = dependencyHashForRace(toClientDependencyInput(races), config);
    const renamed = [{ ...races[0], runners: races[0].runners.map((r) => ({ ...r, name: "BAŞKA İSİM", agfSirasi: 99 })) }];
    const after = dependencyHashForRace(toClientDependencyInput(renamed), config);
    expect(after).toBe(before);
  });
});
