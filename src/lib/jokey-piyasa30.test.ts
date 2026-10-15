import {describe,expect,it} from "vitest";
import {hesaplaJokeyPiyasa30,jokeyPiyasa30Ilk6Incele} from "./jokey-piyasa30";

describe("V5.46.1 Tier-1 market-relative jockey annotation (no score edits)",()=>{
  it("W/E/R/z exact and no reference-period gate",()=>{
    const rides=[
      ...Array.from({length:20},()=>({p:.1,won:true,observed:true})),
      ...Array.from({length:5},()=>({p:null,won:false,observed:false})),
    ];
    const f=hesaplaJokeyPiyasa30("J",rides);
    expect(f.n).toBe(25);expect(f.olculen).toBe(20);expect(f.olculemeyen).toBe(5);
    expect(f.e).toBeCloseTo(2,10);expect(f.w).toBe(20);
    expect(f.r).toBeCloseTo(18,10);expect(f.kapsam).toBeCloseTo(.8,10);
    expect(f.z).toBeCloseTo(18/Math.sqrt(1.8),9);
    expect(f.durum).toBe("PIYASA_USTU_INCELE");
    expect(jokeyPiyasa30Ilk6Incele(8,f)).toBe(true);
    expect(jokeyPiyasa30Ilk6Incele(6,f)).toBe(false);
    expect(jokeyPiyasa30Ilk6Incele(11,f)).toBe(false);
  });
  it("20 observed minimum, 70% coverage: no automatically strong claims",()=>{
    expect(hesaplaJokeyPiyasa30("A",[{p:.01,won:true,observed:true}]).durum)
      .toBe("KANIT_YETERSIZ");
    const r=hesaplaJokeyPiyasa30("A",[
      ...Array.from({length:20},()=>({p:.01,won:true,observed:true})),
      ...Array.from({length:20},()=>({p:null,won:false,observed:false})),
    ]);
    expect(r.kapsam).toBe(.5);
    expect(r.durum).toBe("KANIT_YETERSIZ");
  });
  it("undercount if missing W true must not enter observed W",()=>{
    const r=hesaplaJokeyPiyasa30("A",[
      {p:.2,won:false,observed:true},
      {p:null,won:true,observed:false},
    ]);
    expect(r.w).toBe(0);expect(r.e).toBeCloseTo(.2,10);
    expect(r.olculemeyen).toBe(1);
  });
  it("negative form only review, not Top6 rescue",()=>{
    const r=hesaplaJokeyPiyasa30("B",
      Array.from({length:25},()=>({p:.4,won:false,observed:true})));
    expect(r.durum).toBe("PIYASA_ALTI_INCELE");
    expect(jokeyPiyasa30Ilk6Incele(8,r)).toBe(false);
  });
});
