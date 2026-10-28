import {describe,expect,it} from "vitest";
import {selectD23Signals} from "./d23-select-feature-codes";
const s=(code:string,rawValue:number|null=1,observed=true)=>
  ({code,rawValue,observed});
describe("D23 frozen feature selection",()=>{
  it("accepts extra historical research signals and preserves model-column order",()=>{
    const raw=[s("UNUSED_RESEARCH"),s("SPEED",2),s("JOCKEY_OE30",3),
      s("OTHER"),s("RIVAL_GAP",4)];
    const picked=selectD23Signals(raw,["JOCKEY_OE30","SPEED","RIVAL_GAP"]);
    expect(picked.map(x=>x.code)).toEqual(["JOCKEY_OE30","SPEED","RIVAL_GAP"]);
    expect(picked.map(x=>x.rawValue)).toEqual([3,2,4]);
    expect(raw).toHaveLength(5);
  });
  it("does not invent missing model features",()=>{
    expect(()=>selectD23Signals([s("SPEED")],["SPEED","RIVAL_GAP"]))
      .toThrow("D23_MISSING_MODEL_SIGNALS RIVAL_GAP");
  });
  it("rejects duplicate selected features even with unused extra features",()=>{
    expect(()=>selectD23Signals([s("SPEED"),s("IGNORED"),s("SPEED")],["SPEED"]))
      .toThrow("D23_DUPLICATE_MODEL_SIGNAL SPEED");
  });
  it("rejects an unobserved feature with a fabricated raw number",()=>{
    expect(()=>selectD23Signals([s("SPEED",0,false)],["SPEED"]))
      .toThrow("D23_INVALID_MODEL_SIGNAL_VALUE SPEED");
  });
});
