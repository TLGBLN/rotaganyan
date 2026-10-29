/**
 * D23 historical AGF exporter from ALREADY CAPTURED AgfSnapshot table.
 * Read-only. Never uses mutable Runner.agf. Never invents AGF1/AGF2 labels.
 * DB columns do NOT record the altılı pool: output pool=POOL_UNVERIFIED.
 * No post-race snapshots, no partial-horse or blended-minute coverage.
 *
 * Input RAN_D23_V2_IN: recaptured D23 FORMULAS_V2 research JSON.
 * Output RAN_D23_MARKET_OUT: frozen market snapshots JSON; when incomplete,
 * emits explicit coverage manifest and exits nonzero (no fake full training).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {db} from "./src/lib/db";
import type {D23MarketSnapshot} from "./src/lib/rotaganyan-analiz-motoru/d23-market-model";

const INPUT=process.env.RAN_D23_V2_IN??"C:/tmp/ran-d23-v2-recapture.json";
const OUT=process.env.RAN_D23_MARKET_OUT??"C:/tmp/ran-d23-market-frozen.json";
const LEAD_MINUTES=15;
const MAX_BATCH_SPAN_MS=3000;
type SourceRace={raceId:string;tarih:string;vectors:{no:number}[]};
type MarketRow={raceId:string;market:D23MarketSnapshot};
type Snapshot={agf:number;capturedAt:Date};
const sha=(s:string|Buffer)=>createHash("sha256").update(s).digest("hex");
async function getMarket(r:SourceRace):Promise<MarketRow>{
  const race=await db.race.findUnique({where:{id:r.raceId},select:{
    time:true,raceDay:{select:{date:true}},
    runners:{where:{scratched:false},select:{
      no:true,agfSnapshots:{select:{agf:true,capturedAt:true},
        orderBy:{capturedAt:"desc"},take:40},
    }}
  }});
  if(!race || !race.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(race.time))
    throw Error("RACE_TIME_UNAVAILABLE");
  const day=race.raceDay.date.toISOString().slice(0,10);
  if(day!==r.tarih)throw Error("RACE_DATE_DRIFT");
  const start=new Date(day+"T"+race.time+":00+03:00");
  const cutoff=new Date(start.getTime()-LEAD_MINUTES*60000);
  if(!Number.isFinite(start.getTime()))throw Error("RACE_TIME_INVALID");
  if(r.vectors.length!==race.runners.length ||
    r.vectors.some(v=>!race.runners.some(h=>h.no===v.no)))
    throw Error("RACE_RUNNER_MISMATCH");
  const byMinute=new Map<number,Map<number,Snapshot>>();
  for(const horse of race.runners){
    for(const snap of horse.agfSnapshots){
      const t=snap.capturedAt.getTime();
      if(t>cutoff.getTime() || t>=start.getTime() ||
         !Number.isFinite(snap.agf) || snap.agf<0 || snap.agf>100)continue;
      const bucket=Math.floor(t/60000);
      if(!byMinute.has(bucket))byMinute.set(bucket,new Map());
      const m=byMinute.get(bucket)!;
      const prior=m.get(horse.no);
      if(!prior || prior.capturedAt.getTime()<t)m.set(horse.no,snap);
    }
  }
  let selected:Map<number,Snapshot>|null=null;
  for(const [,m] of [...byMinute].sort(([a],[b])=>b-a)){
    if(m.size!==race.runners.length)continue;
    const stamps=[...m.values()].map(x=>x.capturedAt.getTime());
    if(Math.max(...stamps)-Math.min(...stamps)>MAX_BATCH_SPAN_MS)continue;
    selected=m;break;
  }
  if(!selected)throw Error("NO_COMPLETE_PRE_RACE_ATOMIC_AGF_BATCH");
  const observations=race.runners.sort((a,b)=>a.no-b.no).map(h=>{
    const s=selected!.get(h.no);
    if(!s)throw Error("AGF_BATCH_MISSING_RUNNER");
    return {no:h.no,agfPercent:s.agf,capturedAt:s.capturedAt.toISOString()};
  });
  return {raceId:r.raceId,market:{
    pool:"POOL_UNVERIFIED",raceStartAt:start.toISOString(),
    cutoffAt:cutoff.toISOString(),observations,
  }};
}
async function main(){
  if(!fs.existsSync(INPUT))throw Error("D23_V2_RECAPTURE_FILE_REQUIRED");
  if(fs.existsSync(OUT)||fs.existsSync(OUT+".coverage.json"))
    throw Error("D23_AGF_EXPORT_OUTPUT_EXISTS");
  const data=fs.readFileSync(INPUT);
  const source=JSON.parse(data.toString("utf8"));
  const races:SourceRace[]=source?.races;
  if(source?.meta?.formulaVersion!=="D23_FORMULAS_V2" ||
    source?.meta?.featureEncoding!=="D23_EQUIPMENT_ONEHOT_V2" ||
    !Array.isArray(races) || !races.length)
    throw Error("D23_AGF_EXPORT_V2_INPUT_REQUIRED");
  const records:MarketRow[]=[];
  const missing:{raceId:string;reason:string}[]=[];
  for(let i=0;i<races.length;i++){
    try{
      records.push(await getMarket(races[i]));
      console.log("[AGF_EXPORT] "+(i+1)+"/"+races.length+" OK "+races[i].raceId);
    }catch(e){
      missing.push({raceId:races[i].raceId,reason:e instanceof Error?e.message:String(e)});
      console.warn("[AGF_EXPORT] "+(i+1)+"/"+races.length+" NOT_COVERED "+missing.at(-1)!.reason);
    }
  }
  const coverage={sourceSha256:sha(data),sourceRaceCount:races.length,
    fullMarketRaceCount:records.length,notCoveredCount:missing.length,missing,
    marketProvenance:"AgfSnapshot historical, batch time difference <=3s, 15-minute cutoff",
    poolProvenance:"POOL_UNVERIFIED: DB schema does not retain AGF1/AGF2 source"};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  const payload=JSON.stringify(records,null,2);
  fs.writeFileSync(OUT,payload,{flag:"wx"});
  fs.writeFileSync(OUT+".sha256",sha(payload)+"  "+path.basename(OUT)+"\n",{flag:"wx"});
  fs.writeFileSync(OUT+".coverage.json",JSON.stringify(coverage,null,2),{flag:"wx"});
  console.log("[AGF_COVERAGE] "+records.length+"/"+races.length+" pool=UNVERIFIED");
  if(missing.length)throw Error("D23_AGF_EXPORT_PARTIAL_COVERAGE: review .coverage.json, DO NOT CLAIM FULL PIT TRAINING");
  console.log("[AGF_EXPORT_READY] "+OUT+" RESEARCH_ONLY");
}
main().catch(e=>{console.error("[D23_AGF_EXPORT_FAILED]",e instanceof Error?e.message:String(e));process.exitCode=1;})
  .finally(async()=>{await db.$disconnect();});
