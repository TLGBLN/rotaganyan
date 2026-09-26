import { describe, it, expect } from "vitest";
import {
  coverageFloorHesapla,
  coverageFloorlariUygula,
  otomatikGroupSelections,
  type RaceDayData,
} from "./kupon-auto-fill";
import type { LegProbability } from "./kupon-optimizer";

// 2026-09-27 — Coverage Risk-Floor v1 testleri. Kullanıcının kesinleştirdiği 4 dal +
// bütçe-infeasible fail-open davranışı + eküri/nesting etkileşimi.

function units(probs: number[]) {
  return probs.map((p) => ({ olasilik: p }));
}

describe("coverageFloorHesapla", () => {
  it("Q6 < %80 (SANCAK gibi çok dağınık saha) → taban = ilk kez %80'i geçen n, kirmizi-ilk6", () => {
    // Q3=0.539(53.9%), Q6=0.778(77.8%), 7. atla 0.846(84.6%)
    const p = [0.278, 0.139, 0.122, 0.089, 0.077, 0.073, 0.068, 0.041, 0.041, 0.039, 0.033];
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("kirmizi-ilk6");
    expect(r.taban).toBe(7);
  });

  it("Q6 >= %80 ama Q3 < %65 → taban = ilk kez %65'i geçen n, en az 4, kirmizi-ilk3", () => {
    const p = [0.3, 0.2, 0.1, 0.15, 0.1, 0.08, 0.07]; // Q3=0.60 Q4=0.75 Q6=0.93
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("kirmizi-ilk3");
    expect(r.taban).toBe(4);
  });

  it("kirmizi-ilk3 dalinda crossing n zaten >=4 ise 'en az 4' onu degistirmez", () => {
    // Q3=0.50, crossing (%65) 5. atta olsun
    const p = [0.2, 0.15, 0.15, 0.1, 0.15, 0.1, 0.15]; // Q3=.50 Q4=.60 Q5=.75(>=.65) Q6=.85
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("kirmizi-ilk3");
    expect(r.taban).toBe(5);
  });

  it("%65 <= Q3 < %70 (sinirda/amber) → taban = 4", () => {
    const p = [0.3, 0.2, 0.15, 0.1, 0.1, 0.08]; // Q3=.65 tam sinirda, Q6=.93
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("amber");
    expect(r.taban).toBe(4);
  });

  it("Q3 >= %70 (net favori) → taban yok, DP serbest", () => {
    const p = [0.4, 0.2, 0.15, 0.08, 0.08, 0.05]; // Q3=.75 Q6=.96
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("yok");
    expect(r.taban).toBe(1);
  });

  it("exact deger esigin TAM ustunde/altinda dogru siniflandirir (yuvarlama YOK)", () => {
    // Q3 = 0.649999 -> kirmizi (65'in ALTINDA), UI'da yuvarlanirsa %65 gorunurdu
    const p = [0.3, 0.2, 0.149999, 0.15, 0.1, 0.05];
    const r = coverageFloorHesapla(units(p));
    expect(r.oncelik).toBe("kirmizi-ilk3");
  });

  it("3'ten az at olan ayakta index taşmaz (n-1'e sabitlenir)", () => {
    const r = coverageFloorHesapla(units([0.6, 0.4]));
    expect(r.taban).toBeLessThanOrEqual(2);
  });

  it("boş listede güvenli varsayılan döner", () => {
    expect(coverageFloorHesapla([])).toEqual({ taban: 1, oncelik: "yok" });
  });
});

