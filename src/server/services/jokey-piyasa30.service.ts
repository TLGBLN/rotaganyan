/**
 * Last-30-day read-only Tier-1 expectation; bounded query for current race jockeys.
 * Race-day cutoff is EXCLUSIVE (only fully completed previous calendar days).
 * Snapshot cutoff is strictly earlier than each historical scheduled race off.
 * Current runner.scratch may be mutable; historical coverage is transparently limited.
 */
import {db} from "@/lib/db";
import {finishPos} from "@/lib/race-result";
import {scheduledRaceCutoff,lastPreRaceAgf,normalizeRaceAgf,normalizeJockeyNameForRunner,type BinisOlasilik} from "@/lib/jokey-expected-wins";
import {hesaplaJokeyPiyasa30,type JokeyPiyasa30} from "@/lib/jokey-piyasa30";

export async function getJokeyPiyasa30ForRace(
  raceDay:Date,jockeyNames:readonly string[]
):Promise<Map<string,JokeyPiyasa30>> {
  if(!Number.isFinite(raceDay.getTime()))return new Map();
  const requested=[...new Set(jockeyNames.map(n=>n?.trim()).filter((n):n is string=>!!n))];
  const aliases=new Map(requested.map(name=>[name,normalizeJockeyNameForRunner(name)]));
  const names=[...new Set(aliases.values())];
  if(!names.length)return new Map();
  const start30=new Date(raceDay.getTime()-30*86_400_000);
  const mounts=await db.runner.findMany({
    where:{
      jockey:{in:names},scratched:false,
      race:{result:{isNot:null},raceDay:{date:{gte:start30,lt:raceDay}}}
    },
    select:{
      id:true,no:true,raceId:true,jockey:true,
      race:{select:{
        time:true,
        raceDay:{select:{date:true}},
        result:{select:{actualOrder:true,winnerNos:true}},
      }},
    },
  });
  const raceTime=new Map<string,Date|null>();
  for(const m of mounts)if(!raceTime.has(m.raceId))
    raceTime.set(m.raceId,scheduledRaceCutoff(m.race.raceDay.date,m.race.time));
  const raceIds=[...raceTime.keys()];
  const pByRunner=new Map<string,number>();

  for(let batchNo=0;batchNo<raceIds.length;batchNo+=75){
    const ids=raceIds.slice(batchNo,batchNo+75);
    const field=await db.runner.findMany({
      where:{raceId:{in:ids},scratched:false},
      select:{id:true,raceId:true},
    });
    if(!field.length)continue;
    const cutoffByRunner=new Map(field.map(r=>[r.id,raceTime.get(r.raceId)??null]));
    const snapshots=await db.agfSnapshot.findMany({
      where:{runnerId:{in:field.map(r=>r.id)},capturedAt:{gte:new Date(start30.getTime()-86_400_000),lt:raceDay}},
      select:{runnerId:true,agf:true,capturedAt:true},
      orderBy:{capturedAt:"desc"},
    });
    const snapshotsByRunner=new Map<string,{agf:number;capturedAt:Date}[]>();
    for(const s of snapshots){
      const cutoff=cutoffByRunner.get(s.runnerId);
      if(!cutoff||s.capturedAt.getTime()>=cutoff.getTime())continue;
      const arr=snapshotsByRunner.get(s.runnerId)??[];
      arr.push({agf:s.agf,capturedAt:s.capturedAt});
      snapshotsByRunner.set(s.runnerId,arr);
    }
    const byRace=new Map<string,{runnerId:string;agf:number|null}[]>();
    for(const runner of field){
      const cutoff=cutoffByRunner.get(runner.id);
      const snapshot=cutoff?lastPreRaceAgf(snapshotsByRunner.get(runner.id)??[],cutoff):null;
      const arr=byRace.get(runner.raceId)??[];
      arr.push({runnerId:runner.id,agf:snapshot});
      byRace.set(runner.raceId,arr);
    }
    for(const raceId of ids){
      if(!raceTime.get(raceId))continue;
      const normalized=normalizeRaceAgf(byRace.get(raceId)??[]);
      if(!normalized)continue; // whole race measured=false if any runner AGF missing
      for(const [runnerId,p] of normalized)pByRunner.set(runnerId,p);
    }
  }

  const byJockey=new Map<string,BinisOlasilik[]>();
  for(const m of mounts){
    if(!m.jockey)continue;
    const p=pByRunner.get(m.id)??null;
    const finish=m.race.result?finishPos(
      m.race.result.actualOrder,m.no,m.race.result.winnerNos
    ):null;
    // Dead heats require special covariance handling; mark unmeasured.
    const deadHeat=(m.race.result?.winnerNos.length??0)>1;
    const observed=p!==null&&finish!==null&&!deadHeat;
    const arr=byJockey.get(m.jockey)??[];
    arr.push({raceDate:m.race.raceDay.date,p:observed?p:null,won:finish===1,observed});
    byJockey.set(m.jockey,arr);
  }
  const result=new Map<string,JokeyPiyasa30>();
  for(const [requestedName,runnerName] of aliases)
    result.set(requestedName,hesaplaJokeyPiyasa30(requestedName,byJockey.get(runnerName)??[]));
  return result;
}
