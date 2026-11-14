import { describe, it, expect } from "vitest";
import { ayakNedeniBelirle, MUDAHALE_EDILEBILIR, kuponNedenOzeti, sorunlariSirala, type OldurenAyak, type RcaSorun } from "./rca-cekirdek";
import { SINYAL_KAYNAGI } from "./rca-cekirdek";
import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";

const g = (o: Partial<Parameters<typeof ayakNedeniBelirle>[0]> = {}) => ({ modelSira: 9, piyasaSira: 8, ayagaYazilan: 4, ganyan: 25, eksikSinyal: 0, ...o });

describe("ayakNedeniBelirle (sıralı kurallar)", () => {
  it("model ilk 4'e koymuş VE sırası ≤ yazılan at sayısı → gerçek kupon dağıtım hatası (veri/piyasa ne olursa olsun)", () => {
    expect(ayakNedeniBelirle(g({ modelSira: 3, ayagaYazilan: 3, eksikSinyal: 5, piyasaSira: 1 })).neden).toBe("KUPON_DAGILIMI");
    expect(ayakNedeniBelirle(g({ modelSira: 4, ayagaYazilan: 4 })).neden).toBe("KUPON_DAGILIMI");
    expect(ayakNedeniBelirle(g({ modelSira: 2, ayagaYazilan: 4 })).neden).toBe("KUPON_DAGILIMI");
    expect(ayakNedeniBelirle(g({ modelSira: 5 })).neden).not.toBe("KUPON_DAGILIMI");
  });
  it("model ilk 4'e koymuş ama sırası > yazılan at sayısı → bütçe sınırı (beklenen, müdahale edilebilir DEĞİL)", () => {
    expect(ayakNedeniBelirle(g({ modelSira: 2, ayagaYazilan: 1 })).neden).toBe("KUPON_BUTCE_SINIRI");
    expect(ayakNedeniBelirle(g({ modelSira: 4, ayagaYazilan: 2 })).neden).toBe("KUPON_BUTCE_SINIRI");
    expect(MUDAHALE_EDILEBILIR.has("KUPON_BUTCE_SINIRI")).toBe(false);
    expect(MUDAHALE_EDILEBILIR.has("KUPON_DAGILIMI")).toBe(true);
  });
  it("model 7+ ve ≥3 gözlemsiz sinyal → veri eksikliği", () => {
    expect(ayakNedeniBelirle(g({ modelSira: 8, eksikSinyal: 3 })).neden).toBe("VERI_EKSIK");
    expect(ayakNedeniBelirle(g({ modelSira: 8, eksikSinyal: 2, piyasaSira: 8 })).neden).not.toBe("VERI_EKSIK");
  });
  it("piyasa ilk 3'te, model ilk 4 dışı → model piyasadan kötü gördü", () => {
    expect(ayakNedeniBelirle(g({ modelSira: 9, piyasaSira: 2 })).neden).toBe("MODEL_PIYASA_GERI");
  });
  it("piyasa da görmediyse veya ganyan ≥10 → öngörülemez", () => {
    expect(ayakNedeniBelirle(g({ piyasaSira: 7, ganyan: null })).neden).toBe("ONGORULEMEZ");
    expect(ayakNedeniBelirle(g({ piyasaSira: null, ganyan: 18 })).neden).toBe("ONGORULEMEZ");
  });
  it("hiçbiri değilse belirsiz (AGF yok, düşük ganyan)", () => {
    expect(ayakNedeniBelirle(g({ piyasaSira: null, ganyan: 4 })).neden).toBe("BELIRSIZ");
    expect(ayakNedeniBelirle(g({ piyasaSira: 4, ganyan: 6 })).neden).toBe("BELIRSIZ");
  });
});

const ayak = (kuponId: string, neden: OldurenAyak["neden"], tekAyak = false): OldurenAyak => ({
  kuponId, hipodrom: "T", tarih: "2026-11-12", raceNo: 1, kazananNo: 1, modelSira: 5, piyasaSira: 5, ayagaYazilan: 3, ganyan: 5, eksikSinyal: 0, neden, aciklama: "x", tekAyak, donem: "d",
});

