import {describe,expect,it} from "vitest";
import {
  hesaplaResidualIstatistik,normalizeRaceAgf,lastPreRaceAgf,scheduledRaceCutoff,
  secReferansBinisleri,hesaplaJokeyBeklentiFormu,type BinisOlasilik,
} from "./jokey-expected-wins";
const asOf=new Date("2026-10-14T00:00:00.000Z");
const ride=(days:number,p:number|null=.2,won=false,observed=true):BinisOlasilik=>({
  raceDate:new Date(asOf.getTime()-days*86400000),p,won,observed,
});
describe("PIT AGF Expected-Wins / Jokey Form",()=>{
  it("W/E/R/SE bilinen örneği; missing mount hem N hem NÖlçülemeyen",()=>{
    const s=hesaplaResidualIstatistik([
      {p:.2,won:true,observed:true},
      {p:null,won:true,observed:false},
      {p:.3,won:false,observed:true},
    ]);
    expect(s.N).toBe(3);expect(s.NOlculen).toBe(2);expect(s.NOlculemeyen).toBe(1);
    expect(s.W).toBe(1);expect(s.E).toBeCloseTo(.5,9);
    expect(s.R).toBeCloseTo(.5,9);expect(s.SE).toBeCloseTo(Math.sqrt(.16+.21),9);
  });
  it("observed true ancak p=null veya geçersiz olursa hata",()=>{
    expect(()=>hesaplaResidualIstatistik([{p:null,won:false,observed:true}])).toThrow();
    expect(()=>hesaplaResidualIstatistik([{p:1.2,won:false,observed:true}])).toThrow();
  });
  it("Tüm alan sağlıklıysa Σp=1, eksik alan normalizasyonu yasak",()=>{
    const p=normalizeRaceAgf([
      {runnerId:"a",agf:40},{runnerId:"b",agf:35},{runnerId:"c",agf:25}
    ])!;
    expect([...p.values()].reduce((a,b)=>a+b,0)).toBeCloseTo(1,9);
    expect(p.get("a")).toBeCloseTo(.4,9);
    expect(normalizeRaceAgf([{runnerId:"a",agf:70},{runnerId:"b",agf:null}])).toBeNull();
    expect(normalizeRaceAgf([{runnerId:"a",agf:20},{runnerId:"b",agf:20}])).toBeNull();
    expect(normalizeRaceAgf([{runnerId:"x",agf:50},{runnerId:"x",agf:50}])).toBeNull();
  });
  it("PIT: start-a EŞİT veya sonraki snapshot ASLA kullanılmaz",()=>{
    const cutoff=new Date("2026-10-14T12:30:00.000Z");
    const records=[
      {capturedAt:new Date("2026-10-14T12:31:00Z"),agf:99},
      {capturedAt:cutoff,agf:88},
      {capturedAt:new Date("2026-10-14T12:25:00Z"),agf:15},
      {capturedAt:new Date("2026-10-14T12:29:00Z"),agf:21},
    ];
    expect(lastPreRaceAgf(records,cutoff)).toBe(21);
    expect(lastPreRaceAgf(records.slice(0,2),cutoff)).toBeNull();
    expect(scheduledRaceCutoff(new Date("2026-10-14T00:00:00Z"),"15:30")?.toISOString())
      .toBe("2026-10-14T12:30:00.000Z");
    expect(scheduledRaceCutoff(asOf,null)).toBeNull();
  });
  it("K_REF basamakları 31-180 -> 31-365 -> career-ex30 -> none",()=>{
    expect(secReferansBinisleri(Array.from({length:20},()=>ride(50)),asOf).tier).toBe("31-180");
    const older=[...Array.from({length:9},()=>ride(50)),...Array.from({length:13},()=>ride(240))];
    expect(secReferansBinisleri(older,asOf).tier).toBe("31-365");
    expect(secReferansBinisleri([ride(500)],asOf).tier).toBe("career-ex30");
    expect(secReferansBinisleri([ride(8)],asOf).tier).toBe("none");
  });
  it("K_REF >=20 sayımına observed=false girdileri eklenmez",()=>{
    const items=[...Array.from({length:18},()=>ride(60)),...Array.from({length:5},()=>ride(60,null,false,false))];
    expect(secReferansBinisleri(items,asOf).tier).toBe("career-ex30");
  });
  it("son30 >%30 missing => Form/Güven -",()=>{
    const items=[ride(2,.2,true),ride(3,.3,false),ride(4,null,true,false),
      ...Array.from({length:20},()=>ride(50,.2,false))];
    const s=hesaplaJokeyBeklentiFormu("A",items,asOf);
    expect(s.son30Start).toBe(3);expect(s.son30Olculen).toBe(2);
    expect(s.son30Olculemeyen).toBe(1);
    expect(s.olculemeyenOrani).toBeCloseTo(1/3,9);
    expect(s.durum).toBeNull();expect(s.guvenGosterilebilirMi).toBe(false);
  });
  it("referans da >%30 missing ise Form kapalı",()=>{
    const items=[...Array.from({length:10},()=>ride(3,.2,true)),
      ...Array.from({length:7},()=>ride(50,.2,false)),
      ...Array.from({length:4},()=>ride(50,null,false,false))];
    expect(hesaplaJokeyBeklentiFormu("A",items,asOf).etkinForm).toBeNull();
  });
  it("güvenilir kapsamda form, z ve shrinkage",()=>{
    const items=[...Array.from({length:12},()=>ride(10,.2,true)),
      ...Array.from({length:20},()=>ride(50,.2,false))];
    const s=hesaplaJokeyBeklentiFormu("J",items,asOf);
    expect(s.refTier).toBe("31-180");
    expect(s.formDelta).toBeCloseTo(1,9);
    expect(s.reliability).toBeCloseTo(12/20,9);
    expect(s.etkinForm).toBeCloseTo(.6,9);expect(s.z).not.toBeNull();
  });
});
