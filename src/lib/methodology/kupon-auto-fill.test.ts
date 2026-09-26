// 2026-09-26 kullanıcı talebi: Ekonomik 700-900₺'ye taşındı, altına Süper Ekonomik
// (300-500₺) eklendi — dört kademeli (micro→narrow→normal→wide) yapının doğru
// kurulduğunu ve otomatikGroupSelections'ın kademeli mirası (her kademe bir öncekini
// TABAN alır) koruduğunu doğrular.
import { describe, expect, it, vi } from "vitest";
import {
  WIDTHS,
  WIDTH_LABEL,
  LIMITS,
  TOLERANCES,
  YEDILI_LIMITS,
  YEDILI_TOLERANCES,
  emptySelection,
  otomatikGroupSelections,
  tierNestingIhlalleriniBul,
  computeTierRegret,
  TIER_REGRET_WARN_THRESHOLD,
  type RaceDayData,
} from "./kupon-auto-fill";
import { optimizeKuponAllocation } from "./kupon-optimizer";

describe("Width kademeleri (4'lü yapı)", () => {
  it("WIDTHS ucuzdan pahalıya sıralı: micro, narrow, normal, wide", () => {
    expect(WIDTHS).toEqual(["micro", "narrow", "normal", "wide"]);
  });

  it("WIDTH_LABEL Türkçe etiketleri doğru eşler", () => {
    expect(WIDTH_LABEL).toEqual({ micro: "Süper Ekonomik", narrow: "Ekonomik", normal: "Normal", wide: "Geniş" });
  });

  it("emptySelection dört kademenin de boş Set'ini döner", () => {
    const sel = emptySelection();
    expect(Object.keys(sel).sort()).toEqual(["micro", "narrow", "normal", "wide"]);
    for (const w of WIDTHS) expect(sel[w].size).toBe(0);
  });

  it("Süper Ekonomik (micro) hedefi 300-500₺ aralığında", () => {
    expect(LIMITS.micro).toBe(300);
    expect(LIMITS.micro * TOLERANCES.micro).toBeCloseTo(500, 5);
  });

  it("Ekonomik (narrow) hedefi 700-900₺ aralığında", () => {
    expect(LIMITS.narrow).toBe(700);
    expect(LIMITS.narrow * TOLERANCES.narrow).toBeCloseTo(900, 5);
  });

  it("7'li Ganyan (YEDILI) da aynı ₺ hedeflerine hizalı", () => {
    expect(YEDILI_LIMITS.micro * YEDILI_TOLERANCES.micro).toBeCloseTo(500, 5);
    expect(YEDILI_LIMITS.narrow * YEDILI_TOLERANCES.narrow).toBeCloseTo(900, 5);
  });
});

// GERÇEK İzmir 1.Altılı canlı vakasının BİREBİR verisi (2026-09-26, arac-deploy-dogrula
// öncesi canlı DB'den okundu) — sentetik/yaklaşık bir fixture DEĞİL, raporlanan hatayı
// GERÇEKTEN üreten olasılık dağılımları. K2 güçlü tek favori (34.9%) ama anlamlı bir
// "ikinci kademesi" var (13.1/11.5/11.5%) — eski (floor) algoritma bunu 1 ata düşürüyordu.
function izmirGercekRaces(): RaceDayData["races"] {
  const leg = (raceNo: number, probsPct: number[]): RaceDayData["races"][number] => ({
    raceNo, pistAnormalMi: false, pistDuyarliligi: null, gecmisRiskSeviyesi: null, pistUyariMesaji: null,
    runners: probsPct.map((p, j) => ({ no: j + 1, name: `At ${j + 1}`, scratched: false, ekuriGroup: null, score: p, scoreExact: p, agfSirasi: j + 1 })),
  });
  return [
    leg(1, [30.5, 20.4, 18.1, 8.9, 6.2, 5.5, 2.9]),
    leg(2, [34.9, 13.1, 11.5, 11.5, 7.4, 7.0, 4.1, 2.7, 2.0, 1.7, 1.5, 1.0, 0.9, 0.7]),
    leg(3, [40.3, 24.5, 14.6, 11.1, 9.6]),
    leg(4, [30.1, 13.6, 12.0, 8.7, 7.4, 7.0, 6.2, 4.3, 3.9, 3.7, 3.2]),
    leg(5, [42.9, 12.8, 12.3, 7.1, 6.7, 4.3, 3.4, 2.4, 2.2, 2.1, 1.6, 0.8, 0.8, 0.6]),
    leg(6, [31.0, 19.1, 14.6, 6.4, 6.2, 5.1, 4.8, 3.4, 3.4, 2.2, 2.0, 1.8]),
  ];
}

