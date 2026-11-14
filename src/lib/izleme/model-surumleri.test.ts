import { describe, it, expect } from "vitest";
import { MODEL_SURUMLERI, GUNCEL_MODEL, modelSurumuAt } from "./model-surumleri";
import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";

describe("MODEL_SURUMLERI — güncellik korumaları", () => {
  it("son sürümün özellik sayısı canlı varsayılan ağırlık dosyasıyla AYNI (model değişince liste güncellenmeli)", () => {
    expect(GUNCEL_MODEL.ozellikSayisi).toBe((safW as { featureNames: string[] }).featureNames.length);
  });
  it("her model sürümünün başlangıcı ENGINE_VERSIONS'ta bir girdiye karşılık gelir (deploy saati tutarlı)", () => {
    const saatler = new Set(ENGINE_VERSIONS.map((v) => v.baslangic.getTime()));
    for (const s of MODEL_SURUMLERI.slice(1)) expect(saatler.has(new Date(s.baslangic).getTime()), s.ad).toBe(true);
  });
  it("sürümler zaman sırasında (özellik sayısı 2026-11-14'te ölü sinyaller çıkarılınca BİLEREK 25→21 azaldı)", () => {
    for (let i = 1; i < MODEL_SURUMLERI.length; i++) {
      expect(new Date(MODEL_SURUMLERI[i].baslangic).getTime()).toBeGreaterThan(new Date(MODEL_SURUMLERI[i - 1].baslangic).getTime());
    }
  });
});

describe("modelSurumuAt", () => {
  it("Saf era öncesi null, sonrası doğru sürüm", () => {
    expect(modelSurumuAt(new Date("2026-11-09T23:00:00+03:00"))).toBeNull();
    expect(modelSurumuAt(new Date("2026-11-12T12:00:00+03:00"))!.ozellikSayisi).toBe(20);
    expect(modelSurumuAt(new Date("2026-11-12T21:00:00+03:00"))!.ozellikSayisi).toBe(22);
    expect(modelSurumuAt(new Date("2026-11-13T11:39:13+03:00"))!.ozellikSayisi).toBe(22);
    expect(modelSurumuAt(new Date("2026-11-13T11:39:14+03:00"))!.ozellikSayisi).toBe(25);
    expect(modelSurumuAt(new Date("2026-11-14T14:19:49+03:00"))!.ozellikSayisi).toBe(25);
    expect(modelSurumuAt(new Date("2026-11-14T14:19:50+03:00"))!.ozellikSayisi).toBe(21);
  });
});
