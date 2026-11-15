import { describe, it, expect } from "vitest";
import { kazananProfiliHesapla, sahaKovasi, type ProfilKosu } from "./kazanan-profili";

const at = (no: number, rank: number, fMean: number) => ({ no, rank, sinyal: { fMean } as Record<string, number | null> });
const kosu = (kazanan: number, g = "Handikap"): ProfilKosu => ({ grup: g, kazananNolar: [kazanan], atlar: [at(1, 1, 3), at(2, 2, 4), at(3, 3, 5), at(4, 4, 6), at(5, 5, 7)] });

describe("kazananProfiliHesapla", () => {
  it("fMean düşük=iyi: en düşük fMean'li kazanan → yüzdelik 1.0", () => {
    const o = kazananProfiliHesapla(Array.from({ length: 20 }, () => kosu(1)));
    const f = o.gruplar.find((g) => g.grup === "TÜMÜ")!.sinyaller.find((s) => s.kod === "fMean")!;
    expect(f.ort).toBe(1);
  });
  it("en kötü fMean'li kazanan → 0", () => {
    const o = kazananProfiliHesapla(Array.from({ length: 20 }, () => kosu(5)));
    expect(o.gruplar[0].sinyaller.find((s) => s.kod === "fMean")!.ort).toBe(0);
  });
  it("15'ten az örnekte ortalama gösterilmez (null)", () => {
    expect(kazananProfiliHesapla([kosu(1)]).gruplar[0].sinyaller.find((s) => s.kod === "fMean")!.ort).toBeNull();
  });
  it("saha kovası ve Top1/Top3 sayımı", () => {
    expect(sahaKovasi(6)).toBe(0); expect(sahaKovasi(12)).toBe(3); expect(sahaKovasi(15)).toBe(4);
    const o = kazananProfiliHesapla([kosu(1), kosu(3), kosu(5)]);
    const b = o.saha[0]; // 5 atlı → ≤7
    expect(b).toMatchObject({ kosu: 3, top1: 1, top3: 2 });
  });
});
