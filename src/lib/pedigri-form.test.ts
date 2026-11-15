import { describe, expect, it } from "vitest";
import {
  ESIK_BAGLAM, ESIK_SEVIYE, K_BAGLAM, guven, hesaplaBaglam, hesaplaSeviye, mesafeBandi, mesafeEsdeger,
  pedigriAdNormalize, siniflandir, tjkGrupId, tjkPistId,
} from "./pedigri-form";

describe("guven", () => {
  it("n=0 → 0, n=k → 0.5, n→∞ → 1", () => {
    expect(guven(0, 100)).toBe(0);
    expect(guven(100, 100)).toBeCloseTo(0.5, 10);
    expect(guven(1e9, 100)).toBeCloseTo(1, 6);
  });
});

describe("pedigriAdNormalize", () => {
  it("ülke ekini atar ve TR harflerini katlar", () => {
    expect(pedigriAdNormalize("LION HEART (USA)")).toBe("LION HEART");
    expect(pedigriAdNormalize("DOĞANTÜRKBEYİ")).toBe("DOGANTURKBEYI");
    expect(pedigriAdNormalize("  hız   delisi ")).toBe("HIZ DELISI");
    expect(pedigriAdNormalize("SIDNEY'S CANDY (USA)")).toBe("SIDNEY'S CANDY");
  });
  it("ortadaki parantezi atmaz, yalnız sondaki ülke ekini", () => {
    expect(pedigriAdNormalize("AMARİ")).toBe("AMARI");
  });
});

describe("tjkGrupId / tjkPistId", () => {
  it("İngiliz: 2→1, 3→3, 4+→5", () => {
    expect(tjkGrupId("INGILIZ", 2)).toBe(1);
    expect(tjkGrupId("INGILIZ", 3)).toBe(3);
    expect(tjkGrupId("INGILIZ", 4)).toBe(5);
    expect(tjkGrupId("INGILIZ", 9)).toBe(5);
  });
  it("Arap: 3→6, 4→8, 5+→10; 2 yaşlı Arap grubu yok (null)", () => {
    expect(tjkGrupId("ARAP", 3)).toBe(6);
    expect(tjkGrupId("ARAP", 4)).toBe(8);
    expect(tjkGrupId("ARAP", 5)).toBe(10);
    expect(tjkGrupId("ARAP", 2)).toBeNull();
  });
  it("geçersiz yaş → null", () => {
    expect(tjkGrupId("INGILIZ", NaN)).toBeNull();
    expect(tjkGrupId("INGILIZ", 1)).toBeNull();
  });
  it("pist", () => {
    expect(tjkPistId("CIM")).toBe(1);
    expect(tjkPistId("KUM")).toBe(2);
    expect(tjkPistId("SENTETIK")).toBe(4);
    expect(tjkPistId("X")).toBeNull();
  });
});

describe("siniflandir", () => {
  const e = ESIK_SEVIYE.SIRE;
  it("eşik sınırları: ≥ pozitif eşikler dahil, nötr aralığı açık", () => {
    expect(siniflandir(e.cgPoz, e)).toBe("ÇOK GÜÇLÜ POZİTİF");
    expect(siniflandir(e.poz, e)).toBe("POZİTİF");
    expect(siniflandir(0, e)).toBe("NÖTR");
    // Simetri: pozitif tarafta eşiğin kendisi POZİTİF (≥), negatif tarafta eşiğin kendisi NEGATİF (≤).
    expect(siniflandir(e.neg + 0.01, e)).toBe("NÖTR");
    expect(siniflandir(e.neg, e)).toBe("NEGATİF");
    expect(siniflandir(e.cgNeg + 0.01, e)).toBe("NEGATİF");
    expect(siniflandir(e.cgNeg, e)).toBe("ÇOK GÜÇLÜ NEGATİF");
  });
});

describe("hesaplaSeviye", () => {
  it("koşu yoksa null", () => { expect(hesaplaSeviye("SIRE", { starts: 0, wins: 0 })).toBeNull(); });
  it("büyük örnekte güven ≈ 1, delta = k − popülasyon", () => {
    const s = hesaplaSeviye("SIRE", { starts: 1000, wins: 200 })!;
    expect(s.k).toBeCloseTo(0.2, 10);
    expect(s.delta).toBeCloseTo(0.2 - 0.1003, 6);
    expect(s.guven).toBeCloseTo(1000 / 1065, 6);
    expect(s.etkinPp).toBeCloseTo(s.delta * s.guven * 100, 8);
    expect(s.durum).toBe("ÇOK GÜÇLÜ POZİTİF");
  });
  it("küçük örnek büzülür: 1 koşu 1 galibiyet çok güçlü çıkmaz", () => {
    const s = hesaplaSeviye("SIRE", { starts: 1, wins: 1 })!;
    expect(s.guven).toBeCloseTo(1 / 66, 6);
    expect(s.etkinPp).toBeLessThan(2); // ham Δ +90 pp, büzülmüş < 2 pp
  });
  it("popülasyon ortalamasında nötr", () => {
    expect(hesaplaSeviye("DAM", { starts: 500, wins: 50 })!.durum).toBe("NÖTR");
  });
});

