import { describe, expect, it } from "vitest";
import { classifyEtkinFormDurum, evaluateJokeyRescue, buildJokeySon30GMetni, type JokeyGuncelForm } from "./jokey-form";

// 2026-10-11 — ROTAGANYAN Jokey Son 30 Gün Performans Standardı (kullanıcı spesifikasyonu)
// doğrulama senaryoları A-F.

describe("classifyEtkinFormDurum", () => {
  it("eşik sınırlarını doğru sınıflandırır", () => {
    expect(classifyEtkinFormDurum(3.07)).toBe("ÇOK GÜÇLÜ POZİTİF"); // Vedat Abiş örneği
    expect(classifyEtkinFormDurum(2.0)).toBe("ÇOK GÜÇLÜ POZİTİF");
    expect(classifyEtkinFormDurum(1.99)).toBe("POZİTİF");
    expect(classifyEtkinFormDurum(0.64)).toBe("NÖTR"); // Berkay Bülbül örneği (+0.64)
    expect(classifyEtkinFormDurum(0.75)).toBe("POZİTİF");
    expect(classifyEtkinFormDurum(0.74)).toBe("NÖTR");
    expect(classifyEtkinFormDurum(0)).toBe("NÖTR");
    expect(classifyEtkinFormDurum(-0.74)).toBe("NÖTR");
    expect(classifyEtkinFormDurum(-0.75)).toBe("NEGATİF");
    expect(classifyEtkinFormDurum(-1.99)).toBe("NEGATİF");
    expect(classifyEtkinFormDurum(-2.0)).toBe("ÇOK GÜÇLÜ NEGATİF");
  });
});

describe("evaluateJokeyRescue — senaryolar A-F", () => {
  it("A) güçlü at (temel sıra 1-6) + güçlü jokey → rescue kavramı uygulanmaz (zaten ilk 6'da)", () => {
    const r = evaluateJokeyRescue(2, 3.2, 0.96);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("B) güçlü at (temel sıra 1-6) + negatif jokey → rescue kavramı uygulanmaz", () => {
    const r = evaluateJokeyRescue(1, -2.1, 0.9);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("C) temel sıra 7 + güçlü jokey (FormΔ≥2.0, Güven≥0.85) → JOKEY_DESTEKLI_ILK6", () => {
    const r = evaluateJokeyRescue(7, 2.0, 0.85);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: true, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("D) temel sıra 10 + güçlü jokey → JOKEY_DESTEKLI_ILK6 (bandın üst sınırı dahil)", () => {
    const r = evaluateJokeyRescue(10, 3.0, 0.9);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: true, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("E) temel sıra 12 + güçlü jokey → yalnız Jokey Destekli Sürpriz, otomatik ilk-6'ya ÇEKİLMEZ", () => {
    const r = evaluateJokeyRescue(12, 3.0, 0.9);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: true });
  });

  it("F) düşük N30 + yüksek ham K30 → düşük güven nedeniyle rescue ÇALIŞMAMALI", () => {
    // Senaryo: 2/5 galibiyet = %40 ham oran, ama N30=5 çok küçük → Güven=5/13=0.385.
    // Varsayımsal formDelta çok yüksek çıksa bile (örn. +20pp), Güven<0.85 olduğu için
    // rescue tetiklenmemeli — guven KOŞULU etkinForm eşiğinden BAĞIMSIZ ayrıca kontrol edilir.
    const dusukGuven = 5 / (5 + 8); // 0.3846...
    expect(dusukGuven).toBeLessThan(0.85);
    const r = evaluateJokeyRescue(8, 20, dusukGuven); // temel sıra 8 (7-10 bandında), etkinForm çok yüksek
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("temel sıra 7-10 ama EtkinForm eşiğin altında (örn. +0.3) → rescue YOK", () => {
    const r = evaluateJokeyRescue(8, 0.3, 0.96);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("bant sınırları: temel sıra 6 (henüz 7 değil) → rescue kavramı uygulanmaz", () => {
    const r = evaluateJokeyRescue(6, 3.0, 0.9);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false });
  });

  it("bant sınırları: temel sıra 11 (10'dan hemen sonra) → yalnız SÜRPRİZ", () => {
    const r = evaluateJokeyRescue(11, 3.0, 0.9);
    expect(r).toEqual({ JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: true });
  });
});

describe("buildJokeySon30GMetni", () => {
  const vedatAbis: JokeyGuncelForm = {
    son30Start: 201, son30Win: 49, son30WinRate: 49 / 201,
    son30Top3: 0, son30Top3Rate: 0,
    kRef: 0.212, kRefTier: "31-180", kRefSampleN: 150,
    formDelta: 49 / 201 - 0.212,
    reliability: 201 / (201 + 8),
    etkinForm: (49 / 201 - 0.212) * (201 / (201 + 8)),
    durum: "ÇOK GÜÇLÜ POZİTİF",
    uzunDonemStart: 400, uzunDonemWinRate: 0.2,
  };

  it("kullanıcı spesifikasyonundaki örnek formatı birebir üretir", () => {
    const metin = buildJokeySon30GMetni("Vedat Abiş", vedatAbis);
    expect(metin).toContain("Vedat Abiş");
    expect(metin).toContain("49/201");
    expect(metin).toContain("%24.4");
    expect(metin).toContain("Ref %21.2");
    expect(metin).toContain("+3.2 pp");
    expect(metin).toContain("Güven %96");
    expect(metin).toContain("ÇOK GÜÇLÜ POZİTİF");
  });

  it("biniş kaydı yoksa (son30Start=0) nazik bir metin döner, hata atmaz", () => {
    const bos: JokeyGuncelForm = {
      son30Start: 0, son30Win: 0, son30WinRate: 0, son30Top3: 0, son30Top3Rate: 0,
      kRef: 0, kRefTier: "none", kRefSampleN: 0, formDelta: null, reliability: 0,
      etkinForm: null, durum: null, uzunDonemStart: 0, uzunDonemWinRate: 0,
    };
    expect(buildJokeySon30GMetni("Test Jokey", bos)).toBe("Jokey Son 30G: Test Jokey — bu dönemde biniş kaydı yok.");
  });
});
