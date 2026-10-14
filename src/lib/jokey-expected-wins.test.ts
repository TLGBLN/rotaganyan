import { describe, expect, it } from "vitest";
import {
  hesaplaResidualIstatistik, normalizeRaceAgf, scheduledRaceCutoff,
  secReferansBinisleri, hesaplaJokeyBeklentiFormu, type BinisOlasilik,
} from "./jokey-expected-wins";

const cutoff = new Date("2026-10-14T00:00:00.000Z");
const ride = (age: number, p = 0.2, won = false): BinisOlasilik => ({
  raceDate: new Date(cutoff.getTime() - age * 86400000), p, won,
});

describe("Jokey Beklenen Galibiyet — matematik ve veri güvenliği", () => {
  it("W, E, R ve Poisson-binomial SE doğru", () => {
    const s = hesaplaResidualIstatistik([{p:0.2, won:true}, {p:0.3, won:false}]);
    expect(s.N).toBe(2); expect(s.W).toBe(1);
    expect(s.E).toBeCloseTo(.5, 10);
    expect(s.R).toBeCloseTo(.5, 10);
    expect(s.SE).toBeCloseTo(Math.sqrt(.16+.21), 10);
  });
  it("geçersiz AGF olasılığını sessizce kabul etmez", () => {
    expect(() => hesaplaResidualIstatistik([{p:2,won:false}])).toThrow();
  });
  it("tam snapshot AGF toplamını 1'e normalize eder", () => {
    const a = normalizeRaceAgf([{runnerId:"a",agf:40},{runnerId:"b",agf:35},{runnerId:"c",agf:25}])!;
    expect([...a.values()].reduce((x,y)=>x+y,0)).toBeCloseTo(1, 9);
    expect(a.get("a")).toBeCloseTo(.4, 9);
  });
  it("eksik/yetersiz AGF alanını ölçülemedi olarak tutar", () => {
    expect(normalizeRaceAgf([{runnerId:"a",agf:70},{runnerId:"b",agf:null}])).toBeNull();
    expect(normalizeRaceAgf([{runnerId:"a",agf:20},{runnerId:"b",agf:20}])).toBeNull();
    expect(normalizeRaceAgf([{runnerId:"a",agf:40},{runnerId:"a",agf:60}])).toBeNull();
  });
  it("İstanbul saatini UTC'ye doğru çevirir ve bilinmeyen saati reddeder", () => {
    expect(scheduledRaceCutoff(new Date("2026-10-14T00:00:00Z"),"15:30")!.toISOString())
      .toBe("2026-10-14T12:30:00.000Z");
    expect(scheduledRaceCutoff(new Date("2026-10-14T00:00:00Z"),null)).toBeNull();
  });
  it("önce 31-180 dönemi >=20 seçilir", () => {
    const r=secReferansBinisleri(Array.from({length:20},()=>ride(50)),cutoff);
    expect(r.tier).toBe("31-180"); expect(r.mounts).toHaveLength(20);
  });
  it("yetersiz 180 gün için 31-365 dönemine genişler", () => {
    const rides=[...Array.from({length:9},()=>ride(60)),...Array.from({length:13},()=>ride(240))];
    const r=secReferansBinisleri(rides,cutoff);
    expect(r.tier).toBe("31-365"); expect(r.mounts).toHaveLength(22);
  });
  it("365 gün de yetersizse career-ex30; veri yoksa none", () => {
    expect(secReferansBinisleri([ride(500),ride(40)],cutoff).tier).toBe("career-ex30");
    expect(secReferansBinisleri([ride(8)],cutoff).tier).toBe("none");
  });
  it("kapsam eksikse R yalnız AGF'li binislerden hesaplanır; referans yoksa form yok", () => {
    const r=hesaplaJokeyBeklentiFormu("J", [ride(3,.2,true)],cutoff,3);
    expect(r.son30Start).toBe(1); expect(r.total30Start).toBe(3);
    expect(r.coverage30).toBeCloseTo(1/3,8);
    expect(r.son30Residual).toBeCloseTo(.8,8);
    expect(r.formDelta).toBeNull(); expect(r.durum).toBeNull();
  });
  it("gerçek referans ile EtkinForm ve Z hesaplanır", () => {
    const rides=[...Array.from({length:12},()=>ride(10,.2,true)),
      ...Array.from({length:20},()=>ride(60,.2,false))];
    const r=hesaplaJokeyBeklentiFormu("J",rides,cutoff,12);
    expect(r.refTier).toBe("31-180");
    expect(r.refStart).toBe(20);
    expect(r.formDelta).toBeCloseTo(1,9);
    expect(r.reliability).toBeCloseTo(12/20,9);
    expect(r.etkinForm).toBeCloseTo(.6,9);
    expect(r.z).not.toBeNull();
  });
});
