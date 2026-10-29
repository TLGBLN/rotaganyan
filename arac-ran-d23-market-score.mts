/**
 * Private read-only D23×AGF scorer. Expects a previously trained, fingerprinted
 * research model and one as-of race file. No database, network or production writes.
 * RAN_D23_MARKET_MODEL = output of arac-ran-d23-market-train.mts
 * RAN_D23_MARKET_SCORE_IN = one D23MarketRace object, with winnerNo:null
 * RAN_D23_MARKET_SCORE_OUT = new JSON output, no overwrite
 */
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {
  validateD23MarketArtifact,scoreD23Market,explainD23MarketRunner,
  type D23MarketRace,
} from "./src/lib/rotaganyan-analiz-motoru/d23-market-model";
const MODEL=process.env.RAN_D23_MARKET_MODEL;
const INPUT=process.env.RAN_D23_MARKET_SCORE_IN;
const OUT=process.env.RAN_D23_MARKET_SCORE_OUT??"C:/tmp/ran-d23-market-score.json";
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
function read(p:string|undefined,key:string):unknown{
  if(!p||!fs.existsSync(p))throw Error("D23_MARKET_SCORE_MISSING "+key);
  return JSON.parse(fs.readFileSync(p,"utf8"));
}
function main(){
  if(fs.existsSync(OUT))throw Error("D23_MARKET_SCORE_OUTPUT_EXISTS");
  const model=validateD23MarketArtifact(read(MODEL,"RAN_D23_MARKET_MODEL"));
  const race=read(INPUT,"RAN_D23_MARKET_SCORE_IN") as D23MarketRace;
  if(race.winnerNo!==null)throw Error("D23_MARKET_SCORE_REQUIRES_UNRESULTED_RACE");
  const predictions=scoreD23Market(race,model);
  const explanations=predictions.map(x=>({
    no:x.no,...explainD23MarketRunner(race,model,x.no),
  }));
  const payload={
    version:model.version,source:"RESEARCH_ONLY_NOT_PUBLISHED",raceId:race.raceId,
    asOf:race.market.cutoffAt,pool:race.market.pool,
    predictions,explanations,
    warning:"Regimes do not alter rank; banko not guaranteed; production not wired.",
  };
  const string=JSON.stringify(payload,null,2);
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,string,{flag:"wx"});
  fs.writeFileSync(OUT+".sha256",sha(string)+"  "+path.basename(OUT)+"\n",{flag:"wx"});
  console.log("[D23_MARKET_SCORE] "+race.raceId+" top3="+predictions.slice(0,3).map(x=>x.no).join(","));
  console.log("[RESEARCH_ONLY] "+OUT+" fingerprint="+sha(string));
}
try{main();}catch(e){console.error("[D23_MARKET_SCORE_FAILED]",e instanceof Error?e.message:String(e));process.exitCode=1;}
