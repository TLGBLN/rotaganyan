/**
 * RAN pedigree paired ROOT CAUSE ANALYSIS: which specific winners were
 * rescued and which were newly missed? Strictly frozen prior-date train folds.
 * No database, no known later acceptance/development results, no publication.
 */
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "@/lib/motor-v1/engine/training";
import type {FeatureRace,WalkFold} from "./combinatorial-signal-selection";
import {PEDIGREE_CONTEXTS, PEDIGREE_CODES} from "./pedigree-lineage-audit";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
export type PedigreeRcaCase = {
  raceId:string; date:string; winnerNo:number; fold:string;
  beforeRank:number;afterRank:number;
  beforeProbability:number;afterProbability:number;
  beforeTopNo:number;afterTopNo:number;
  beforeTopProbability:number;afterTopProbability:number;
  winnerSireObserved:boolean;winnerDamObserved:boolean;winnerDamsireObserved:boolean;
  winnerSireHistoricalN:number|null;winnerDamHistoricalN:number|null;winnerDamsireHistoricalN:number|null;
};
export type PedigreeRcaComparison = {
  label:string;baseline:string;candidate:string;
  n:number;
  beforeTop1:number;afterTop1:number;beforeTop3:number;afterTop3:number;
  rescuedTop1:number;newlyMissedTop1:number;
  rescuedTop3:number;newlyMissedTop3:number;
  netTop1:number;netTop3:number;
  winnerMeanProbabilityDelta:number;
  cases:PedigreeRcaCase[];
};
export const RCA_SETUPS = {
  FULL_NO_PEDIGREE:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:[]},
  FULL_SIRE:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:["SIRE_HISTORY"]},
  FULL_DAM:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:["DAM_HISTORY"]},
  FULL_DAMSIRE:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:["DAMSIRE_HISTORY"]},
  FULL_SIRE_DAM:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:["SIRE_HISTORY","DAM_HISTORY"]},
  FULL_ALL_THREE:{base:PEDIGREE_CONTEXTS.FULL_WITHOUT_PEDIGREE,extra:[...PEDIGREE_CODES]},
  SURFACE_NO_PEDIGREE:{base:PEDIGREE_CONTEXTS.SURFACE_DISTANCE,extra:[]},
  SURFACE_DAMSIRE:{base:PEDIGREE_CONTEXTS.SURFACE_DISTANCE,extra:["DAMSIRE_HISTORY"]},
  SURFACE_SIRE_DAMSIRE:{base:PEDIGREE_CONTEXTS.SURFACE_DISTANCE,extra:["SIRE_HISTORY","DAMSIRE_HISTORY"]},
} as const;
export type RcaSetupName=keyof typeof RCA_SETUPS;
type RankRow={raceId:string;date:string;fold:string;winnerNo:number;rank:number;
  winnerProbability:number;topNo:number;topProbability:number;
  sireObserved:boolean;damObserved:boolean;damsireObserved:boolean;
  sireN:number|null;damN:number|null;damsireN:number|null};
