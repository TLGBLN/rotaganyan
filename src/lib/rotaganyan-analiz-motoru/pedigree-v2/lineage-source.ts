/**
 * RAN pedigree v2 source, research only. DB reads via actual finished races,
 * PIT cutoff strictly < target race, 3 distinct ancestry lines, and target
 * horse's OWN tjkAtId explicitly excluded.
 *
 * No historical cumulative stats (ExternalPedigreeStat, SireStatOwn, DamStatOwn).
 * A historical run with unknown horse ID or unknown finish order is NOT evidence.
 */
import {db} from "@/lib/db";
import {finishPos} from "@/lib/race-result";
import {breedToIrk,mesafeBucket,normalizeSireName,surfaceToPist} from "@/lib/sire-stat-match";
import {LINEAGES,adjustLineage,type AdjustedLineage} from "./lineage-score";

export type LineageHistoricRun={
  date:Date;breed:string;surface:string;distance:number;
  sire:string|null;dam:string|null;damSire:string|null;
  tjkAtId:number|null;no:number;actualOrder:unknown;winnerNos:number[]|null;
};
export type TargetPedigreeHorse={
  no:number;tjkAtId:number|null;
  sire:string|null;dam:string|null;damSire:string|null;
};
export type TargetPedigreeRace={
  cutoff:Date;breed:string;surface:string;distance:number;
  horses:TargetPedigreeHorse[];
};
export function lineagesAsOf(
  target:TargetPedigreeRace,
  rows:readonly LineageHistoricRun[],
):Map<number,AdjustedLineage[]> {
  if(!Number.isFinite(target.cutoff.getTime())||target.horses.length===0||
     new Set(target.horses.map(x=>x.no)).size!==target.horses.length)
    throw new Error("RAN_PED_V2_BAD_TARGET");
  const breed=breedToIrk(target.breed),surface=surfaceToPist(target.surface),
    bucket=mesafeBucket(target.distance);
  if(!breed||!surface||!bucket)throw new Error("RAN_PED_V2_UNSUPPORTED_RACE_BUCKET");
  // Pre-index historical runs by lineage field + ancestor name after excluding
  // invalid results and future/same-day records. Reused across every horse.
  const lineMap=new Map<string,Map<number,{starts:number;wins:number}>>();
  for(const r of rows){
    if(!(r.date instanceof Date) || !Number.isFinite(r.date.getTime()) ||
       r.date.getTime()>=target.cutoff.getTime() || r.tjkAtId==null ||
       !Number.isSafeInteger(r.tjkAtId) || r.tjkAtId<1 ||
       breedToIrk(r.breed)!==breed || surfaceToPist(r.surface)!==surface ||
       mesafeBucket(r.distance)!==bucket)continue;
    const position=finishPos(r.actualOrder,r.no,r.winnerNos);
    if(position==null)continue; // incomplete finish order is NOT a loss
    for(const line of LINEAGES){
      const name=r[line.field];
      if(!name?.trim())continue;
      const key=line.code+"|"+normalizeSireName(name);
      const offspring=lineMap.get(key)??new Map<number,{starts:number;wins:number}>();
      const v=offspring.get(r.tjkAtId)??{starts:0,wins:0};
      v.starts++;v.wins+=Number(position===1);
      offspring.set(r.tjkAtId,v);lineMap.set(key,offspring);
    }
  }
  return new Map(target.horses.map(h=>[
    h.no,LINEAGES.map(l=>{
      const name=h[l.field];
      const siblings=name?.trim()?
        [...(lineMap.get(l.code+"|"+normalizeSireName(name))??new Map()).entries()]
          .map(([tjkAtId,value])=>({tjkAtId,...value})):[];
      return adjustLineage({code:l.code,ancestorName:name,progeny:siblings,targetId:h.tjkAtId});
    }),
  ]));
}
let archivePromise:Promise<LineageHistoricRun[]>|null=null;
function fetchPedigreeArchive(){
  return db.runner.findMany({
    where:{
      scratched:false,tjkAtId:{not:null},race:{result:{isNot:null}},
      OR:[{sire:{not:null}},{dam:{not:null}},{damSire:{not:null}}],
    },
    select:{
      sire:true,dam:true,damSire:true,tjkAtId:true,no:true,
      race:{select:{
        breed:true,surface:true,distance:true,
        raceDay:{select:{date:true}},
        result:{select:{actualOrder:true,winnerNos:true}},
      }},
    },
  });
}
export async function getThreeLineagePedigreeForRace(raceId:string):Promise<{
  horses:TargetPedigreeHorse[];cutoff:Date;lineages:Map<number,AdjustedLineage[]>;
}> {
  const race=await db.race.findUnique({
    where:{id:raceId},
    select:{
      breed:true,surface:true,distance:true,
      raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{
        no:true,tjkAtId:true,sire:true,dam:true,damSire:true,
      }},
    },
  });
  if(!race)throw new Error("RAN_PED_V2_TARGET_RACE_MISSING");
  if(!archivePromise)archivePromise=fetchPedigreeArchive().then(all=>all.map(r=>({
    date:r.race.raceDay.date,breed:r.race.breed,surface:r.race.surface,
    distance:r.race.distance,sire:r.sire,dam:r.dam,damSire:r.damSire,
    tjkAtId:r.tjkAtId,no:r.no,actualOrder:r.race.result?.actualOrder??null,
    winnerNos:r.race.result?.winnerNos??null,
  })));
  const rows=await archivePromise;
  const target={cutoff:race.raceDay.date,breed:race.breed,
    surface:race.surface,distance:race.distance,horses:race.runners};
  return {horses:race.runners,cutoff:race.raceDay.date,
    lineages:lineagesAsOf(target,rows)};
}
