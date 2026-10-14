/** Read-only AGF-based expected jockey wins, for admin only. Not a causal skill estimate. */
import {classifyEtkinFormDurum,reliability,K_REF_MIN_SAMPLE,type EtkinFormDurum} from "./jokey-form";
/** Normalize TJK JockeyStatSync label to Runner.jockey casing using Turkish locale.
 * This intentionally DOES NOT invent aliases (e.g. abbreviations); audit those separately. */
export function normalizeJockeyNameForRunner(name:string):string {
  return name.normalize("NFC").trim().replace(/\s+/g," ").toLocaleUpperCase("tr-TR");
}

export type BinisOlasilik={raceDate:Date;p:number|null;won:boolean;observed:boolean};
export type HamBeklenti={N:number;NOlculen:number;NOlculemeyen:number;W:number;E:number;R:number;SE:number};
export type ReferansKademesi="31-180"|"31-365"|"career-ex30"|"none";
export interface JokeyExpectedWinsForm {
  jockey:string;
  son30Start:number;son30Olculen:number;son30Olculemeyen:number;
  son30Win:number;son30Expected:number;son30Residual:number;son30Se:number;
  refStart:number;refOlculen:number;refOlculemeyen:number;
  refWin:number;refExpected:number;refResidual:number;refTier:ReferansKademesi;
  formDelta:number|null;z:number|null;reliability:number;
  etkinForm:number|null;durum:EtkinFormDurum|null;
  olculemeyenOrani:number;refOlculemeyenOrani:number;guvenGosterilebilirMi:boolean;
}
const DAY=86400000;
export const MAX_MISSING_RATE=.30;
/** Missing observed=false counts toward denominator, NEVER toward W/E/SE. */
export function hesaplaResidualIstatistik(mounts:readonly Pick<BinisOlasilik,"p"|"won"|"observed">[]):HamBeklenti {
  let W=0,E=0,V=0,n=0;
  for(const m of mounts){
    if(!m.observed)continue;
    if(m.p===null||!Number.isFinite(m.p)||m.p<0||m.p>1)throw new Error("Invalid observed AGF probability");
    n++;if(m.won)W++;
    E+=m.p;V+=m.p*(1-m.p);
  }
  return {N:mounts.length,NOlculen:n,NOlculemeyen:mounts.length-n,W,E,R:W-E,SE:Math.sqrt(V)};
}
/** Require full, coherent pre-off field; NEVER inflate p by normalizing only available runners. */
export function normalizeRaceAgf(field:readonly {runnerId:string;agf:number|null}[]):Map<string,number>|null {
  if(field.length<2||field.some(x=>x.agf===null||!Number.isFinite(x.agf)||x.agf<0))return null;
  const total=field.reduce((a,b)=>a+b.agf!,0);
  if(total<80||total>120)return null; // sanity only, not learned parameter
  const map=new Map<string,number>();
  for(const f of field){if(map.has(f.runnerId))return null;map.set(f.runnerId,f.agf!/total);}
  return map;
}
/** Cutoff exclusive; post-off and at-off snapshots NEVER selected. */
export function lastPreRaceAgf(rows:readonly {capturedAt:Date;agf:number}[],cutoff:Date):number|null {
  let latest=-Infinity;let p:number|null=null;
  for(const row of rows){
    const ms=row.capturedAt.getTime();
    if(ms>=cutoff.getTime()||ms<=latest||!Number.isFinite(row.agf))continue;
    latest=ms;p=row.agf;
  }
  return p;
}
/** RaceDay.date is the Turkish calendar day encoded as a UTC date; Race.time local (UTC+03). */
export function scheduledRaceCutoff(day:Date,time:string|null):Date|null {
  const match=time?.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if(!match)return null;
  const h=Number(match[1]),m=Number(match[2]);
  if(h>23||m>59)return null;
  const date=day.toISOString().slice(0,10);
  const result=new Date(date+"T"+String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":00+03:00");
  return Number.isFinite(result.getTime())?result:null;
}
/** K_REF tier logic from jokey-form: 31-180, 31-365, then career excluding 30 days.
 * Only *observed* mounts count toward K_REF_MIN_SAMPLE. */
export function secReferansBinisleri(rides:readonly BinisOlasilik[],asOf:Date):
  {tier:ReferansKademesi;mounts:BinisOlasilik[]} {
  const age=(r:BinisOlasilik)=>(asOf.getTime()-r.raceDate.getTime())/DAY;
  const older=rides.filter(x=>age(x)>30),d180=older.filter(x=>age(x)<=180);
  if(d180.filter(x=>x.observed).length>=K_REF_MIN_SAMPLE)return {tier:"31-180",mounts:d180};
  const d365=older.filter(x=>age(x)<=365);
  if(d365.filter(x=>x.observed).length>=K_REF_MIN_SAMPLE)return {tier:"31-365",mounts:d365};
  return {tier:older.some(x=>x.observed)?"career-ex30":"none",mounts:older};
}
/** Guard: if >30% of 30-day OR reference mounts unmeasurable, Form and Güven are hidden. */
export function hesaplaJokeyBeklentiFormu(jockey:string,rides:readonly BinisOlasilik[],asOf:Date):JokeyExpectedWinsForm {
  const age=(r:BinisOlasilik)=>(asOf.getTime()-r.raceDate.getTime())/DAY;
  const s=hesaplaResidualIstatistik(rides.filter(x=>age(x)>0&&age(x)<=30));
  const ref=secReferansBinisleri(rides,asOf),b=hesaplaResidualIstatistik(ref.mounts);
  const missing=s.N?s.NOlculemeyen/s.N:1,missingRef=b.N?b.NOlculemeyen/b.N:1;
  const canShow=s.NOlculen>0&&b.NOlculen>0&&missing<=MAX_MISSING_RATE&&missingRef<=MAX_MISSING_RATE;
  const delta=canShow?s.R/s.NOlculen-b.R/b.NOlculen:null;
  const se=canShow?Math.sqrt((s.SE/s.NOlculen)**2+(b.SE/b.NOlculen)**2):0;
  const z=delta!==null&&se>0?delta/se:null;
  const rel=reliability(s.NOlculen),effective=delta===null?null:delta*rel;
  return {
    jockey,son30Start:s.N,son30Olculen:s.NOlculen,son30Olculemeyen:s.NOlculemeyen,
    son30Win:s.W,son30Expected:s.E,son30Residual:s.R,son30Se:s.SE,
    refStart:b.N,refOlculen:b.NOlculen,refOlculemeyen:b.NOlculemeyen,
    refWin:b.W,refExpected:b.E,refResidual:b.R,refTier:ref.tier,
    formDelta:delta,z,reliability:rel,etkinForm:effective,
    durum:effective===null?null:classifyEtkinFormDurum(effective*100),
    olculemeyenOrani:missing,refOlculemeyenOrani:missingRef,guvenGosterilebilirMi:canShow,
  };
}
