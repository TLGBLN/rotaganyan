import {vi,describe,it,expect} from "vitest";
// The pure PIT source scorer is tested with a fully isolated stub; NO DB can be initialized.
vi.mock("@/lib/db",()=>({db:{runner:{findMany:vi.fn()},race:{findUnique:vi.fn()}}}));
import {lineagesAsOf,type LineageHistoricRun} from "./lineage-source";

const base=(date:string,tjkAtId:number|null,no:number,extra:Partial<LineageHistoricRun>={}):LineageHistoricRun=>({
  date:new Date(date),breed:"INGILIZ",surface:"KUM",distance:1400,
  sire:"SIRE A",dam:"DAM X",damSire:"DAM SIRE B",
  tjkAtId,no,actualOrder:[String(no)],winnerNos:[no],...extra,
});
describe("PIT per-horse ancestry source isolation",()=>{
  it("reads all 3 lines, only earlier same breed/surface/distance, excludes TARGET own prior history",()=>{
    const src=[
      base("2026-08-20T00:00:00Z",10,1), // horse itself: never genetic evidence
      base("2026-08-19T00:00:00Z",11,2),
      base("2026-08-21T00:00:00Z",12,3), // same day: no evidence
      base("2026-09-01T00:00:00Z",13,4), // future: no evidence
      base("2026-08-17T00:00:00Z",14,5,{surface:"CIM"}),
      base("2026-08-17T00:00:00Z",15,6,{distance:1600}),
      base("2026-08-17T00:00:00Z",16,7,{breed:"ARAP"}),
      base("2026-08-17T00:00:00Z",null,8), // unknown child ID excluded
      base("2026-08-17T00:00:00Z",17,9,{actualOrder:null,winnerNos:null}),
    ];
    const target={cutoff:new Date("2026-08-21T00:00:00Z"),
      breed:"INGILIZ",surface:"KUM",distance:1400,
      horses:[{no:1,tjkAtId:10,sire:"SIRE A",dam:"DAM X",damSire:"DAM SIRE B"}]};
    const lines=lineagesAsOf(target,src).get(1)!;
    expect(lines.map(x=>x.code)).toEqual(["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"]);
    expect(lines.every(x=>x.starts===1&&x.wins===1&&x.distinctFoals===1)).toBe(true);
    expect(lines.every(x=>x.adjustedPct!<100)).toBe(true);
  });
  it("supports two horses with same ancestor WITHOUT excluding each other's results",()=>{
    const target={cutoff:new Date("2026-08-25T00:00:00Z"),
      breed:"INGILIZ",surface:"KUM",distance:1400,
      horses:[
        {no:1,tjkAtId:10,sire:"SIRE A",dam:"DAM X",damSire:"DAM SIRE B"},
        {no:2,tjkAtId:11,sire:"SIRE A",dam:"DAM Y",damSire:"DAM SIRE B"},
      ]};
    const rows=[base("2026-08-20T00:00:00Z",10,1),
      base("2026-08-20T00:00:00Z",11,2)];
    const scored=lineagesAsOf(target,rows);
    expect(scored.get(1)![0].distinctFoals).toBe(1);
    expect(scored.get(2)![0].distinctFoals).toBe(1);
    expect(scored.get(1)![0].starts).toBe(1);
    expect(scored.get(2)![0].starts).toBe(1);
    expect(scored.get(2)![1].observed).toBe(false); // DAM Y unknown
  });
  it("does not invent 0% lineage when source history has no valid finish",()=>{
    const target={cutoff:new Date("2026-08-21"),breed:"INGILIZ",surface:"KUM",distance:1400,
      horses:[{no:4,tjkAtId:10,sire:"A",dam:"B",damSire:"C"}]};
    const result=lineagesAsOf(target,[base("2026-08-20",11,4,
      {sire:"A",dam:"B",damSire:"C",actualOrder:null,winnerNos:null})]);
    expect(result.get(4)!.every(x=>!x.observed&&x.adjustedPct===null)).toBe(true);
  });
});
