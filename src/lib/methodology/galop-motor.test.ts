import { describe, expect, it } from "vitest";
import { galopKalitesiV1, galopOzellik, tekGalopKalitesi, type GalopHam } from "./galop-motor";

// Referans (galop-referans.json) grubu: INGILIZ|600|Kum|G|x → medyan 38.5 sn, σ 1.4826; regresyon INGILIZ|600|Kum: T400 ≈ 16.51 + 0.2294·T600 (σ 0.7753)
const sn = (s: number) => `0.${Math.floor(s)}.${String(Math.round((s % 1) * 100)).padStart(2, "0")}`;
const galop = (gunOnce: number, t600: number, t400: number, form: string | null = "R", track = "Galop"): GalopHam => ({
  date: new Date(Date.UTC(2026, 10, 14) - gunOnce * 864e5), track, form, splits: { "600": sn(t600), "400": sn(t400), pist: "Kum", ic_dis: "" },
});

describe("Galop Analiz Motoru v1.0", () => {
  it("galop yoksa kalite null", () => {
    expect(galopKalitesiV1([], "INGILIZ").kalite).toBeNull();
  });

  it("medyan dereceli galobun hız puanı ≈ 50, daha hızlısı daha yüksek", () => {
    const orta = tekGalopKalitesi(galop(1, 38.5, 25.4), "INGILIZ");
    const hizli = tekGalopKalitesi(galop(1, 37.2, 25.4), "INGILIZ");
    expect(orta.pHiz).toBeGreaterThan(49); expect(orta.pHiz).toBeLessThan(51);
    expect(hizli.pHiz).toBeGreaterThan(80); expect(hizli.pHiz).toBeLessThan(82); // (38.5−37.2)/1.4826 = 0.877 → Φ ≈ 81
    expect(hizli.q!).toBeGreaterThan(orta.q!);
  });

  it("aynı toplam derecede daha iyi bitiren (son 400 kısa) atın kapanış puanı daha yüksek", () => {
    const iyi = tekGalopKalitesi(galop(1, 37.2, 24.2), "INGILIZ");
    const kotu = tekGalopKalitesi(galop(1, 37.2, 24.7), "INGILIZ");
    expect(iyi.pHiz).toBeCloseTo(kotu.pHiz!, 6);
    expect(iyi.pKapanis!).toBeGreaterThan(kotu.pKapanis!);
    expect(iyi.q!).toBeGreaterThan(kotu.q!);
  });

  it("efor: kod yoksa bileşen atlanır (sıfır verilmez), kod varsa 55-90 puanı karışır", () => {
    const kodsuz = tekGalopKalitesi(galop(1, 37.2, 25.0, null), "INGILIZ");
    expect(kodsuz.pEfor).toBeNull();
    // yalnız hız+kapanış (0.50/0.25) ağırlığı yeniden normalize edilir
    expect(kodsuz.q).toBeCloseTo((0.5 * kodsuz.pHiz! + 0.25 * kodsuz.pKapanis!) / 0.75, 6);
    const r = tekGalopKalitesi(galop(1, 37.2, 25.0, "R"), "INGILIZ"), cr = tekGalopKalitesi(galop(1, 37.2, 25.0, "ÇR"), "INGILIZ"), c = tekGalopKalitesi(galop(1, 37.2, 25.0, "Ç"), "INGILIZ");
    expect(r.pEfor).toBe(85); expect(cr.pEfor).toBe(90); expect(c.pEfor).toBe(55);
    expect(r.q!).toBeGreaterThan(c.q!);
  });

  it("Kenter idmanı güvenilir hız testi sayılmaz", () => {
    expect(tekGalopKalitesi(galop(1, 37.2, 25.0, "R", "Kenter"), "INGILIZ").q).toBeNull();
  });

  it("400m'lik galopta kapanış hesaplanmaz (toplam derece = son 400)", () => {
    const g: GalopHam = { date: new Date(), track: "Sprint", form: "R", splits: { "400": "0.25.00", pist: "Kum", ic_dis: "" } };
    expect(galopOzellik(g)!.d).toBe("400");
    expect(tekGalopKalitesi(g, "INGILIZ").pKapanis).toBeNull();
  });

  it("tek galopta kalite = Q1, trend yok ve ceza yok", () => {
    const s = galopKalitesiV1([galop(2, 37.2, 24.2)], "INGILIZ");
    expect(s.trend).toBeNull(); expect(s.kalite).toBeCloseTo(s.qler[0]!, 9);
  });

  it("≥2 galopta GALOP_KALITE = 0.9·Q_ort + 0.1·clip(50+1.5·(Q1−Q2), 0, 100); en yeni galop Q1 (sıra girdiye bağlı değil)", () => {
    const eski = galop(8, 39.5, 26.0, "Ç"), yeni = galop(2, 37.2, 24.2, "R");
    const a = galopKalitesiV1([eski, yeni], "INGILIZ"), b = galopKalitesiV1([yeni, eski], "INGILIZ");
    expect(a.kalite).toBeCloseTo(b.kalite!, 9);
    const [q1, q2] = a.qler; const qOrt = (0.5 * q1! + 0.3 * q2!) / 0.8;
    const trend = Math.max(0, Math.min(100, 50 + 1.5 * (q1! - q2!)));
    expect(a.kalite).toBeCloseTo(0.9 * qOrt + 0.1 * trend, 9);
    expect(q1!).toBeGreaterThan(q2!); // iyileşen at → pozitif trend
  });

  it("yalnız son 3 kullanılabilir galop kullanılır (0.5/0.3/0.2); kullanılamayan (Kenter) atlanır", () => {
    const g = [galop(1, 37.2, 24.4), galop(3, 38.0, 25.0, "R", "Kenter"), galop(5, 38.5, 25.5), galop(7, 39.0, 26.0), galop(9, 36.0, 24.0)];
    const s = galopKalitesiV1(g, "INGILIZ");
    expect(s.qler).toHaveLength(3); // Kenter atlandı, en eski (9 gün önceki çok hızlı) dışarıda
  });

  it("referansı olmayan grup (bilinmeyen ırk/mesafe) → null; sıfır puan verilmez", () => {
    expect(tekGalopKalitesi(galop(1, 37.2, 24.2), "BILINMEYEN").q).toBeNull();
  });
});
