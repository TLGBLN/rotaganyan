import { describe, expect, it } from "vitest";
import { CANLI_AGIRLIK, S2_AGIRLIK, OLASILIK_TOLERANSI_PP, accBitis, kiyasla, segmentOf, skorla, type KiyasGirdi, type SnapSinyal } from "./s2-golge";

// Deterministik sentetik yarış: canlı 24 sinyalin hepsi var; kayıtlı olasılık = canlı modelin KENDİ olasılığı (replay doğru olmalı)
function atSinyalleri(tohum: number): SnapSinyal[] {
  return CANLI_AGIRLIK.featureNames.map((kod, i) => ({ kod, hamDeger: CANLI_AGIRLIK.means[i]! + CANLI_AGIRLIK.stds[i]! * Math.sin(tohum * 7.3 + i * 1.7), observed: true, reliability: i % 5 === 0 ? 0.6 : 1 }));
}
function yaris(n = 8, tip = "ŞARTLI 3", kazanan = 1): KiyasGirdi {
  const sinyaller = Array.from({ length: n }, (_, k) => atSinyalleri(k + 1));
  const skor = sinyaller.map((s) => skorla(CANLI_AGIRLIK, s)!); const m = Math.max(...skor); const e = skor.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0);
  return { tip, kazananlar: [kazanan], atlar: sinyaller.map((s, k) => ({ no: k + 1, kayitliP: (e[k]! / z) * 100, sinyaller: s })) };
}

describe("S2 gölge kıyas — geçerlilik kuralları", () => {
  it("kayıtlı olasılıkla birebir uyuşan yarış GEÇERLİ; S2 ve canlı olasılıkları 1'e (yüzde 100'e) toplanır", () => {
    const s = kiyasla(yaris());
    expect(s.durum).toBe("GECERLI"); if (s.durum !== "GECERLI") return;
    expect(s.maxFarkPp).toBeLessThan(1e-9);
    expect(s.atlar.reduce((p, a) => p + a.canliP, 0)).toBeCloseTo(100, 6); expect(s.atlar.reduce((p, a) => p + a.s2P, 0)).toBeCloseTo(100, 6);
  });
  it("YALNIZ favori değil TÜM atlar kontrol edilir: favori dışı bir atın kayıtlı olasılığı sapıyorsa yarış GEÇERSİZ", () => {
    const g = yaris(); const fav = g.atlar.reduce((b, a) => ((a.kayitliP ?? 0) > (b.kayitliP ?? 0) ? a : b)).no;
    const diger = g.atlar.find((a) => a.no !== fav)!; diger.kayitliP = (diger.kayitliP ?? 0) + OLASILIK_TOLERANSI_PP * 3; // favoriye dokunulmadı
    const s = kiyasla(g); expect(s.durum).toBe("GECERSIZ"); expect(s.durum === "GECERSIZ" && s.neden).toBe("OLASILIK_UYUSMUYOR");
  });
  it("gözlemli sinyalin reliability'si bilinmiyorsa (null) TAM GÜVEN varsayılmaz → GEÇERSİZ", () => {
    const g = yaris(); g.atlar[2]!.sinyaller.find((s) => s.kod === "ACC_CLOSE_RES")!.reliability = null;
    const s = kiyasla(g); expect(s.durum).toBe("GECERSIZ"); expect(s.durum === "GECERSIZ" && s.neden).toBe("RELIABILITY_BILINMIYOR");
  });
  it("gözlemsiz sinyalin reliability'si null olabilir (katkı zaten 0) → GEÇERSİZ SAYILMAZ", () => {
    const g = yaris(); const s0 = g.atlar[0]!.sinyaller.find((s) => s.kod === "dususDelta")!; s0.observed = false; s0.reliability = null;
    // kayıtlı olasılığı güncel skora göre yeniden üret (gözlemsiz sinyal katkısı kalktı)
    const skor = g.atlar.map((a) => skorla(CANLI_AGIRLIK, a.sinyaller)!); const m = Math.max(...skor); const e = skor.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); g.atlar.forEach((a, i) => (a.kayitliP = (e[i]! / z) * 100));
    expect(kiyasla(g).durum).toBe("GECERLI");
  });
  it("canlı 24 sinyalden biri snapshot'ta yoksa (v2 öncesi kayıt) → GEÇERSİZ", () => {
    const g = yaris(); g.atlar[1]!.sinyaller = g.atlar[1]!.sinyaller.filter((s) => s.kod !== "tempoOnOran");
    const s = kiyasla(g); expect(s.durum).toBe("GECERSIZ"); expect(s.durum === "GECERSIZ" && s.neden).toBe("ESKI_SINYAL_KAYDI");
  });
  it("Handikap ve ŞARTLI 1/27 KAPSAM_DIŞI; Maiden / ŞARTLI 19 varsayılan modelde (ŞARTLI 19, 'ŞARTLI 1' alt dizgisine düşmez)", () => {
    expect(kiyasla(yaris(8, "Handikap 16")).durum).toBe("KAPSAM_DISI"); expect(kiyasla(yaris(8, "ŞARTLI 1")).durum).toBe("KAPSAM_DISI"); expect(kiyasla(yaris(8, "ŞARTLI 27")).durum).toBe("KAPSAM_DISI");
    expect(segmentOf("ŞARTLI 19")).toBe("varsayilan"); expect(segmentOf("Maiden")).toBe("varsayilan"); expect(kiyasla(yaris(8, "Maiden")).durum).toBe("GECERLI");
  });
  it("kayıtlı olasılık (scoreExact) eksikse GEÇERSİZ — kıyas olasılıksız yapılmaz", () => { const g = yaris(); g.atlar[3]!.kayitliP = null; const s = kiyasla(g); expect(s.durum === "GECERSIZ" && s.neden).toBe("KAYITLI_OLASILIK_YOK"); });
  it("kazanan atlar arasında değilse GEÇERSİZ", () => { const g = yaris(); g.kazananlar = [99]; const s = kiyasla(g); expect(s.durum === "GECERSIZ" && s.neden).toBe("KAZANAN_YOK"); });
});

