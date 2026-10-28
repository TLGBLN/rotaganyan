import {describe,it,expect} from "vitest";
import {AGF_TREND_CODE,AGF_ACTIVITY_CODE,agfPITSignals,
  observeAgfTrendAsOf,raceCutoffUtc} from "./agf-trend-pit";

const raceDay=new Date("2026-08-16T00:00:00.000Z");
const sample=(id:string,at:string,agf:number)=>
  ({id,agf,capturedAt:new Date(at)});

describe("D23 AGF trend - strict timestamped research data",()=>{
  it("converts Turkey scheduled race time to a 15-minute-earlier UTC cutoff",()=>{
    expect(raceCutoffUtc(raceDay,"14:30").toISOString())
      .toBe("2026-08-16T11:15:00.000Z");
    expect(()=>raceCutoffUtc(raceDay,null)).toThrow("AGF_PIT_RACE_TIME_REQUIRED");
    expect(()=>raceCutoffUtc(raceDay,"14:xx")).toThrow("AGF_PIT_RACE_TIME_REQUIRED");
  });
  it("uses first and last eligible pre-race snapshots, never latest post-race value",()=>{
    const cutoff=raceCutoffUtc(raceDay,"14:30");
    const x=observeAgfTrendAsOf(raceDay,cutoff,[
      sample("late","2026-08-16T12:00:00Z",99),
      sample("b","2026-08-16T11:14:59Z",8),
      sample("a","2026-08-16T07:10:00Z",5),
      sample("border","2026-08-16T11:15:00Z",35)
    ]);
    expect(x).toMatchObject({first:5,last:8,deltaPp:3,active:1,
      eligibleSnapshots:2,excludedPostCutoff:2,status:"OBSERVED"});
    const signals=agfPITSignals(x);
    expect(signals.map(s=>s.code)).toEqual([AGF_TREND_CODE,AGF_ACTIVITY_CODE]);
    expect(signals.map(s=>s.rawValue)).toEqual([3,1]);
  });
  it("does not treat one observation, repeated timestamp or only post-race values as a trend",()=>{
    const cutoff=raceCutoffUtc(raceDay,"14:30");
    for(const s of [
      [sample("a","2026-08-16T08:00:00Z",5)],
      [sample("a","2026-08-16T08:00:00Z",5),sample("b","2026-08-16T08:00:00Z",7)],
      [sample("late","2026-08-16T13:00:00Z",5)]
    ]){
      const v=observeAgfTrendAsOf(raceDay,cutoff,s);
      expect(v.status).toBe("NOT_ENOUGH_DISTINCT_PRE_RACE_SNAPSHOTS");
      expect(agfPITSignals(v).every(z=>!z.observed && z.rawValue===null)).toBe(true);
    }
  });
  it("uses absolute movement threshold 1.0pp, not unstable relative ratios",()=>{
    const cutoff=raceCutoffUtc(raceDay,"14:30");
    const x=observeAgfTrendAsOf(raceDay,cutoff,[
      sample("a","2026-08-16T08:00:00Z",0.1),
      sample("b","2026-08-16T09:00:00Z",0.9)
    ]);
    expect(x.deltaPp).toBe(0.8);expect(x.active).toBe(0);
  });
  it("does not include prior day's snapshots, or accept invalid snapshots",()=>{
    const cutoff=raceCutoffUtc(raceDay,"14:30");
    const x=observeAgfTrendAsOf(raceDay,cutoff,[
      sample("yesterday","2026-08-15T19:00:00Z",25),
      sample("today","2026-08-16T10:00:00Z",4)
    ]);
    expect(x.status).toBe("NOT_ENOUGH_DISTINCT_PRE_RACE_SNAPSHOTS");
    expect(()=>observeAgfTrendAsOf(raceDay,cutoff,[
      sample("bad","2026-08-16T09:00:00Z",101)
    ])).toThrow("AGF_PIT_INVALID_SNAPSHOT");
  });
});
