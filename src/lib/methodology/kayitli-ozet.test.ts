import { describe, it, expect } from "vitest";
import { kayitliOzetleriKur } from "./kayitli-ozet";

const sin = (kod: string, hamDeger: number, katki: number, observed = true) => ({ kod, etiket: kod, hamDeger, standartDeger: katki, katki, observed, reliability: 1, beta: 1 });
const at = (no: number, sira: number, olasilik: number, tum?: ReturnType<typeof sin>[]) => ({ no, ad: `At${no}`, teknikSira: sira, karar: "x", olasilik, details: {} as never, tumSinyaller: tum });

describe("kayıtlı analizde Race-Day Analysis özeti", () => {
  const tum = (k: number) => [sin("hpRel", 5, k), sin("kgsLog", 3, k / 2), sin("idmJokey", 0, -0.01)];
  it("kaydedilmiş sinyali olan atlara analysisOzet kurar", () => {
    const r = kayitliOzetleriKur([at(1, 1, 0.3, tum(0.3)), at(2, 2, 0.2, tum(0.1)), at(3, 3, 0.1, tum(-0.1))] as never, "ŞARTLI 19");
    expect(r.every((a) => a.analysisOzet)).toBe(true);
    expect(r[0].analysisOzet!.butunluk.usedFamilyCount).toBeGreaterThan(0);
  });
  it("sinyal anlık görüntüsü yoksa (eski kayıt) özet kurulmaz ve hata vermez", () => {
    const r = kayitliOzetleriKur([at(1, 1, 0.3), at(2, 2, 0.2)] as never, "ŞARTLI 19");
    expect(r.every((a) => a.analysisOzet === undefined)).toBe(true);
  });
  it("saha-sabit idmJokey İDMAN'ı negatif kanıt yapmaz", () => {
    const r = kayitliOzetleriKur([at(1, 1, 0.3, tum(0.3)), at(2, 2, 0.2, tum(0.1)), at(3, 3, 0.1, tum(-0.1))] as never, "ŞARTLI 19");
    expect(r[0].analysisOzet!.enGucluNegatif.some((l) => l.family === "IDMAN")).toBe(false);
  });
});