describe("accBitis (ACC_CLOSE_RES + ACC_LATE birleşimi)", () => {
  const mk = (kod: string, ham: number, rel: number | null, observed = true): SnapSinyal => ({ kod, hamDeger: ham, observed, reliability: rel });
  const iC = CANLI_AGIRLIK.featureNames.indexOf("ACC_CLOSE_RES"), iL = CANLI_AGIRLIK.featureNames.indexOf("ACC_LATE");
  const zc = (ham: number, rel: number) => rel * (ham - CANLI_AGIRLIK.means[iC]!) / CANLI_AGIRLIK.stds[iC]!, zl = (ham: number, rel: number) => rel * (ham - CANLI_AGIRLIK.means[iL]!) / CANLI_AGIRLIK.stds[iL]!;
  it("ikisi de varsa güvenirlik ağırlıklı z'lerin ortalaması", () => expect(accBitis(mk("ACC_CLOSE_RES", 0.7, 0.5), mk("ACC_LATE", 0.3, 1))).toBeCloseTo((zc(0.7, 0.5) + zl(0.3, 1)) / 2, 10));
  it("yalnız biri gözlemliyse o tek başına (yarıya BÖLÜNMEZ)", () => expect(accBitis(mk("ACC_CLOSE_RES", 0.7, 0.5), mk("ACC_LATE", 0, 1, false))).toBeCloseTo(zc(0.7, 0.5), 10));
  it("ikisi de yoksa null; reliability'si bilinmeyen bileşen tam güvenle SAYILMAZ", () => {
    expect(accBitis(mk("ACC_CLOSE_RES", 0, 1, false), undefined)).toBeNull();
    expect(accBitis(mk("ACC_CLOSE_RES", 0.7, null), mk("ACC_LATE", 0.3, 1))).toBeCloseTo(zl(0.3, 1), 10); // null olan hiç sayılmaz, 1 varsayılmaz
  });
  it("S2 dosyası 17 sinyal, accBitis içerir; atılan sinyaller yok", () => {
    expect(S2_AGIRLIK.featureNames).toHaveLength(17); expect(S2_AGIRLIK.featureNames).toContain("accBitis");
    for (const n of ["tempoOnBaski", "tempoGeriBaski", "zeminToleransi", "zeminMesafeDeneyim", "jokeyFormuGenel", "hizDerecesi", "ACC_CLOSE_RES", "ACC_LATE"]) expect(S2_AGIRLIK.featureNames).not.toContain(n);
  });
});
