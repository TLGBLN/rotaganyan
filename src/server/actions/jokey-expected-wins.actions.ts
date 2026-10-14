"use server";

/** Read-only admin expectation table. No writes, no JockeyStatSync updates.
 * AGF snapshot before SCHEDULED off; post-off snapshots are never used.
 * This is market-relative PERFORMANCE, not causal jockey skill.
 */
import { db } from "@/lib/db";
import {
  hesaplaJokeyBeklentiFormu, normalizeRaceAgf, scheduledRaceCutoff,
  type JokeyExpectedWinsForm, type BinisOlasilik,
} from "@/lib/jokey-expected-wins";

type FormFilters = {
  jockeyNames?: string[];
  hippodromeSlug?: string;
  surface?: string;
  breed?: string;
};
export type JokeyFormTable = {
  rows: JokeyExpectedWinsForm[];
  raceCount: number;
  pricedRaceCount: number;
  skippedTimeCount: number;
  note: string;
};

export async function getJokeyExpectedWinsTablosu(
  asOfDate: Date, options: FormFilters = {}
): Promise<JokeyFormTable> {
  const names = options.jockeyNames;
  const empty: JokeyFormTable = {rows:[], raceCount:0,pricedRaceCount:0,skippedTimeCount:0,note:""};
  if (names && names.length === 0) return empty;
  if (!Number.isFinite(asOfDate.getTime())) throw new Error("Geçersiz rapor tarihi");
  const surface = options.surface === "CIM" || options.surface === "KUM" || options.surface === "SENTETIK" ? options.surface : undefined;
  const breed = options.breed === "ARAP" || options.breed === "INGILIZ" ? options.breed : undefined;
  const hippo = options.hippodromeSlug && options.hippodromeSlug !== "overall" ? options.hippodromeSlug : undefined;
  const mounts = await db.runner.findMany({
    where: {
      scratched: false,
      jockey: names ? {in:names} : {not:null},
      race: {
        result: {isNot:null},
        raceDay: {
          date: {lt:asOfDate},
          ...(hippo ? {hippodrome:{slug:hippo}} : {}),
        },
        ...(surface ? {surface} : {}),
        ...(breed ? {breed} : {}),
      },
    },
    select: {
      id:true, no:true, raceId:true, jockey:true,
      race: {select:{
        time:true,
        raceDay:{select:{date:true}},
        result:{select:{winnerNos:true,actualOrder:true}},
      }},
    },
  });

  const raceMeta = new Map<string, {cutoff:Date|null}>();
  for (const m of mounts) {
    if (!raceMeta.has(m.raceId)) raceMeta.set(m.raceId, {
      cutoff:scheduledRaceCutoff(m.race.raceDay.date,m.race.time),
    });
  }
  const raceIds=[...raceMeta.keys()];
  const pricedByRunner = new Map<string,number>();
  let pricedRaceCount=0, skippedTimeCount=0;

  // BATCH per race, NOT N+1. Require each current non-scratched runner's last
  // snapshot at or before the race's scheduled local off time. Never Runner.agf.
  for (let i=0; i<raceIds.length; i+=100) {
    const batch=raceIds.slice(i,i+100);
    const field=await db.runner.findMany({
      where:{raceId:{in:batch},scratched:false},
      select:{id:true,raceId:true},
    });
    if (field.length===0) continue;
    const snapshots=await db.agfSnapshot.findMany({
      where:{runnerId:{in:field.map(r=>r.id)},capturedAt:{lt:asOfDate}},
      select:{runnerId:true,agf:true,capturedAt:true},
      orderBy:{capturedAt:"desc"},
    });
    const best=new Map<string,number>();
    for(const s of snapshots) {
      if(best.has(s.runnerId)) continue;
      const raceId=fieldByRunnerId(s.runnerId,field);
      if(raceId==null) continue;
      const cutoff=raceMeta.get(raceId)?.cutoff;
      if(cutoff && s.capturedAt.getTime()<=cutoff.getTime()) best.set(s.runnerId,s.agf);
    }
    const byRace=new Map<string, {runnerId:string;agf:number|null}[]>();
    for(const r of field) {
      const list=byRace.get(r.raceId)??[];
      list.push({runnerId:r.id,agf:best.get(r.id)??null});
      byRace.set(r.raceId,list);
    }
    for(const id of batch) {
      const cutoff=raceMeta.get(id)?.cutoff;
      if(!cutoff) {skippedTimeCount++; continue;}
      const normalized=normalizeRaceAgf(byRace.get(id)??[]);
      if(!normalized) continue;
      pricedRaceCount++;
      for(const [runnerId,p] of normalized) pricedByRunner.set(runnerId,p);
    }
  }

  const asOfMs=asOfDate.getTime();
  const start30=asOfMs-30*86400000;
  const byJockey=new Map<string,{rides:BinisOlasilik[];total30:number}>();
  for(const m of mounts) {
    if(!m.jockey) continue;
    const record=byJockey.get(m.jockey)??{rides:[],total30:0};
    const date=m.race.raceDay.date;
    if(date.getTime()>=start30 && date.getTime()<asOfMs) record.total30++;
    const p=pricedByRunner.get(m.id);
    if(p!=null) {
      const won=m.race.result?.winnerNos.includes(m.no) ?? false;
      record.rides.push({raceDate:date,p,won});
    }
    byJockey.set(m.jockey,record);
  }
  const jockeyNames=names ?? [...byJockey.keys()].sort((a,b)=>a.localeCompare(b,"tr"));
  return {
    rows:jockeyNames.map(j=>{
      const b=byJockey.get(j)??{rides:[],total30:0};
      return hesaplaJokeyBeklentiFormu(j,b.rides,asOfDate,b.total30);
    }),
    raceCount:raceIds.length,pricedRaceCount,skippedTimeCount,
    note:"Yalnız yarış öncesi tam AGF snapshot'ı bulunan koşuların binişleri W/E hesabına katıldı. Eksik AGF, yarış saati olmayan veya toplam AGF kontrolünü geçmeyen yarışlar dışlandı. Güncel koşmaz bilgisi tarihsel olarak değişmiş olabilir. AGF jokey etkisini de fiyatlayabilir; form nedensel yetenek değildir.",
  };
}

/** An indexed in-memory field map, built once per chunk; never query per mount. */
function fieldByRunnerId(
  runnerId:string, field: readonly {id:string;raceId:string}[]
):string|null {
  return field.find(r=>r.id===runnerId)?.raceId??null;
}
