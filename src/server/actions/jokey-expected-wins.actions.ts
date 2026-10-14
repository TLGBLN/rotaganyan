"use server";

/** Read-only admin market-expectation audit. Never touches V5.46.1, Pick, Prediction,
 * JockeyStatSync, rescue policies, or any table writes. */
import {db} from "@/lib/db";
import {finishPos} from "@/lib/race-result";
import {
  hesaplaJokeyBeklentiFormu,normalizeRaceAgf,lastPreRaceAgf,scheduledRaceCutoff,
  type BinisOlasilik
} from "@/lib/jokey-expected-wins";

type FormFilters={
  jockeyNames?:string[];
  hippodromeSlug?:string;
  surface?:string;
  breed?:string;
};
type FormResult={
  rows:ReturnType<typeof hesaplaJokeyBeklentiFormu>[];
  raceCount:number;pricedRaceCount:number;skippedTimeCount:number;note:string;
};

export async function getJokeyExpectedWinsTablosu(asOfDate:Date,filters:FormFilters={}):Promise<FormResult> {
  const names=filters.jockeyNames;
  const empty:FormResult={rows:[],raceCount:0,pricedRaceCount:0,skippedTimeCount:0,note:""};
  if(names&&names.length===0)return empty;
  if(!Number.isFinite(asOfDate.getTime()))throw new Error("Invalid asOf date");
  const surface=filters.surface==="CIM"||filters.surface==="KUM"||filters.surface==="SENTETIK"?filters.surface:undefined;
  const breed=filters.breed==="ARAP"||filters.breed==="INGILIZ"?filters.breed:undefined;
  const hippo=filters.hippodromeSlug&&filters.hippodromeSlug!=="overall"?filters.hippodromeSlug:undefined;
  const mounts=await db.runner.findMany({
    where:{
      scratched:false,
      jockey:names?{in:names}:{not:null},
      race:{
        result:{isNot:null},
        raceDay:{date:{lt:asOfDate},...(hippo?{hippodrome:{slug:hippo}}:{})},
        ...(surface?{surface}:{}),...(breed?{breed}:{}),
      },
    },
    select:{
      id:true,no:true,raceId:true,jockey:true,
      race:{select:{
        time:true,raceDay:{select:{date:true}},
        result:{select:{winnerNos:true,actualOrder:true}},
      }},
    },
  });
  const raceMeta=new Map<string,{cutoff:Date|null}>();
  for(const mount of mounts){
    if(!raceMeta.has(mount.raceId))raceMeta.set(mount.raceId,{
      cutoff:scheduledRaceCutoff(mount.race.raceDay.date,mount.race.time)
    });
  }
  const raceIds=[...raceMeta.keys()];
  const pByRunner=new Map<string,number>();
  let pricedRaceCount=0,skippedTimeCount=0;

  // Batch fetch fields and snapshots. No per-race/per-mount N+1 query.
  for(let idx=0;idx<raceIds.length;idx+=100){
    const ids=raceIds.slice(idx,idx+100);
    const field=await db.runner.findMany({
      where:{raceId:{in:ids},scratched:false},
      select:{id:true,raceId:true}
    });
    const cutoffByRunner=new Map(field.map(f=>[f.id,raceMeta.get(f.raceId)?.cutoff??null]));
    const snapshots=await db.agfSnapshot.findMany({
      where:{runnerId:{in:field.map(f=>f.id)},capturedAt:{lt:asOfDate}},
      select:{runnerId:true,capturedAt:true,agf:true},orderBy:{capturedAt:"desc"}
    });
    const snapshotsByRunner=new Map<string,{capturedAt:Date;agf:number}[]>();
    for(const snap of snapshots){
      const cutoff=cutoffByRunner.get(snap.runnerId);
      if(!cutoff||snap.capturedAt>=cutoff)continue;
      const previous=snapshotsByRunner.get(snap.runnerId)??[];
      previous.push({capturedAt:snap.capturedAt,agf:snap.agf});
      snapshotsByRunner.set(snap.runnerId,previous);
    }
    const byRace=new Map<string,{runnerId:string;agf:number|null}[]>();
    for(const r of field){
      const cutoff=cutoffByRunner.get(r.id)??null;
      const agf=cutoff?lastPreRaceAgf(snapshotsByRunner.get(r.id)??[],cutoff):null;
      const list=byRace.get(r.raceId)??[];
      list.push({runnerId:r.id,agf});
      byRace.set(r.raceId,list);
    }
    for(const raceId of ids){
      if(!raceMeta.get(raceId)?.cutoff){skippedTimeCount++;continue;}
      const probability=normalizeRaceAgf(byRace.get(raceId)??[]);
      if(!probability)continue; // incomplete field: mark EVERY ride unmeasured
      pricedRaceCount++;
      for(const [runnerId,p] of probability)pByRunner.set(runnerId,p);
    }
  }
  const byJockey=new Map<string,BinisOlasilik[]>();
  for(const m of mounts){
    if(!m.jockey)continue;
    const p=pByRunner.get(m.id)??null;
    const finish=m.race.result?finishPos(
      m.race.result.actualOrder,m.no,m.race.result.winnerNos
    ):null;
    const observed=p!==null&&finish!==null;
    const rows=byJockey.get(m.jockey)??[];
    rows.push({raceDate:m.race.raceDay.date,p:observed?p:null,won:finish===1,observed});
    byJockey.set(m.jockey,rows);
  }
  const allNames=names??[...byJockey.keys()].sort((a,b)=>a.localeCompare(b,"tr"));
  return {
    rows:allNames.map(j=>hesaplaJokeyBeklentiFormu(j,byJockey.get(j)??[],asOfDate)),
    raceCount:raceIds.length,pricedRaceCount,skippedTimeCount,
    note:"Sadece yarış başlamadan önce gözlemlenmiş TAM AGF alanı ile E/W/SE hesaplanır; diğer binişler sayılır ama E/W'ye girmez. Güncel koşmaz/eküri durumu geçmişte değişmiş olabilir. Bu değer jokeyin saf nedensel yeteneği değil, piyasa beklentisine göre performans farkıdır."
  };
}