describe("otomatikGroupSelections — JOINT nested optimizasyon (kullanıcı düzeltmesi, 2. tur)", () => {
  const races = izmirGercekRaces();
  const stakePerCombination = 1.25;

  it("S⊆E⊆N⊆W nesting'i HER ayakta KESİN korunur (dört kademe de)", () => {
    const sel = otomatikGroupSelections(races, stakePerCombination);
    expect(tierNestingIhlalleriniBul(races, sel)).toEqual([]);
  });

  it("REGRESYON: Süper Ekonomik'in agresif tercihi (leg4) Ekonomik'i (leg2'de) SIKIŞTIRMAZ", () => {
    // Bu, İzmir 1.Altılı canlı vakasının doğrudan kanıtı: eski (artan/floor) algoritma
    // leg2'yi (güçlü tek favori) 1 ata düşürüyordu çünkü micro'nun leg4'teki agresif
    // tercihini TABAN olarak devralıyordu. Yeni (azalan/ceiling) algoritmada Ekonomik
    // KENDİ bütçesiyle bağımsız optimize edilir (yalnız Normal'in tavanıyla sınırlı,
    // Normal de Geniş'in tavanıyla — Geniş TAMAMEN serbest) — leg2'de birden fazla at
    // olmalı çünkü Ekonomik'in kendi 700-900₺ bütçesi buna yetiyor.
    const sel = otomatikGroupSelections(races, stakePerCombination);
    expect(sel[2].narrow.size).toBeGreaterThan(1);
  });

  it("Kapsama olasılığı monoton: Süper Ekonomik ≤ Ekonomik ≤ Normal ≤ Geniş (her ayakta birim sayısı)", () => {
    const sel = otomatikGroupSelections(races, stakePerCombination);
    for (const race of races) {
      const s = sel[race.raceNo];
      expect(s.micro.size).toBeLessThanOrEqual(s.narrow.size);
      expect(s.narrow.size).toBeLessThanOrEqual(s.normal.size);
      expect(s.normal.size).toBeLessThanOrEqual(s.wide.size);
    }
  });

  it("Geniş (wide) TAMAMEN BAĞIMSIZ optimize edilir — hiçbir ucuz kademeden kısıt almaz", () => {
    // wide'ı WIDTHS zincirinin DIŞINDA, tek başına (ceiling yok) yeniden hesapla ve
    // otomatikGroupSelections'ın ÜRETTİĞİ wide ile birebir aynı olduğunu doğrula.
    const effectiveLimit = LIMITS.wide * TOLERANCES.wide;
    const maxCombinations = Math.max(1, Math.floor(effectiveLimit / stakePerCombination));
    const legsByWidth = races.map((race) => ({
      raceNo: race.raceNo,
      runners: race.runners.filter((r) => !r.scratched).map((r) => ({ no: r.no, olasilik: (r.scoreExact ?? r.score ?? 0) / 100, ekuriGroup: r.ekuriGroup })),
    }));
    const fresh = optimizeKuponAllocation(legsByWidth, maxCombinations);
    const sel = otomatikGroupSelections(races, stakePerCombination);
    for (const race of races) {
      expect([...sel[race.raceNo].wide].sort((a, b) => a - b)).toEqual([...new Set(fresh.secimler[race.raceNo] ?? [])].sort((a, b) => a - b));
    }
  });

  it("manuel LIMITS/TOLERANCES verilirse (ör. YEDILI) onlar kullanılır, varsayılan DEĞİL", () => {
    const sel = otomatikGroupSelections(races, 2, YEDILI_LIMITS, YEDILI_TOLERANCES);
    expect(sel[1].micro.size).toBeGreaterThan(0);
  });
});

