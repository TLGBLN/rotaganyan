import { describe, it, expect } from "vitest";
import { bankoAdayiTespit, kalibreOlasilik, segmentModeliMi } from "./banko-adayi";

const pk = (p: number) => [{ no: 1, ad: "TEST", probability: p }];

describe("bankoAdayiTespit", () => {
  it("Handikap'ta ham %60 bile banko olmaz (aşırı güven kalibre edilir)", () => {
    expect(kalibreOlasilik(0.6, "Handikap")).toBeLessThan(0.4);
    expect(bankoAdayiTespit("Handikap 15/DHÖW /H2", pk(0.6)).bankoAdayi).toBe(false);
  });
  it("Şartlı 4'te ham %48 banko olur, %30 olmaz", () => {
    expect(bankoAdayiTespit("ŞARTLI 4/DHÖW", pk(0.48)).bankoAdayi).toBe(true);
    expect(bankoAdayiTespit("ŞARTLI 4/DHÖW", pk(0.3)).bankoAdayi).toBe(false);
  });
  it("segment modeli (Maiden, ŞARTLI 1/19/27) banko vermez", () => {
    for (const c of ["Maiden", "ŞARTLI 19", "ŞARTLI 1/DHÖW", "ŞARTLI 27"]) {
      expect(segmentModeliMi(c)).toBe(true);
      expect(bankoAdayiTespit(c, pk(0.9)).bankoAdayi).toBe(false);
    }
    expect(segmentModeliMi("ŞARTLI 4/DHÖW")).toBe(false);
  });
  it("boş liste güvenli", () => { expect(bankoAdayiTespit("KV-7", []).bankoAdayi).toBe(false); });
});
