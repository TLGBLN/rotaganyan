import { describe, expect, it } from "vitest";
import { pitSirePercent, speedObservedAsOf } from "./pit-sire-speed";
import type { PaceIndex, HizGecmisSatir } from "@/lib/methodology/hiz-derecesi-hesapla";

const cutoff=new Date("2026-08-20T00:00:00.000Z");
const past={date:"15.08.2026",time:"1.20.00",distance:1000,surface:"Kum"};
const future={date:"21.08.2026",time:"1.20.00",distance:1000,surface:"Kum"};
const index: PaceIndex =new Map([
  ["ARAP|KUM|1000", Array.from({length:20},()=>({tarih:new Date("2026-08-01T00:00:00.000Z"),pace:12.5}))],
]);
describe("RAN-only PIT sire and SPEED source contract",()=>{
  it("returns no sire observation when cutoff-filtered sample absent",()=>{
    expect(pitSirePercent({ornekKendiVeri:null,kYuzde:null})).toBeNull();
    expect(pitSirePercent({ornekKendiVeri:0,kYuzde:88})).toBeNull();
    expect(pitSirePercent({ornekKendiVeri:12,kYuzde:null})).toBeNull();
    expect(pitSirePercent({ornekKendiVeri:5,kYuzde:101})).toBeNull();
  });
  it("preserves D sire shrink semantics using only PIT observations",()=>{
    expect(pitSirePercent({ornekKendiVeri:10,kYuzde:20})).toBeCloseTo((2+20*0.14)/30*100,12);
  });
  it("ignores results on and AFTER target date",()=>{
    expect(speedObservedAsOf([future],"ARAP",cutoff,index)).toBe(false);
    expect(speedObservedAsOf([{...future,date:"20.08.2026"}],"ARAP",cutoff,index)).toBe(false);
    expect(speedObservedAsOf([past,future],"ARAP",cutoff,index)).toBe(true);
  });
  it("marks false when there is no usable population baseline",()=>{
    expect(speedObservedAsOf([past],"ARAP",cutoff,new Map())).toBe(false);
    expect(speedObservedAsOf([past],"ARAP",cutoff,new Map([
      ["ARAP|KUM|1000",Array.from({length:19},()=>({tarih:new Date("2026-08-01T00:00:00Z"),pace:12.5}))],
    ]))).toBe(false);
  });
  it("rejects stale (365+ days), malformed time, and missing speed",()=>{
    const old: HizGecmisSatir={...past,date:"15.08.2025"};
    expect(speedObservedAsOf([old],"ARAP",cutoff,index)).toBe(false);
    expect(speedObservedAsOf([{...past,time:"NO_TIME"}],"ARAP",cutoff,index)).toBe(false);
    expect(speedObservedAsOf([],"ARAP",cutoff,index)).toBe(false);
  });
});
