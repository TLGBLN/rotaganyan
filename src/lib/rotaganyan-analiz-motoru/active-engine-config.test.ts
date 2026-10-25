import { describe, it, expect } from "vitest";
import { ACTIVE_PREDICTION_ENGINE, resolveActivePredictionEngine } from "./active-engine-config";

describe("ACTIVE_PREDICTION_ENGINE — varsayılan DEĞİŞTİRİLMEMELİ (kullanıcı talimatı, EN ÖNEMLİ kısıt)", () => {
  it("sabit değer 'v546-1'dir", () => {
    expect(ACTIVE_PREDICTION_ENGINE).toBe("v546-1");
  });
});

describe("resolveActivePredictionEngine — Faz 4 kontrollü geçiş mekanizması", () => {
  it("RAN_FORCE_ACTIVE_ENGINE ayarlanmamışsa (gerçek production env'i) ACTIVE_PREDICTION_ENGINE'i AYNEN döner", () => {
    expect(resolveActivePredictionEngine({})).toBe("v546-1");
  });

  it("gerçek process.env'de (bu test ortamında) env var TANIMLI DEĞİL — varsayılana düşer", () => {
    expect(resolveActivePredictionEngine()).toBe("v546-1");
  });

  it("RAN_FORCE_ACTIVE_ENGINE='rotaganyan-analiz-motoru' AÇIKÇA ayarlanırsa onu döner (izole/kontrollü deneme)", () => {
    expect(resolveActivePredictionEngine({ RAN_FORCE_ACTIVE_ENGINE: "rotaganyan-analiz-motoru" })).toBe(
      "rotaganyan-analiz-motoru"
    );
  });

  it("geçersiz/yazım-hatalı bir değer SESSİZCE yok sayılır, varsayılana düşer (production'ı DURDURMAZ)", () => {
    expect(resolveActivePredictionEngine({ RAN_FORCE_ACTIVE_ENGINE: "v999-typo" })).toBe("v546-1");
  });
});
