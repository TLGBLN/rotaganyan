// ROTAGANYAN ANALİZ MOTORU — Faz 4 madde 2 (kupon üretimi UYUMLULUĞU): kullanıcı talimatı
// "gerçek kupon kodunu DEĞİŞTİRME, sadece UYUMLULUĞU raporla" — bu dosya kupon-optimizer.ts'i
// (src/lib/methodology/kupon-optimizer.ts, V5.46.1'in ZATEN kullandığı, DEĞİŞTİRİLMEYEN
// gerçek kod) GERÇEKTEN çağırır, RAN snapshot'ından türetilen LegProbability girdisiyle —
// "uyumlu" İDDİASI değil, ÇALIŞAN bir entegrasyon kanıtı.
//
// Bulgu: kupon-optimizer.ts'in beklediği LegProbability.runners[] şekli ({no, olasilik,
// ekuriGroup?}) RanPredictionSnapshot'ın {no, winProbability} alanlarıyla BİREBİR eşleşiyor
// — ekuriGroup RAN'ın skoruna HİÇ girmeyen, ayrı bir runner-metadata alanı (Runner.ekuriGroup
// gibi, hangi motor çalışsa AYNI kaynaktan gelir) olduğu için kupon-optimizer.ts'e TEK satırlık
// bir dönüşümle (map) beslenebilir — kupon kodunda HİÇBİR DEĞİŞİKLİK gerekmiyor.
import { describe, it, expect } from "vitest";
import { optimizeKuponAllocation, type LegProbability } from "@/lib/methodology/kupon-optimizer";
import type { RanPredictionSnapshot } from "./snapshot-integrity";

function fakeRanSnapshotsForRace(raceNo: number, probs: number[]): Pick<RanPredictionSnapshot, "no" | "winProbability">[] {
  return probs.map((p, i) => ({ no: i + 1, winProbability: p }));
}

describe("RAN snapshot → kupon-optimizer.ts LegProbability UYUMLULUĞU (gerçek kod, değiştirilmedi)", () => {
  it("RAN'ın winProbability çıktısı tek satırlık dönüşümle optimizeKuponAllocation'a (GERÇEK fonksiyon) beslenebilir", () => {
    // 2 ayaklı sahte bir gün — her ayak RAN'ın ÜRETTİĞİ (softmax, toplamı 1.0) olasılıklar.
    const leg1 = fakeRanSnapshotsForRace(1, [0.4, 0.3, 0.2, 0.1]);
    const leg2 = fakeRanSnapshotsForRace(2, [0.5, 0.25, 0.15, 0.1]);

    // TEK dönüşüm — RAN snapshot'ı LegProbability'ye çevirir, kupon-optimizer.ts'in
    // KENDİSİ hiç dokunulmadı/değiştirilmedi.
    const legs: LegProbability[] = [
      { raceNo: 1, runners: leg1.map((s) => ({ no: s.no, olasilik: s.winProbability })) },
      { raceNo: 2, runners: leg2.map((s) => ({ no: s.no, olasilik: s.winProbability })) },
    ];

    const result = optimizeKuponAllocation(legs, 12);

    expect(result.secimler[1]).toBeDefined();
    expect(result.secimler[2]).toBeDefined();
    expect(result.toplamKombinasyon).toBeGreaterThan(0);
    expect(result.toplamKombinasyon).toBeLessThanOrEqual(12);
    expect(result.kapsamaOlasiligi).toBeGreaterThan(0);
    expect(result.kapsamaOlasiligi).toBeLessThanOrEqual(1);
  });

  it("softmax garantisi (Σolasilik=1.0) kupon-optimizer'ın log-olasılık DP'sini BOZMAZ — uç durum: TEK aday at (saha=1) dahi doğru işlenir", () => {
    const leg = fakeRanSnapshotsForRace(1, [1.0]);
    const legs: LegProbability[] = [{ raceNo: 1, runners: leg.map((s) => ({ no: s.no, olasilik: s.winProbability })) }];
    const result = optimizeKuponAllocation(legs, 5);
    expect(result.secimler[1]).toEqual([1]);
    expect(result.kapsamaOlasiligi).toBeCloseTo(1, 10);
  });
});