describe("tierNestingIhlalleriniBul — savunma kontrolü", () => {
  it("bozuk bir GroupSelections'ta ihlali doğru tespit eder", () => {
    const races: RaceDayData["races"] = [{ raceNo: 1, pistAnormalMi: false, pistDuyarliligi: null, gecmisRiskSeviyesi: null, pistUyariMesaji: null, runners: [] }];
    const bozukSel = {
      1: { micro: new Set([5]), narrow: new Set([1, 2]), normal: new Set([1, 2]), wide: new Set([1, 2]) }, // micro'daki #5 narrow'da YOK
    };
    const ihlaller = tierNestingIhlalleriniBul(races, bozukSel);
    expect(ihlaller.length).toBe(1);
    expect(ihlaller[0]).toMatch(/#5/);
  });

  it("geçerli (nested) bir GroupSelections'ta ihlal BULMAZ", () => {
    const races: RaceDayData["races"] = [{ raceNo: 1, pistAnormalMi: false, pistDuyarliligi: null, gecmisRiskSeviyesi: null, pistUyariMesaji: null, runners: [] }];
    const gecerliSel = {
      1: { micro: new Set([1]), narrow: new Set([1, 2]), normal: new Set([1, 2, 3]), wide: new Set([1, 2, 3, 4]) },
    };
    expect(tierNestingIhlalleriniBul(races, gecerliSel)).toEqual([]);
  });
});

describe("computeTierRegret — regret guard (kullanıcı düzeltmesi, 3. tur)", () => {
  // Ceiling zinciri "büyük tier küçüğü rehin alabilir" riskini TEORİK olarak taşır (eski
  // sorunun ters yönü) — bu guard onu YOK ETMEZ, SÜREKLİ ÖLÇER. Eşik aşılırsa (kullanıcının
  // örneği: %0.33 kabul edilebilir, %5.56 eski sorunun geri geldiğinin işareti) console.warn
  // ile görünür olur; publish'i ASLA engellemez (bkz. otomatikGroupSelections'taki kullanımı).
  const races = izmirGercekRaces();
  const stakePerCombination = 1.25;

  it("wide'ın regret'i YAPISAL olarak her zaman 0 — hiçbir kademeden ceiling almıyor (sağlama)", () => {
    const regret = computeTierRegret(races, stakePerCombination);
    expect(regret.wide.regretPct).toBe(0);
    expect(regret.wide.independentCoverage).toBe(regret.wide.nestedCoverage);
  });

  it("GERÇEK İzmir verisinde tüm kademelerin regret'i eşiğin ALTINDA (mimari şu an sağlıklı)", () => {
    const regret = computeTierRegret(races, stakePerCombination);
    for (const width of WIDTHS) {
      expect(regret[width].regretPct).toBeLessThanOrEqual(TIER_REGRET_WARN_THRESHOLD);
    }
  });

  it("regret formülü doğru: independent < nested asla olamaz (ceiling yalnız KISITLAR, asla İYİLEŞTİRMEZ)", () => {
    const regret = computeTierRegret(races, stakePerCombination);
    for (const width of WIDTHS) {
      expect(regret[width].nestedCoverage).toBeLessThanOrEqual(regret[width].independentCoverage + 1e-9);
      expect(regret[width].regretPct).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("otomatikGroupSelections REGRET GUARD'ı loglar ama publish'i ASLA engellemez", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => otomatikGroupSelections(races, stakePerCombination)).not.toThrow();
    warnSpy.mockRestore();
  });
});
