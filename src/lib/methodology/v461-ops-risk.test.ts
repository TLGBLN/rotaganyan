import { describe, it, expect } from "vitest";
import type { V461Pick } from "./v546-1-engine";
import type { Faz1RunnerV5 } from "./v5-engine";
import { hesaplaV461AnormalPistRiski, hesaplaV461BankoAdayi } from "./v461-ops-risk";

const pick = (no: number, score: number, probability: number, rank: number, zemin: number, strong = 0.4): V461Pick => ({
  runnerId: String(no), no, ad: `At ${no}`, score, probability, rank,
  features: [
    {ad:"zeminToleransi", raw:zemin, observed:true, reliability:1, z:zemin, beta:1, contribution:zemin},
    {ad:"hizDerecesi", raw:strong, observed:true, reliability:1, z:strong, beta:1, contribution:strong},
    {ad:"agfSirasi", raw:1, observed:true, reliability:1, z:1, beta:1, contribution:0.5},
  ],
});
const runners = [{no:1,recentForm:"123"},{no:2,recentForm:"12"}] as Faz1RunnerV5[];

describe("V5.46.1 operasyonel risk", () => {
  it("normal pistte skor ve banko gate bagimsiz kalir", () => {
    const ps=[pick(1,1,0.731,1,0.1),pick(2,0,0.269,2,-0.1)];
    const r=hesaplaV461AnormalPistRiski(ps,runners,"CIM",[{label:"Çim",detail:"Normal"}]);
    expect(r.pistAnormalMi).toBe(false);
    expect(r.operasyon.bankoIzinVer).toBe(true);
    const b=hesaplaV461BankoAdayi(ps,r);
    expect(b.bankoAdayi).toBe(true);
    expect(b.sebep).toContain("kalibre");
  });
  it("anormal pistte 1x senaryosu asil V461 skorundan turetilir ve risk bankoyu kapatabilir", () => {
    const ps=[pick(1,1,0.731058579,1,0.9),pick(2,0,0.268941421,2,-0.9)];
    const eksikGecmis=[{no:1,recentForm:""},{no:2,recentForm:"12"}] as Faz1RunnerV5[];
    const r=hesaplaV461AnormalPistRiski(ps,eksikGecmis,"CIM",[{label:"Çim",detail:"Çok Ağır 5,4"}]);
    expect(r.pistAnormalMi).toBe(true);
    expect(r.detay?.pistDayaniklilik.liderDegismedi).toBe(false);
    const one=r.detay!.pistDayaniklilik.senaryolar.find(s=>s.olcek===1)!;
    expect(one.siralama[0].no).toBe(1);
    expect(one.siralama[0].olasilik).toBeCloseTo(ps[0].probability,7);
    expect(r.operasyon.bankoIzinVer).toBe(false);
    expect(hesaplaV461BankoAdayi(ps,r).bankoAdayi).toBe(false);
  });
});