describe("kuponNedenOzeti (Pareto)", () => {
  it("nedenleri sayar, çoktan aza sıralar, tek-ayak kuponları tekil sayar", () => {
    const o = kuponNedenOzeti([ayak("a", "KUPON_DAGILIMI", true), ayak("b", "KUPON_DAGILIMI"), ayak("c", "ONGORULEMEZ", true), ayak("c", "ONGORULEMEZ"), ayak("e", "ONGORULEMEZ"), ayak("d", "MODEL_PIYASA_GERI")]);
    expect(o.toplamAyak).toBe(6);
    expect(o.nedenler[0].neden).toBe("ONGORULEMEZ"); expect(o.nedenler[0].sayi).toBe(3);
    expect(o.tekAyakKupon).toBe(2); // a ve c (tekil)
    expect(o.baskin).toBe("KUPON_DAGILIMI"); // müdahale edilebilir en büyük
    expect(o.mudahaleOrani).toBeCloseTo(3 / 6, 10);
  });
  it("boş girdi güvenli", () => {
    const o = kuponNedenOzeti([]); expect(o.toplamAyak).toBe(0); expect(o.baskin).toBeNull(); expect(o.mudahaleOrani).toBe(0);
  });
});

describe("sorunlariSirala", () => {
  const s = (kod: string, siddet: RcaSorun["siddet"]): RcaSorun => ({ kod, baslik: kod, kategori: "VERI", siddet, durum: "SORUN", etki: "", kanit: {}, zincir: [], kokNeden: "", cozum: "", otomatikCozum: null, dogrulama: "" });
  it("şiddete göre (kritik önce), eşitse başlığa göre", () => {
    expect(sorunlariSirala([s("b", "ORTA"), s("a", "KRITIK"), s("c", "ORTA")]).map((x) => x.kod)).toEqual(["a", "b", "c"]);
  });
});

describe("KORUMA: canlı modelin her sinyali için veri kaynağı tanımlı (sinyal düşüşü kök nedene bağlanabilsin)", () => {
  it("varsayılan model featureNames SINYAL_KAYNAGI'nda", () => {
    const eksik = (safW as { featureNames: string[] }).featureNames.filter((f) => !SINYAL_KAYNAGI[f]);
    expect(eksik).toEqual([]);
  });
});

import { kayitGecisi, type KayitSatiri } from "./rca-cekirdek";
describe("kayitGecisi (kapalı döngü)", () => {
  const t0 = "2026-11-13T10:00:00Z", t1 = "2026-11-13T11:00:00Z", t2 = "2026-11-14T10:00:00Z";
  it("ilk görülen sorun açılır", () => {
    const g = kayitGecisi(null, "x", "SORUN", t0);
    expect(g.eylem).toBe("ACILDI"); expect(g.yeni).toMatchObject({ durum: "ACIK", tekrarSayisi: 0, ilkGorulme: t0 });
  });
  it("açık sorun tekrar görülünce yalnız sonGorulme güncellenir", () => {
    const a = kayitGecisi(null, "x", "SORUN", t0).yeni!; const g = kayitGecisi(a, "x", "SORUN", t1);
    expect(g.eylem).toBe("GUNCELLENDI"); expect(g.yeni).toMatchObject({ ilkGorulme: t0, sonGorulme: t1, tekrarSayisi: 0 });
  });
  it("sağlıklı ölçüm açık kaydı ÇÖZÜLDÜ yapar; sonra tekrar görülürse tekrar sayısı artar", () => {
    const a = kayitGecisi(null, "x", "SORUN", t0).yeni!;
    const c = kayitGecisi(a, "x", "SAGLIKLI", t1); expect(c.eylem).toBe("COZULDU"); expect(c.yeni).toMatchObject({ durum: "COZULDU", cozulmeZamani: t1 });
    const y = kayitGecisi(c.yeni, "x", "SORUN", t2); expect(y.eylem).toBe("YENIDEN_ACILDI"); expect(y.yeni).toMatchObject({ durum: "ACIK", tekrarSayisi: 1, cozulmeZamani: null });
  });
  it("ölçülemeyen durum kaydı değiştirmez (çözülmüş sayılmaz)", () => {
    const a = kayitGecisi(null, "x", "SORUN", t0).yeni!;
    const g = kayitGecisi(a, "x", "OLCULEMIYOR", t1); expect(g.eylem).toBe("YOK"); expect(g.yeni).toEqual(a);
  });
  it("kaydı olmayan sağlıklı ölçüm kayıt açmaz", () => {
    expect(kayitGecisi(null, "x", "SAGLIKLI", t0)).toEqual({ eylem: "YOK", yeni: null });
  });
});
