// ROTAGANYAN v1.0 — PMZ düzeltme turu, nokta #1 (kullanıcı talimatı, 2026-10-17):
// "maxSourceTimestamp < cutoff kontrolü istiyorum. Bugünkü yarışın sonucu, derecesi
// veya yarış sonrası hesaplanmış özelliği tahmine sızmamalı." Önceki round'daki
// diag-motor-v1-protection-regression.mts yalnız "değer çağrılar arasında değişmiyor"
// diye DOLAYLI kanıt veriyordu — bu dosya hizDerecesiHesaplaOrtak'ın SAF (DB'siz)
// olmasından yararlanıp DOĞRUDAN bir sızıntı senaryosu kurar: cutoff-sonrası bir satır
// EKLENİR ve sonucun DEĞİŞMEMESİ gerektiği doğrudan assert edilir. hiz-derecesi-hesapla.ts
// DEĞİŞTİRİLMEDİ — bu yalnız YENİ bir doğrulama testi.

import { describe, expect, it } from "vitest";
import { hizDerecesiHesaplaOrtak, hizPaceIndexKur, type HizGecmisSatir } from "@/lib/methodology/hiz-derecesi-hesapla";

const IRK = "İNGİLİZ";
const BASELINE_TIME = "1.24.00"; // 84 saniye, 1400m → pace ≈ 16.67 m/s
const EXTREME_FAST_TIME = "0.40.00"; // 40 saniye — sahte, SIZARSA büyük pozitif sapma üretir

function buildPopulation(dates: string[]): Map<number, HizGecmisSatir[]> {
  const map = new Map<number, HizGecmisSatir[]>();
  dates.forEach((date, i) => {
    map.set(i + 1, [{ date, time: BASELINE_TIME, distance: 1400, surface: "Ç:Normal 3.3" }]);
  });
  return map;
}

const IRK_MAP_FACTORY = (n: number) => {
  const m = new Map<number, string>();
  for (let i = 1; i <= n; i++) m.set(i, IRK);
  return m;
};

// 20 popülasyon noktası (hizPopulasyonOrtPace eşiği: sayi>=20), hepsi 2025 içinde (erken).
const POP_DATES_2025 = Array.from({ length: 20 }, (_, i) => `0${(i % 9) + 1}`.slice(-2) + ".01.2025");

describe("hizDerecesiHesaplaOrtak — point-in-time: cutoff SONRASI veri SIZMAZ (nokta #1)", () => {
  it("atın KENDİ cutoff-sonrası satırı eklenince sonuç DEĞİŞMEZ (own-history leakage)", () => {
    const cutoff = new Date("2026-10-16T00:00:00.000Z");
    const paceIndex = hizPaceIndexKur(buildPopulation(POP_DATES_2025), IRK_MAP_FACTORY(20));

    const validRows: HizGecmisSatir[] = [
      { date: "01.08.2026", time: BASELINE_TIME, distance: 1400, surface: "Ç:Normal 3.3" },
      { date: "01.09.2026", time: BASELINE_TIME, distance: 1400, surface: "Ç:Normal 3.3" },
      { date: "13.09.2026", time: BASELINE_TIME, distance: 1400, surface: "Ç:Normal 3.3" },
    ];
    // Yarıştan SONRAKİ (cutoff'tan sonra) bir satır — en yeni tarihli olduğu için, filtre
    // bozuksa sort+slice(0,3) ile GEÇERLİ 3 satırdan birinin YERİNİ alır.
    const leakedFutureRow: HizGecmisSatir = { date: "17.10.2026", time: EXTREME_FAST_TIME, distance: 1400, surface: "Ç:Normal 3.3" };

    const withoutLeak = hizDerecesiHesaplaOrtak(validRows, IRK, cutoff, paceIndex);
    const withLeak = hizDerecesiHesaplaOrtak([...validRows, leakedFutureRow], IRK, cutoff, paceIndex);

    expect(withoutLeak).toBeCloseTo(0, 5); // baseline ile aynı pace → ~0 sapma bekleniyor
    expect(withLeak).toBe(withoutLeak); // cutoff-sonrası satır sonucu HİÇ DEĞİŞTİRMEMELİ
  });

  it("popülasyon referansı, DEĞERLENDİRİLEN satırın KENDİ tarihinden SONRAKİ noktaları kullanmaz", () => {
    const raceCutoff = new Date("2026-10-16T00:00:00.000Z");
    const targetRowDate = "01.09.2026"; // g.tarih — popülasyon karşılaştırması BU tarihe göre yapılmalı
    const targetRow: HizGecmisSatir = { date: targetRowDate, time: BASELINE_TIME, distance: 1400, surface: "Ç:Normal 3.3" };

    const cleanPopulation = buildPopulation(POP_DATES_2025);
    const cleanIndex = hizPaceIndexKur(cleanPopulation, IRK_MAP_FACTORY(20));

    // targetRowDate'ten SONRA ama genel yarış cutoff'undan ÖNCE tarihli, aşırı-hızlı bir
    // popülasyon noktası ekleniyor — g.tarih bazlı filtre doğruysa bu noktanın hiçbir etkisi
    // OLMAMALI (çünkü hizPopulasyonOrtPace(paceIndex, key, g.tarih) çağrılıyor, raceCutoff değil).
    const contaminatedPopulation = buildPopulation(POP_DATES_2025);
    contaminatedPopulation.set(21, [{ date: "15.09.2026", time: EXTREME_FAST_TIME, distance: 1400, surface: "Ç:Normal 3.3" }]);
    const contaminatedIrkMap = IRK_MAP_FACTORY(20);
    contaminatedIrkMap.set(21, IRK);
    const contaminatedIndex = hizPaceIndexKur(contaminatedPopulation, contaminatedIrkMap);

    const clean = hizDerecesiHesaplaOrtak([targetRow], IRK, raceCutoff, cleanIndex);
    const contaminated = hizDerecesiHesaplaOrtak([targetRow], IRK, raceCutoff, contaminatedIndex);

    expect(contaminated).toBe(clean);
  });
});
