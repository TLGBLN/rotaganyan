import { describe, expect, it } from "vitest";
import type { AccuraceRun, TargetRace } from "./types";
import { erkenProfil, hizFormu, kosuStat, onOranKosu, yarisTempo, zHiz } from "./v2";

// Sentetik 1300 m kum koşusu: 100 m checkpoint'ler (kümülatif ms). finishMs = son checkpoint.
function kosu(gunOnce: number, finishSn: number, sira400: number, saha = 10, ilk400Sn = 28.5, uzunluk = 1300): AccuraceRun {
  const cps = []; for (let m = 100; m <= uzunluk; m += 100) cps.push({ checkpoint: m, timeReal: Math.round(((m <= 400 ? ilk400Sn * (m / 400) : ilk400Sn + (finishSn - ilk400Sn) * ((m - 400) / (uzunluk - 400)))) * 1000), place: m === 400 ? sira400 : 5 });
  return { tjk: 1, date: new Date(Date.UTC(2026, 10, 16) - gunOnce * 86400000), length: uzunluk, surface: "KUM", breed: "INGILIZ", hippodrome: "Adana", going: "Normal", place: 3, fieldSize: saha, finishMs: Math.round(finishSn * 1000), checkpoints: cps, lateSegMs: null, lateSegScore: null, lateSegReason: null, earlyBin: 2 };
}
const hedef: TargetRace = { date: new Date(Date.UTC(2026, 10, 16)), length: 1300, surface: "KUM" };

describe("Accurace v2 / Tempo v2", () => {
  it("ham 100 m checkpoint'lerden süre, ESP hesaplanır; 1000 m altı veya eksik checkpoint → null (uydurma yok)", () => {
    const s = kosuStat(kosu(10, 80, 3))!; expect(s.D).toBe(1300); expect(s.pace).toBeCloseTo(80 / 1300 * 100, 6); expect(s.esp).toBeGreaterThan(0);
    expect(kosuStat(kosu(10, 55, 3, 10, 26, 900))).toBeNull();
    const eksik = kosu(10, 80, 3); eksik.checkpoints = eksik.checkpoints.filter((c) => c.checkpoint !== 900); expect(kosuStat(eksik)).toBeNull();
  });

  it("daha hızlı bitiren geçmiş koşu daha yüksek hız z'si ve hız formu verir (pozitif = referanstan hızlı)", () => {
    const hizli = kosu(10, 76, 3), yavas = kosu(10, 86, 3);
    expect(zHiz(hizli, kosuStat(hizli)!)!).toBeGreaterThan(zHiz(yavas, kosuStat(yavas)!)!);
    expect(hizFormu([hizli], hedef)!).toBeGreaterThan(hizFormu([yavas], hedef)!);
  });

  it("geçmiş yoksa / yarış günü ve sonrası koşular (as-of) → null; yalnız ÖNCEKİ koşular", () => {
    expect(hizFormu([], hedef)).toBeNull();
    expect(hizFormu([kosu(0, 80, 3), kosu(-5, 80, 3)], hedef)).toBeNull(); // yarış günü ve sonrası kullanılamaz
    expect(hizFormu([kosu(5, 80, 3)], hedef)).not.toBeNull();
  });

  it("yakın tarihli koşu daha ağır: 10 gün önceki hızlı koşu 200 gün öncekinden etkin", () => {
    const f = hizFormu([kosu(10, 76, 3), kosu(200, 90, 3)], hedef)!, g = hizFormu([kosu(200, 76, 3), kosu(10, 90, 3)], hedef)!;
    expect(f).toBeGreaterThan(g);
  });

  it("tek koşulu atın güveni (C) küçük: iki koşu aynı değerde olsa bile tek koşudan daha büyük |değer| verir", () => {
    const tek = hizFormu([kosu(10, 76, 3)], hedef)!, iki = hizFormu([kosu(10, 76, 3), kosu(20, 76, 3)], hedef)!;
    expect(Math.abs(iki)).toBeGreaterThan(Math.abs(tek));
  });

  it("öne bulunma oranı O = (N − sıra400)/(N − 1); lider 1.0, son 0.0; profil 0.5'e doğru küçültülür", () => {
    expect(onOranKosu(kosu(10, 80, 1, 10))).toBeCloseTo(1, 10); expect(onOranKosu(kosu(10, 80, 10, 10))).toBeCloseTo(0, 10); expect(onOranKosu(kosu(10, 80, 5, 10))).toBeCloseTo(5 / 9, 10);
    const p = erkenProfil([kosu(10, 80, 1)], hedef); expect(p.o!).toBeGreaterThan(0.5); expect(p.o!).toBeLessThan(1); // tek koşuda 1.0 değil
    expect(erkenProfil([], hedef)).toEqual({ o: null, e: null });
  });

  it("liderlik baskısı: ≥3 gözlemli at yoksa null (tempo sinyalleri boş); çok lider varsa önde giden sinyali düşük, arkadan gelen yüksek (baskı farkı × oran)", () => {
    expect(yarisTempo([{ o: 0.9, e: 0.2 }, { o: 0.8, e: 0.1 }]).atlar.every((a) => a.tempoOnBaski == null && a.tempoGeriBaski == null)).toBe(true);
    const kalabalik = yarisTempo(Array.from({ length: 8 }, (_, i) => ({ o: i < 6 ? 0.95 : 0.1, e: i < 6 ? 0.5 : -0.5 }))); // 6 lider
    expect(kalabalik.baski).not.toBeNull(); expect(kalabalik.atlar[0]!.tempoOnBaski!).toBeGreaterThan(kalabalik.atlar[7]!.tempoOnBaski!);
    expect(kalabalik.atlar[0]!.tempoErkenHiz!).toBeGreaterThan(kalabalik.atlar[7]!.tempoErkenHiz!); // saha ortalamasına göre fark
  });
});
