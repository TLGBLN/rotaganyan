import { describe, expect, it } from "vitest";
import { akranDagilimi, duzelt, ebKestir, etkinOrnek, pedigriGuven, pedigriKalite, uzmanlasma, yuzdelikPuan, type Akran } from "./pedigri-puan";

// Gerçekçi bir kategori: gerçek yayılım var (bazı soy hatları gerçekten iyi/kötü)
const kategori: Akran[] = [
  ...Array.from({ length: 30 }, (_, i) => ({ starts: 200 + i * 5, wins: Math.round((200 + i * 5) * (0.03 + 0.005 * i)), yavru: 40 })),
  { starts: 10, wins: 2, yavru: 3 }, // küçük örnek, yüksek ham oran
];

describe("pedigri-puan", () => {
  it("etkin örnek: yavru başına koşu arttıkça küçülür; yavru bilinmiyorsa aynen kalır; ρ=0 → n", () => {
    expect(etkinOrnek(100, 0)).toBe(100);
    expect(etkinOrnek(100, 50, 0)).toBe(100);
    expect(etkinOrnek(100, 50)).toBeGreaterThan(etkinOrnek(100, 5)); // 5 yavru 100 koşu → daha az bağımsız bilgi
    expect(etkinOrnek(60, 6)).toBeLessThan(60);
    expect(etkinOrnek(0, 3)).toBe(0);
  });

  it("EB: P0 koşu-ağırlıklı ortalama; yayılım varsa k sonlu; yayılım yoksa k üst sınırda (C≈0)", () => {
    const eb = ebKestir(kategori)!;
    const N = kategori.reduce((s, x) => s + x.starts, 0), W = kategori.reduce((s, x) => s + x.wins, 0);
    expect(eb.p0).toBeCloseTo(W / N, 10);
    expect(eb.k).toBeGreaterThan(0); expect(eb.k).toBeLessThan(5000);
    const duz = ebKestir(Array.from({ length: 20 }, () => ({ starts: 100, wins: 10, yavru: 20 })))!;
    expect(duz.k).toBe(5000);
    expect(ebKestir(kategori.slice(0, 2))).toBeNull(); // <3 akran
  });

  it("düzeltme TEK kez: P* = P0 + C·(ham − P0); küçük örnek kategori ortalamasına çekilir, büyük örnek ham orana yakın kalır", () => {
    const eb = ebKestir(kategori)!;
    const kucuk = duzelt(2, 10, 3, eb)!, buyuk = duzelt(60, 300, 40, eb)!;
    expect(kucuk.C).toBeLessThan(buyuk.C);
    expect(kucuk.pYildiz).toBeCloseTo(eb.p0 + kucuk.C * (0.2 - eb.p0), 12);
    expect(Math.abs(kucuk.pYildiz - eb.p0)).toBeLessThan(Math.abs(0.2 - eb.p0)); // %20 ham → çekildi
    expect(duzelt(1, 0, 1, eb)).toBeNull();
  });

  it("yüzdelik puan: monoton; en iyi ≈ yüksek, en kötü ≈ düşük; ortalama düzeyde ≈ 50 civarı", () => {
    const eb = ebKestir(kategori)!, d = akranDagilimi(kategori, eb);
    const en = Math.max(...d.map((x) => x.pYildiz)), az = Math.min(...d.map((x) => x.pYildiz));
    expect(yuzdelikPuan(en + 1, d)).toBeCloseTo(100, 6);
    expect(yuzdelikPuan(az - 1, d)).toBeCloseTo(0, 6);
    expect(yuzdelikPuan(eb.p0, d)!).toBeGreaterThan(20); expect(yuzdelikPuan(eb.p0, d)!).toBeLessThan(80);
    expect(yuzdelikPuan(eb.p0 + 0.01, d)!).toBeGreaterThanOrEqual(yuzdelikPuan(eb.p0, d)!);
    expect(yuzdelikPuan(0.1, [])).toBeNull();
  });

  it("PED_KALITE: eksik hat sıfırlanmaz (kalanların ortalaması); PEDIGRI_GUVEN: eksik hattın güveni 0 sayılır", () => {
    expect(pedigriKalite([60, null, 30])).toBe(45);
    expect(pedigriKalite([null, null, null])).toBeNull();
    expect(pedigriGuven([0.6, null, 0.3])).toBeCloseTo(30, 10);
    expect(pedigriGuven([0.5, 0.5, 0.5])).toBeCloseTo(50, 10);
  });

  it("uzmanlaşma: bağlam − bağlam DIŞI kendi oranı; referans < 20 koşu ise null; kalite ile KARIŞTIRILMAZ", () => {
    const u = uzmanlasma({ starts: 92, wins: 11 }, { starts: 361, wins: 52 })!; // GENERAL QUARTERS 2026: bağlam 11/92, dışı 41/269
    expect(u.refK).toBeCloseTo(41 / 269, 10);
    expect(u.farkPp).toBeCloseTo((11 / 92 - 41 / 269) * 100, 8);
    expect(u.farkPp).toBeLessThan(0);
    expect(uzmanlasma({ starts: 10, wins: 1 }, { starts: 20, wins: 2 })).toBeNull();
    expect(uzmanlasma({ starts: 0, wins: 0 }, { starts: 50, wins: 5 })).toBeNull();
  });
});
