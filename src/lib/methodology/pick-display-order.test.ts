import { describe, expect, it } from "vitest";
import { siraliPickler, siraliPickSatirlari } from "./pick-display-order";

// 2026-09-05 — İstanbul K4 (BALDER/TERCAN HAN) vakası: üç ayrı herkese açık tabloda
// (ProgramView.tsx/PuanTablosu.tsx/InlineAnalysisPanel.tsx) gösterim sırası kayıtlı Sıra
// (rank) kullanıyordu — terfi/garanti mekanizmaları rank'i kasıtlı olarak ham olasılıktan
// saptırabildiği için (bkz. v5-engine.ts, terfiPenceresiV5) tablo Toplam/Puan sütununa göre
// sıralı GÖRÜNMÜYORDU. Bu testler, bir sonraki değişiklikte biri bu iki fonksiyonu "basitleştirip"
// tekrar rank'e dönerse veya null score'u yanlış işlerse HEMEN kırılsın diye var.

describe("siraliPickler", () => {
  it("score'a göre yüksekten azalana sıralar (rank'i yok sayar)", () => {
    const picks = [
      { rank: 4, score: 4 },
      { rank: 1, score: 24 },
      { rank: 5, score: 14 },
      { rank: 3, score: 10 },
      { rank: 6, score: 11 },
    ];
    const sonuc = siraliPickler(picks);
    expect(sonuc.map((p) => p.score)).toEqual([24, 14, 11, 10, 4]);
  });

  it("null score'u en düşük (0) gibi işler, sona atar", () => {
    const picks = [{ score: null }, { score: 5 }, { score: null }, { score: 12 }];
    const sonuc = siraliPickler(picks);
    expect(sonuc.map((p) => p.score)).toEqual([12, 5, null, null]);
  });

  it("orijinal diziyi mutasyona uğratmaz", () => {
    const picks = [{ score: 1 }, { score: 9 }];
    const kopya = [...picks];
    siraliPickler(picks);
    expect(picks).toEqual(kopya);
  });
});

describe("siraliPickSatirlari", () => {
  it("her satırı kendi üyelerinin EN YÜKSEK puanına göre sıralar (eküri çiftleri)", () => {
    const rows = [
      [{ score: 4 }],                 // tek başına, düşük
      [{ score: 24 }],                // tek başına, en yüksek
      [{ score: 7 }, { score: 17 }],  // eküri çifti — satırın temsili puanı max=17
    ];
    const sonuc = siraliPickSatirlari(rows);
    expect(sonuc.map((row) => Math.max(...row.map((p) => p.score ?? 0)))).toEqual([24, 17, 4]);
  });

  it("gerçek İstanbul K4 vakasını doğru sıralar", () => {
    // Gerçek DB'den: eskiden rank'e göre TERCAN HAN 4.sırada duruyordu (%4), BALDER 7.sırada (%7).
    const rows = [
      [{ ad: "KASAP ENDER", score: 24 }],
      [{ ad: "DELİ UMUT", score: 17 }],
      [{ ad: "SANCAKALAN", score: 10 }],
      [{ ad: "TERCAN HAN", score: 4 }],
      [{ ad: "SURUÇLU MEMO", score: 14 }],
      [{ ad: "ALATTİN", score: 11 }],
      [{ ad: "BALDER", score: 7 }],
    ];
    const sonuc = siraliPickSatirlari(rows);
    expect(sonuc.map((row) => row[0].ad)).toEqual([
      "KASAP ENDER", "DELİ UMUT", "SURUÇLU MEMO", "ALATTİN", "SANCAKALAN", "BALDER", "TERCAN HAN",
    ]);
  });
});