describe("hesaplaBaglam", () => {
  it("bağlamda koşu yoksa null", () => { expect(hesaplaBaglam("SIRE_GRUP", { starts: 0, wins: 0 }, { starts: 300, wins: 30 })).toBeNull(); });
  it("referans (bağlam dışı) örneği 20'den azsa null", () => {
    expect(hesaplaBaglam("SIRE_GRUP", { starts: 90, wins: 9 }, { starts: 100, wins: 10 })).toBeNull(); // ref = 10 koşu
    expect(hesaplaBaglam("SIRE_GRUP", { starts: 80, wins: 8 }, { starts: 100, wins: 10 })).not.toBeNull(); // ref = 20 koşu (sınır dahil)
  });
  it("tutarsız veri (bağlam galibiyeti toplamı aşıyor) null", () => {
    expect(hesaplaBaglam("SIRE_GRUP", { starts: 50, wins: 12 }, { starts: 300, wins: 10 })).toBeNull();
  });
  it("formül: ref = (toplam − bağlam); güven = 1/(1 + k(1/n_ctx + 1/n_ref))", () => {
    const b = hesaplaBaglam("SIRE_GRUP_PIST", { starts: 100, wins: 20 }, { starts: 300, wins: 50 })!;
    expect(b.refStart).toBe(200); expect(b.refWin).toBe(30);
    expect(b.ctxK).toBeCloseTo(0.2, 10); expect(b.refK).toBeCloseTo(0.15, 10); expect(b.delta).toBeCloseTo(0.05, 10);
    expect(b.guven).toBeCloseTo(1 / (1 + K_BAGLAM.SIRE_GRUP_PIST * (1 / 100 + 1 / 200)), 10);
    expect(b.etkinPp).toBeCloseTo(b.delta * b.guven * 100, 8);
    expect(b.durum).toBe(siniflandir(b.etkinPp, ESIK_BAGLAM.SIRE_GRUP_PIST));
  });
  it("küçük referans güveni düşürür (aynı bağlam, referans 72 vs 700)", () => {
    const kucuk = hesaplaBaglam("SIRE_PIST", { starts: 205, wins: 46 }, { starts: 277, wins: 49 })!; // ref 72 koşu
    const buyuk = hesaplaBaglam("SIRE_PIST", { starts: 205, wins: 46 }, { starts: 905, wins: 49 + 100 })!; // ref 700 koşu
    expect(kucuk.guven).toBeLessThan(buyuk.guven);
  });
  it("bağlam toplamla aynı olursa (ref 0) null", () => {
    expect(hesaplaBaglam("SIRE_GRUP", { starts: 100, wins: 10 }, { starts: 100, wins: 10 })).toBeNull();
  });
});

describe("mesafeBandi", () => {
  it("bant sınırları", () => {
    expect(mesafeBandi(900)).toBe(1); expect(mesafeBandi(1000)).toBe(1); expect(mesafeBandi(1300)).toBe(1);
    expect(mesafeBandi(1400)).toBe(2); expect(mesafeBandi(1600)).toBe(2);
    expect(mesafeBandi(1700)).toBe(3); expect(mesafeBandi(2000)).toBe(3);
    expect(mesafeBandi(2100)).toBe(4); expect(mesafeBandi(3200)).toBe(4);
  });
});

describe("mesafeEsdeger (hibrit: aynı bant ±200, bant atlayınca ±100, sınır dahil)", () => {
  it("aynı bant ±200 eşdeğer", () => {
    expect(mesafeEsdeger(1400, 1600)).toBe(true);
    expect(mesafeEsdeger(1600, 1400)).toBe(true);
    expect(mesafeEsdeger(1700, 1900)).toBe(true);
    expect(mesafeEsdeger(1000, 1200)).toBe(true);
    expect(mesafeEsdeger(1200, 1200)).toBe(true);
  });
  it("aynı bantta 200 m'den fazla fark eşdeğer değil", () => {
    expect(mesafeEsdeger(1700, 2000)).toBe(false); // aynı bant, 300 m
    expect(mesafeEsdeger(1000, 1300)).toBe(false);
  });
  it("bant atlayınca yalnız ±100 eşdeğer", () => {
    expect(mesafeEsdeger(1300, 1400)).toBe(true); // 100 m, bant atlar
    expect(mesafeEsdeger(2000, 2100)).toBe(true);
    expect(mesafeEsdeger(1200, 1400)).toBe(false); // 200 m, bant atlar → NOT eşdeğer (metindeki örnekle çelişen tablo kararı)
    expect(mesafeEsdeger(1600, 1800)).toBe(false);
    expect(mesafeEsdeger(1900, 2100)).toBe(false);
  });
  it("simetrik", () => {
    for (const [a, b] of [[1200, 1400], [1600, 1700], [1400, 1500], [2000, 2200]]) expect(mesafeEsdeger(a, b)).toBe(mesafeEsdeger(b, a));
  });
});
