import { describe, it, expect } from "vitest";
import { normalize, yarisMetrik, wilson, bootstrapAralik, dilimOzeti, kalibrasyon, tipGrubu, alanBuyuklugu, bankoOzeti, degerlendir, sinyalDurumu, type YarisKaydi } from "./metrikler";

const kayit = (kaz: number, model: Record<string, number>, piyasa: Record<string, number> | null = null, extra: Partial<YarisKaydi> = {}): YarisKaydi => ({
  raceId: "r" + Math.random(), tarih: "2026-11-13", hip: "Test", raceNo: 1, classType: "Handikap 15", surum: "S", alanBuyuklugu: Object.keys(model).length,
  model: normalize(model), piyasa: piyasa ? normalize(piyasa) : null, kazananlar: [kaz], bankoAdayi: false, ...extra,
});

describe("yarisMetrik", () => {
  it("kazanan en yüksek olasılıklıysa Top1/Top3=1, LL=-log(p)", () => {
    const m = yarisMetrik({ "1": 0.5, "2": 0.3, "3": 0.2 }, [1]);
    expect(m.t1).toBe(1); expect(m.t3).toBe(1); expect(m.ll).toBeCloseTo(-Math.log(0.5), 10);
    expect(m.topP).toBeCloseTo(0.5, 10); expect(m.top3P).toBeCloseTo(1, 10);
  });
  it("kazanan 4. sıradaysa Top3=0", () => {
    const m = yarisMetrik({ "1": 0.4, "2": 0.3, "3": 0.2, "4": 0.1 }, [4]);
    expect(m.t1).toBe(0); expect(m.t3).toBe(0);
  });
  it("beraberlikte (iki kazanan) en olası kazananın olasılığı kullanılır", () => {
    const m = yarisMetrik({ "1": 0.6, "2": 0.4 }, [2, 1]);
    expect(m.ll).toBeCloseTo(-Math.log(0.6), 10);
  });
});

describe("wilson", () => {
  it("n=0 → NaN; 5/10 simetrik; sınırlar [0,1] içinde", () => {
    expect(Number.isNaN(wilson(0, 0).oran)).toBe(true);
    const w = wilson(5, 10); expect(w.oran).toBe(0.5); expect(w.lo).toBeGreaterThan(0.2); expect(w.hi).toBeLessThan(0.8);
    expect(wilson(0, 5).lo).toBe(0); expect(wilson(5, 5).hi).toBe(1);
  });
});

describe("bootstrapAralik", () => {
  it("n<8 aralık yok; deterministik; ortalamayı içerir", () => {
    expect(Number.isNaN(bootstrapAralik([1, 2, 3]).lo)).toBe(true);
    const v = Array.from({ length: 50 }, (_, i) => (i % 5) / 5);
    const a = bootstrapAralik(v), b = bootstrapAralik(v);
    expect(a).toEqual(b); expect(a.lo).toBeLessThanOrEqual(a.m); expect(a.hi).toBeGreaterThanOrEqual(a.m);
  });
});

describe("dilimOzeti", () => {
  it("boş dilim güvenli", () => { const d = dilimOzeti("x", []); expect(d.n).toBe(0); expect(d.model).toBeNull(); });
  it("piyasası olmayan yarışlar piyasa alt kümesine girmez", () => {
    const ks = [kayit(1, { "1": 0.5, "2": 0.5 }, { "1": 0.7, "2": 0.3 }), kayit(2, { "1": 0.5, "2": 0.5 })];
    const d = dilimOzeti("x", ks);
    expect(d.n).toBe(2); expect(d.nPiyasa).toBe(1); expect(d.piyasa!.top1).toBe(1);
  });
  it("model piyasadan kötüyse ΔLL pozitif", () => {
    const ks = Array.from({ length: 20 }, () => kayit(1, { "1": 0.3, "2": 0.7 }, { "1": 0.8, "2": 0.2 }));
    const d = dilimOzeti("x", ks); expect(d.fark!.m).toBeGreaterThan(0);
  });
});

describe("kalibrasyon", () => {
  it("kutulara böler, kutu başına gerçek oran", () => {
    const ks = [kayit(1, { "1": 0.6, "2": 0.4 }), kayit(1, { "1": 0.6, "2": 0.4 }), kayit(2, { "1": 0.6, "2": 0.4 }), kayit(1, { "1": 0.2, "2": 0.2, "3": 0.2, "4": 0.2, "5": 0.2 })];
    const k = kalibrasyon(ks, "top1", [0, 0.25, 0.5, 1.01]);
    expect(k.map((x) => x.n)).toEqual([1, 0, 3]);
    expect(k[2].gercek.oran).toBeCloseTo(2 / 3, 10);
  });
});

describe("yardımcılar", () => {
  it("tipGrubu", () => {
    expect(tipGrubu("Handikap 15/DHÖW")).toBe("Handikap"); expect(tipGrubu("Maiden/Dişi")).toBe("Maiden/ŞARTLI 19");
    expect(tipGrubu("ŞARTLI 19/DHÖW")).toBe("Maiden/ŞARTLI 19"); expect(tipGrubu("ŞARTLI 27")).toBe("ŞARTLI 1/27");
    expect(tipGrubu("ŞARTLI 4/DHÖW")).toBe("ŞARTLI 2-5"); expect(tipGrubu("KV-7")).toBe("KV/Satış/Grup/Diğer");
  });
  it("alanBuyuklugu", () => { expect(alanBuyuklugu(7)).toBe("≤7 at"); expect(alanBuyuklugu(10)).toBe("8–10 at"); expect(alanBuyuklugu(11)).toBe("11+ at"); });
  it("bankoOzeti yalnız banko adaylarını sayar", () => {
    const ks = [kayit(1, { "1": 0.6, "2": 0.4 }, null, { bankoAdayi: true }), kayit(2, { "1": 0.6, "2": 0.4 }, null, { bankoAdayi: true }), kayit(1, { "1": 0.6, "2": 0.4 })];
    const b = bankoOzeti(ks); expect(b.n).toBe(2); expect(b.tuttu).toBe(1);
  });
  it("degerlendir: n<150 yetersiz; aralık beklentinin üstünde → kötü, altında → iyi, içinde → beklenen", () => {
    expect(degerlendir({ m: 0.1, lo: 0.05, hi: 0.15 }, 100, 0.128)).toBe("yetersiz");
    expect(degerlendir({ m: 0.3, lo: 0.2, hi: 0.4 }, 200, 0.128)).toBe("kotu");
    expect(degerlendir({ m: 0.0, lo: -0.1, hi: 0.1 }, 200, 0.128)).toBe("iyi");
    expect(degerlendir({ m: 0.12, lo: 0.05, hi: 0.2 }, 200, 0.128)).toBe("beklenen");
    expect(degerlendir(null, 500, 0.128)).toBe("yetersiz");
  });
});

describe("sinyalDurumu", () => {
  it("veri yok / 7 gün yok / düşüş / ok", () => {
    expect(sinyalDurumu(undefined)).toBe("veriYok");
    expect(sinyalDurumu({ n7: 0, obs7: 0, n30: 0, obs30: 0 })).toBe("veriYok");
    expect(sinyalDurumu({ n7: 0, obs7: 0, n30: 100, obs30: 90 })).toBe("yediGunYok");
    expect(sinyalDurumu({ n7: 100, obs7: 70, n30: 400, obs30: 380 })).toBe("dusus");
    expect(sinyalDurumu({ n7: 100, obs7: 90, n30: 400, obs30: 380 })).toBe("ok");
  });
});