const all=new Set<string>();
function canonical(setup:RcaSetupName):string[]{
  const s=RCA_SETUPS[setup];
  const chosen=new Set<string>([...s.base,...s.extra]);
  return UNIFIED_MODEL_CODES.filter(x=>chosen.has(x));
}
function lineage(v:FeatureRace["vectors"][number],code:string):{observed:boolean;n:number|null}{
  const s=v.signals.find(x=>x.code===code);
  const n=s?.sampleCount;
  return {observed:!!s?.observed,n:n!=null&&Number.isSafeInteger(n)&&n>0?n:null};
}
export function pairedPedigreeRca(
  folds:readonly WalkFold[],opts:FitOptions,
  onProgress?:(id:RcaSetupName,completed:number,total:number)=>void,
):{publicationGate:"BLOCKED"; comparisons:PedigreeRcaComparison[];
  validationRaces:number;confidenceWarning:string;} {
  if(folds.length!==3)throw new Error("RAN_PEDIGREE_RCA_EXPECTS_THREE_CHRONO_FOLDS");
  const ranked=new Map<RcaSetupName,Map<string,RankRow>>();
  const ids=Object.keys(RCA_SETUPS) as RcaSetupName[];
  const heldOutIds=new Set<string>();
  for(const fold of folds){
    const maxTrain=Math.max(...fold.train.map(x=>Date.parse(x.tarih)));
    const minValid=Math.min(...fold.validation.map(x=>Date.parse(x.tarih)));
    if(!(maxTrain<minValid))throw new Error("RAN_PEDIGREE_RCA_LEAKED_FOLD");
    for(const race of fold.validation){
      if(heldOutIds.has(race.raceId))throw new Error("RAN_PEDIGREE_RCA_REPEATED_RACE");
      heldOutIds.add(race.raceId);
    }
  }
  for(let j=0;j<ids.length;j++){
    const id=ids[j], codes=canonical(id);
    const table=new Map<string,RankRow>();
    for(const fold of folds){
      const stats=computeFeatureStats(fold.train.flatMap(x=>x.vectors),codes);
      const model=fitModel(fold.train.map(x=>({
        raceId:x.raceId,date:new Date(x.tarih+"T00:00:00Z"),
        winnerNo:x.winnerNo,vectors:x.vectors,
      })),stats,opts);
      if(model.nRacesUsed!==fold.train.length)throw new Error("RAN_PEDIGREE_RCA_INCOMPLETE_FIT");
      for(const race of fold.validation){
        const rankedScores=scoreRace(race.vectors,model).sort((a,b)=>
          b.probability-a.probability || a.no-b.no);
        const idx=rankedScores.findIndex(x=>x.no===race.winnerNo);
        const winner=race.vectors.find(x=>x.no===race.winnerNo);
        if(idx<0 || !winner)throw new Error("RAN_PEDIGREE_RCA_WINNER_NOT_IN_RACE");
        const sire=lineage(winner,"SIRE_HISTORY"),dam=lineage(winner,"DAM_HISTORY"),
          damsire=lineage(winner,"DAMSIRE_HISTORY");
        table.set(race.raceId,{raceId:race.raceId,date:race.tarih,fold:fold.id,
          winnerNo:race.winnerNo,rank:idx+1,
          winnerProbability:rankedScores[idx].probability,topNo:rankedScores[0].no,
          topProbability:rankedScores[0].probability,
          sireObserved:sire.observed,damObserved:dam.observed,damsireObserved:damsire.observed,
          sireN:sire.n,damN:dam.n,damsireN:damsire.n});
      }
    }
    if(table.size!==heldOutIds.size)throw new Error("RAN_PEDIGREE_RCA_DIFFERENT_VALIDATION_COHORT");
    ranked.set(id,table);
    onProgress?.(id,j+1,ids.length);
  }
  const pairs:[string,RcaSetupName,RcaSetupName][]=[
    ["FULL_ADD_SIRE","FULL_NO_PEDIGREE","FULL_SIRE"],
    ["FULL_ADD_DAM","FULL_NO_PEDIGREE","FULL_DAM"],
    ["FULL_ADD_DAMSIRE","FULL_NO_PEDIGREE","FULL_DAMSIRE"],
    ["FULL_ADD_SIRE_AND_DAM","FULL_NO_PEDIGREE","FULL_SIRE_DAM"],
    ["FULL_ADD_ALL","FULL_NO_PEDIGREE","FULL_ALL_THREE"],
    ["FULL_ADD_SIRE_TO_DAM","FULL_DAM","FULL_SIRE_DAM"],
    ["SURFACE_ADD_DAMSIRE","SURFACE_NO_PEDIGREE","SURFACE_DAMSIRE"],
    ["SURFACE_ADD_SIRE_TO_DAMSIRE","SURFACE_DAMSIRE","SURFACE_SIRE_DAMSIRE"],
  ];
  const comparisons=pairs.map(([label,bId,cId]):PedigreeRcaComparison=>{
    const baseline=ranked.get(bId)!,candidate=ranked.get(cId)!;
    let rescuedTop1=0,newlyMissedTop1=0,rescuedTop3=0,newlyMissedTop3=0,
      beforeTop1=0,afterTop1=0,beforeTop3=0,afterTop3=0,probDelta=0;
    const cases:PedigreeRcaCase[]=[];
    for(const [raceId,b] of baseline){
      const c=candidate.get(raceId);
      if(!c)throw new Error("RAN_PEDIGREE_RCA_COHORT_MISMATCH");
      const b1=b.rank===1,c1=c.rank===1,b3=b.rank<=3,c3=c.rank<=3;
      beforeTop1+=Number(b1);afterTop1+=Number(c1);
      beforeTop3+=Number(b3);afterTop3+=Number(c3);
      rescuedTop1+=Number(!b1&&c1);newlyMissedTop1+=Number(b1&&!c1);
      rescuedTop3+=Number(!b3&&c3);newlyMissedTop3+=Number(b3&&!c3);
      probDelta+=c.winnerProbability-b.winnerProbability;
      if(b.rank!==c.rank || Math.abs(b.winnerProbability-c.winnerProbability)>0.03){
        cases.push({raceId,date:b.date,winnerNo:b.winnerNo,fold:b.fold,
          beforeRank:b.rank,afterRank:c.rank,
          beforeProbability:b.winnerProbability,afterProbability:c.winnerProbability,
          beforeTopNo:b.topNo,afterTopNo:c.topNo,
          beforeTopProbability:b.topProbability,afterTopProbability:c.topProbability,
          winnerSireObserved:b.sireObserved,winnerDamObserved:b.damObserved,
          winnerDamsireObserved:b.damsireObserved,
          winnerSireHistoricalN:b.sireN,winnerDamHistoricalN:b.damN,
          winnerDamsireHistoricalN:b.damsireN});
      }
    }
    if(afterTop1-beforeTop1!==rescuedTop1-newlyMissedTop1 ||
       afterTop3-beforeTop3!==rescuedTop3-newlyMissedTop3)
      throw new Error("RAN_PEDIGREE_RCA_BAD_ACCOUNTING");
    return {label,baseline:bId,candidate:cId,n:baseline.size,
      beforeTop1,afterTop1,beforeTop3,afterTop3,
      rescuedTop1,newlyMissedTop1,rescuedTop3,newlyMissedTop3,
      netTop1:afterTop1-beforeTop1,netTop3:afterTop3-beforeTop3,
      winnerMeanProbabilityDelta:probDelta/baseline.size,
      cases:cases.sort((a,b)=>a.date.localeCompare(b.date)||a.raceId.localeCompare(b.raceId))};
  });
  return {publicationGate:"BLOCKED",validationRaces:heldOutIds.size,comparisons,
    confidenceWarning:"Paired outcomes from previously inspected 145 chronological TRAIN-inner races; exploratory ONLY. Do not select live pedigree feature configurations using winner identifiers."};
}
