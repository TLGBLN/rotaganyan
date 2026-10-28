import { describe, it, expect } from "vitest";
import { buildD23SnapshotCandidate,verifyD23SnapshotCandidate } from "./d23-snapshot-candidate";
const hash="fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c";
const example=[
  {no:5,name:"A",score:1.3,probability:0.5},
  {no:2,name:"B",score:0.4,probability:0.3},
  {no:9,name:"C",score:-0.4,probability:0.2},
];
describe("D23 snapshot candidate fail-closed integrity",()=>{
  it("ties ranking and coupon bands to exactly the same scored vector",()=>{
    const a=buildD23SnapshotCandidate("race_1",example,hash);
    expect(a.picks.map(x=>x.no)).toEqual([5,2,9]);
    expect(a.picks.map(x=>x.rank)).toEqual([1,2,3]);
    expect(a.coupon).toEqual({narrow:"5-2-9",normal:"",wide:""});
    expect(a.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyD23SnapshotCandidate(a)).toBe(true);
    const b=buildD23SnapshotCandidate("race_1",example.slice().reverse(),hash);
    expect(b.contentSha256).toBe(a.contentSha256);
  });
  it("detects manual rank, coupon and probability tampering",()=>{
    const a=buildD23SnapshotCandidate("race_1",example,hash);
    expect(verifyD23SnapshotCandidate({
      ...a,coupon:{...a.coupon,narrow:"2-9-5"}
    })).toBe(false);
    expect(verifyD23SnapshotCandidate({
      ...a,picks:[{...a.picks[0],rank:2},...a.picks.slice(1)]
    })).toBe(false);
    expect(verifyD23SnapshotCandidate({
      ...a,picks:[{...a.picks[0],probability:0.51},...a.picks.slice(1)]
    })).toBe(false);
  });
  it("rejects missing runners, repeated numbers, invalid probability sums",()=>{
    expect(()=>buildD23SnapshotCandidate("race_1",
      [{no:1,name:"A",score:0,probability:0.8},
       {no:1,name:"B",score:0,probability:0.2}],hash)).toThrow();
    expect(()=>buildD23SnapshotCandidate("race_1",
      [{no:1,name:"A",score:0,probability:0.7},
       {no:2,name:"B",score:0,probability:0.2}],hash)).toThrow();
  });
});