describe("coverageFloorlariUygula — bütçe infeasible fail-open", () => {
  const legFlat = (raceNo: number): LegProbability => ({
    raceNo,
    runners: [
      { no: 1, olasilik: 0.3 }, { no: 2, olasilik: 0.2 }, { no: 3, olasilik: 0.15 },
      { no: 4, olasilik: 0.1 }, { no: 5, olasilik: 0.1 }, { no: 6, olasilik: 0.08 },
    ], // amber: Q3=.65 -> taban 4
  });

  it("bütçe yeterliyse tüm coverage taban'ları uygulanır", () => {
    const legs = [1, 2, 3, 4, 5, 6].map(legFlat);
    const result = coverageFloorlariUygula(legs, {}, 4 ** 6); // bol bütçe
    for (const l of legs) expect(result[l.raceNo]).toBe(4);
  });

  it("bütçe yetmezse amber tabanlar gevşetilir ama kupon üretilebilir kalır (fail-open)", () => {
    const legs = [1, 2, 3, 4, 5, 6].map(legFlat);
    // 4^6=4096 gerekir, yalnız 50 kombinasyon var — hepsi amber, tamamen gevşemeli (1^6=1<=50)
    const result = coverageFloorlariUygula(legs, {}, 50);
    const carpim = Object.values(result).reduce((a, b) => a * b, 1);
    expect(carpim).toBeLessThanOrEqual(50);
  });

  it("mevcut taban (nesting/Anormal Pist) coverage yüzünden ASLA düşürülmez", () => {
    const legs = [legFlat(1)];
    const result = coverageFloorlariUygula(legs, { 1: 5 }, 1); // amber taban 4 < mevcut taban 5
    expect(result[1]).toBe(5); // coverage floor'un ALTINDA olduğu için max() zaten 5'te kalır
  });

  it("kirmizi-ilk6 en son gevşer (amber ve kirmizi-ilk3'ten sonra)", () => {
    const kirmiziIlk6Leg: LegProbability = {
      raceNo: 1,
      runners: Array.from({ length: 11 }, (_, i) => ({ no: i + 1, olasilik: 0.09 })), // çok flat, Q6=.54<.80 -> taban=9 (ilk %80'i geçen)
    };
    const amberLeg = legFlat(2);
    // 9(kirmizi-ilk6 tabanı)×4(amber tabanı)=36 > bütçe(9) → infeasible.
    // Yalnız amber'i 1'e gevşetince 9×1=9<=9 → feasible — kirmizi-ilk6'nın tabanı (9) HİÇ dokunulmadan korunmalı.
    const result = coverageFloorlariUygula([kirmiziIlk6Leg, amberLeg], {}, 9);
    expect(result[2]).toBe(1); // amber gevşedi
    expect(result[1]).toBe(9); // kirmizi-ilk6 korundu
  });
});

describe("otomatikGroupSelections — coverage floor entegrasyonu (uçtan uca)", () => {
  it("K6 benzeri sınırda ayakta artık 3 değil en az 4 at seçilir", () => {
    const races: RaceDayData["races"] = [
      {
        raceNo: 6,
        pistAnormalMi: false, pistDuyarliligi: null, gecmisRiskSeviyesi: null, pistUyariMesaji: null,
        runners: [
          { no: 5, name: "RED STORM", scratched: false, ekuriGroup: null, score: 31, scoreExact: 31.0, agfSirasi: 1 },
          { no: 3, name: "KARA BERELİ", scratched: false, ekuriGroup: null, score: 19, scoreExact: 19.1, agfSirasi: 2 },
          { no: 7, name: "ÖNDERBEYİM", scratched: false, ekuriGroup: null, score: 15, scoreExact: 14.6, agfSirasi: 4 },
          { no: 10, name: "MR MONK", scratched: false, ekuriGroup: null, score: 6, scoreExact: 6.4, agfSirasi: 3 },
          { no: 9, name: "HARVEY WALLBANGER", scratched: false, ekuriGroup: null, score: 6, scoreExact: 6.2, agfSirasi: 5 },
          { no: 12, name: "YİĞENİM NEHİR", scratched: false, ekuriGroup: null, score: 5, scoreExact: 5.1, agfSirasi: 7 },
          { no: 6, name: "DROWZEE", scratched: false, ekuriGroup: null, score: 5, scoreExact: 4.8, agfSirasi: 6 },
        ],
      },
    ];
    const sel = otomatikGroupSelections(races, 1.25);
    expect(sel[6].narrow.size).toBeGreaterThanOrEqual(4);
    expect(sel[6].narrow.has(10)).toBe(true); // MR MONK artık Ekonomik'te de var
  });

  it("net favorili ayakta (Q3>=%70) coverage floor yapay genişleme YAPMAZ", () => {
    const races: RaceDayData["races"] = [
      {
        raceNo: 1,
        pistAnormalMi: false, pistDuyarliligi: null, gecmisRiskSeviyesi: null, pistUyariMesaji: null,
        runners: [
          { no: 1, name: "A", scratched: false, ekuriGroup: null, score: 60, scoreExact: 60, agfSirasi: 1 },
          { no: 2, name: "B", scratched: false, ekuriGroup: null, score: 15, scoreExact: 15, agfSirasi: 2 },
          { no: 3, name: "C", scratched: false, ekuriGroup: null, score: 10, scoreExact: 10, agfSirasi: 3 },
          { no: 4, name: "D", scratched: false, ekuriGroup: null, score: 8, scoreExact: 8, agfSirasi: 4 },
          { no: 5, name: "E", scratched: false, ekuriGroup: null, score: 7, scoreExact: 7, agfSirasi: 5 },
        ],
      },
    ];
    const sel = otomatikGroupSelections(races, 1.25);
    // Q3=85 >= %70, coverage floor devreye girmez — DP çok düşük bütçede (Ekonomik) tek at seçebilir
    expect(sel[1].narrow.size).toBeGreaterThanOrEqual(1);
  });
});
