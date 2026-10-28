/**
 * D23 60 OUT-OF-TRAINING RACES | AGF TREND missed-winner audit.
 * Reads the EXISTING successful 60-race .races.json; never recaptures D23.
 * Read-only DB, timestamp-filtered AgfSnapshot (no mutable Runner.agf).
 * Predeclared equal-budget "TOP2 + highest rising outsider" check.
 *
 * Research only: results are retrospective, AGF rows may be backfilled and
 * D23 historical 23 feature inputs are not independently PIT-certified.
 * No weights fitted, no production publishing, no ROI claim.
 *
 * Run from the existing C:\tmp\ran-integration repository:
 *   node node_modules/tsx/dist/cli.mjs ./arac-ran-d23-agf-trend-kaciranlar60.mts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "./src/lib/db";

const sourcePrefix = process.env.RAN_D23_HOLDOUT_PREFIX ||
  "C:\\tmp\\ran-d23-holdout60-20261028-121548";
const sourceFile = sourcePrefix + ".races.json";
const manifestFile = "./d23-60-manifest.json";
const reportFile = sourcePrefix + ".agf-trend-rescue.json";
const missesFile = sourcePrefix + ".agf-trend-misses.csv";
const CUTOFF_MIN = 15;
const THRESHOLD_PP = 1;
type Ranked = { no: number; name: string; prob: number };
type Holdout = {
  raceId: string; date: string; raceNo: number; hippodromeId: string;
  status: "OK" | "UNSCORABLE"; n: number; winnerNo: number;
  winnerRank: number; ranked: Ranked[];
};
type AGFRow = { raceId: string; no: number; agf: number;
  capturedAtLocal: string; snapshotId: string };
type Trend = {
  observed: boolean; first: number | null; last: number | null;
  deltaPp: number | null; snapshotCount: number; distinctTimes: number;
  kind: "YUKSELEN" | "DUSEN" | "SABIT" | "EKSIK";
};
const digest = (v: string | Buffer) =>
  crypto.createHash("sha256").update(v).digest("hex");
function die(s: string): never { throw Error("D23_AGF_TREND_RESCUE_BLOCKED " + s); }
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const validTime = (s: unknown): s is string =>
  typeof s === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s);
function trendOf(history: readonly AGFRow[]): Trend {
  // Query returns only same-day observations BEFORE official start - 15m.
  const sorted = history.slice().sort((a,b) =>
    a.capturedAtLocal.localeCompare(b.capturedAtLocal) ||
    a.snapshotId.localeCompare(b.snapshotId));
  const times = new Set(sorted.map(s => s.capturedAtLocal));
  const n = sorted.length, distinctTimes = times.size;
  if (distinctTimes < 2) return {observed:false,first:null,last:null,
    deltaPp:null,snapshotCount:n,distinctTimes,kind:"EKSIK"};
  const first = sorted[0].agf, last = sorted[n-1].agf;
  const deltaPp = Math.round((last-first)*100)/100;
  return {observed:true,first,last,deltaPp,snapshotCount:n,distinctTimes,
    kind:deltaPp>=THRESHOLD_PP?"YUKSELEN":
      deltaPp<=-THRESHOLD_PP?"DUSEN":"SABIT"};
}
function selectTop3(
  ranked: readonly Ranked[], signals: ReadonlyMap<number, Trend>
): {before: number[]; after: number[]; added: number | null;
    dropped: number | null; alertNos: number[]} {
  const before = ranked.slice(0,3).map(x=>x.no);
  const outsiders = ranked.slice(3).filter(x => {
    const t = signals.get(x.no);
    return t?.observed && t.deltaPp!==null &&
      t.deltaPp>=THRESHOLD_PP;
  }).sort((a,b) => (signals.get(b.no)!.deltaPp! -
      signals.get(a.no)!.deltaPp!) ||
      b.prob-a.prob || a.no-b.no);
  const chosen = outsiders[0];
  return {before,after:chosen?[before[0],before[1],chosen.no]:before,
    added:chosen?.no??null,dropped:chosen?before[2]:null,
    alertNos:outsiders.map(x=>x.no)};
}
function selfTest(){
  const v = (no:number,prob:number):Ranked=>({no,name:String(no),prob});
  const ranked=[v(1,.4),v(2,.3),v(3,.2),v(4,.07),v(5,.03)];
  const signal=new Map<number,Trend>([
    [4,trendOf([
      {raceId:"r",no:4,agf:2,capturedAtLocal:"2026-10-24 08:00:00",snapshotId:"1"},
      {raceId:"r",no:4,agf:6,capturedAtLocal:"2026-10-24 09:00:00",snapshotId:"2"}
    ])],
    [5,trendOf([
      {raceId:"r",no:5,agf:1,capturedAtLocal:"2026-10-24 08:00:00",snapshotId:"3"}
    ])]
  ]);
  assert.deepEqual(selectTop3(ranked,signal).after,[1,2,4]);
  assert.deepEqual(selectTop3(ranked,signal).alertNos,[4]);
  assert.equal(signal.get(5)!.observed,false);
  assert.equal(trendOf([
    {raceId:"r",no:4,agf:2,capturedAtLocal:"2026-10-24 08:00:00",snapshotId:"1"},
    {raceId:"r",no:4,agf:6,capturedAtLocal:"2026-10-24 08:00:00",snapshotId:"2"}
  ]).observed,false);
  console.log("[AGF-60] SELF_TEST=PASS");
}
const csv = (x:unknown) => {
  const s=String(x??"");
  return '"' + s.replaceAll('"','""') + '"';
};
async function main(){
  selfTest();
  if (!fs.existsSync(sourceFile) || !fs.existsSync(manifestFile))
    die("HOLDOUT_60_RACES_OR_MANIFEST_MISSING");
  if (fs.existsSync(reportFile) || fs.existsSync(missesFile))
    die("RESULT_ALREADY_EXISTS_DO_NOT_OVERWRITE " + reportFile);
  const bytes=fs.readFileSync(sourceFile);
  const rows=JSON.parse(bytes.toString("utf8")) as Holdout[];
  const manifest=JSON.parse(fs.readFileSync(manifestFile,"utf8")) as
    {races:{raceId:string;date:string;raceNo:number;hippodromeId:string}[]};
  if(rows.length!==60 || manifest.races.length!==60 ||
     new Set(rows.map(r=>r.raceId)).size!==60 ||
     rows.some(r=>r.status!=="OK" || r.ranked.length!==r.n ||
       r.n<3 || r.winnerRank<1 || r.winnerRank>r.n ||
       r.ranked[r.winnerRank-1]?.no!==r.winnerNo ||
       new Set(r.ranked.map(x=>x.no)).size!==r.n ||
       Math.abs(r.ranked.reduce((s,x)=>s+x.prob,0)-1)>1e-7))
    die("60_RACE_D23_RESULTS_INTEGRITY_FAILED");
  for(let i=0;i<60;i++){
    const r=rows[i],m=manifest.races[i];
    if(r.raceId!==m.raceId||r.date!==m.date||
       r.raceNo!==m.raceNo||r.hippodromeId!==m.hippodromeId)
      die("FIXED_MANIFEST_MISMATCH "+i);
  }
  const initialTop3=rows.reduce((s,r)=>s+Number(r.winnerRank<=3),0);
  if(initialTop3!==30 || rows.filter(r=>r.winnerRank>3).length!==30)
    die("EXPECTED_60_RACES_30_MISSES_NOT_MATCHED");
  const ids=rows.map(r=>r.raceId);
  const metas=await db.race.findMany({
    where:{id:{in:ids}},
    select:{id:true,time:true,raceNo:true,
      raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{no:true}}}
  });
  if(metas.length!==60)die("DB_MISSING_RACE_METADATA");
  const metaById=new Map(metas.map(r=>[r.id,r]));
  let unknownTimeRaces=0;
  for(const r of rows){
    const meta=metaById.get(r.raceId)!;
    if(meta.raceNo!==r.raceNo ||
       ymd(meta.raceDay.date)!==r.date ||
       meta.runners.length!==r.n ||
       meta.runners.some(x=>!r.ranked.some(h=>h.no===x.no)))
      die("DB_RACE_FIELD_DRIFT "+r.raceId);
    if(!validTime(meta.time))unknownTimeRaces++;
  }
  // PostgreSQL stores capturedAt as timestamp WITHOUT time zone.
  // All comparisons are therefore made as Istanbul-local naive timestamps
  // entirely in SQL. Do NOT JS-convert them as if they were UTC.
  // CASE defends against invalid Race.time values before ::time cast.
  const agf = await db.$queryRaw<AGFRow[]>(Prisma.sql`
    SELECT r.id AS "raceId", rr.no AS "no", a.agf AS "agf",
      a."capturedAt"::text AS "capturedAtLocal",
      a.id AS "snapshotId"
    FROM "AgfSnapshot" a
    JOIN "Runner" rr ON rr.id=a."runnerId"
    JOIN "Race" r ON r.id=rr."raceId"
    JOIN "RaceDay" rd ON rd.id=r."raceDayId"
    WHERE r.id IN (${Prisma.join(ids)})
      AND rr.scratched=false
      AND a."capturedAt" >= rd.date::date
      AND a."capturedAt" < (
        rd.date::date +
        (CASE WHEN r.time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN r.time::time ELSE NULL END)
        - INTERVAL '15 minutes'
      )
    ORDER BY r.id,rr.no,a."capturedAt",a.id
  `);
  const byHorse=new Map<string,AGFRow[]>();
  for(const a of agf){
    if(!Number.isInteger(a.no) || !Number.isFinite(a.agf) ||
       a.agf<0 || a.agf>100 ||
       !/^2026-10-(22|23|24) /.test(a.capturedAtLocal))
      die("AGF_SNAPSHOT_INVALID "+a.raceId+"/"+a.no);
    const key=a.raceId+"/"+a.no, arr=byHorse.get(key)??[];
    arr.push(a);byHorse.set(key,arr);
  }

  const results=rows.map(r=>{
    const trends=new Map<number,Trend>(r.ranked.map(x=>[
      x.no,trendOf(byHorse.get(r.raceId+"/"+x.no)??[])
    ]));
    const winner=trends.get(r.winnerNo)!;
    const reranked=selectTop3(r.ranked,trends);
    const initialHit=reranked.before.includes(r.winnerNo);
    const overlayHit=reranked.after.includes(r.winnerNo);
    const watchlistCaught=reranked.alertNos.includes(r.winnerNo);
    const gain= !initialHit && overlayHit;
    const loss= initialHit && !overlayHit;
    const status=!winner.observed?"AGF_TREND_EKSIK":
      winner.kind==="YUKSELEN"?"YUKSELEN_KAZANAN":
      winner.kind==="DUSEN"?"DUSEN_KAZANAN":"SABIT_KAZANAN";
    return {
      raceId:r.raceId,date:r.date,raceNo:r.raceNo,
      hippodromeId:r.hippodromeId,winnerNo:r.winnerNo,
      winnerName:r.ranked.find(x=>x.no===r.winnerNo)?.name??"",
      d23WinnerRank:r.winnerRank,d23Top3:reranked.before,
      winnerInitialAgf:winner.first,winnerLastAgf:winner.last,
      winnerTrendPp:winner.deltaPp,winnerTrendStatus:status,
      trendSnapshotCount:winner.snapshotCount,
      trendDistinctTimes:winner.distinctTimes,
      winnerRankBand:r.winnerRank<=3?"1-3":r.winnerRank<=6?"4-6":"7+",
      outsideTop3RisingAlerts:reranked.alertNos,
      alertCatchesWinner:watchlistCaught,
      fixed3OverlayTop3:reranked.after,
      addedNo:reranked.added,droppedNo:reranked.dropped,
      initialHit,overlayHit,GAIN:gain,LOSS:loss,
      risingOutsiders:reranked.alertNos.map(no=>({
        no,name:r.ranked.find(h=>h.no===no)?.name,
        d23Rank:r.ranked.findIndex(h=>h.no===no)+1,
        trendPp:trends.get(no)?.deltaPp,
        first:trends.get(no)?.first,last:trends.get(no)?.last
      })),
      fieldTrendCoverage:r.ranked.filter(x=>trends.get(x.no)?.observed).length,
      fieldSize:r.n,
    };
  });
  const missed=results.filter(r=>r.d23WinnerRank>3);
  const upMiss=missed.filter(r=>r.winnerTrendStatus==="YUKSELEN_KAZANAN");
  const rescued=results.filter(r=>r.GAIN);
  const lost=results.filter(r=>r.LOSS);
  const observedWinners=results.filter(r=>r.winnerInitialAgf!==null).length;
  const observedStarters=results.reduce((s,r)=>s+r.fieldTrendCoverage,0);
  const starterCount=results.reduce((s,r)=>s+r.fieldSize,0);
  const originalHits=results.filter(r=>r.initialHit).length;
  const overlayHits=results.filter(r=>r.overlayHit).length;
  const summary={
    races:60,d23Top3Hits:originalHits,d23Top3Misses:missed.length,
    winnerAGFTrendObserved:observedWinners,
    winnerAGFTrendCoveragePct:100*observedWinners/60,
    starterAGFTrendObserved:observedStarters,
    starterCount,starterAGFTrendCoveragePct:100*observedStarters/starterCount,
    missingWinnerTrends:60-observedWinners,
    missedWinnersRising:upMiss.length,
    missedWinnersRisingRank4to6:upMiss.filter(r=>r.d23WinnerRank<=6).length,
    missedWinnersRisingRank7plus:upMiss.filter(r=>r.d23WinnerRank>=7).length,
    missedWinnersAlertCaught:missed.filter(r=>r.alertCatchesWinner).length,
    fixed3OverlayHits:overlayHits,
    fixed3Rescued:rescued.length,fixed3Lost:lost.length,
    fixed3NetNewHits:overlayHits-originalHits,
    fixed3ChangedRaces:results.filter(r=>r.addedNo!==null).length,
    racesWithoutValidStartTime:unknownTimeRaces,
    notes:[
      "ALERT means positive trend outside D23 Top3, NOT a predicted winner.",
      "Equal-budget fixed3 overlay: keep D23 Top1/Top2 and replace D23 #3 with highest rising outsider (if exists). Tie by D23 probability then runner number; NO winner label is used to select.",
      "Rise threshold: +1.00 percentage point; measured from first to last distinct, timestamped same-day snapshot at least 15 minutes before scheduled race time.",
      "AGF timestamps are PostgreSQL Istanbul-local timestamp-without-time-zone; not a certified immutable source; later backfill remains possible.",
      "D23's historical runner features are not certified immutable pre-race data.",
      "This 60-race set was previously seen; this result is EXPLORATORY, NOT a new untouched holdout and NOT permission to deploy.",
      "Ganyan ROI and six-leg ticket ROI are NOT assessed here.",
    ],
    releaseAllowed:false,
  };
  const report={schemaVersion:"D23_AGF_TREND_RESCUE_60_V1",
    generatedAt:new Date().toISOString(),
    sourceRacesFile:sourceFile,sourceSha256:digest(bytes),
    manifestSha256:digest(fs.readFileSync(manifestFile)),
    sourceMode:"READ_ONLY_TIMESTAMP_FILTERED_DB_NOT_PIT_CERTIFIED",
    cutoffMinutes:CUTOFF_MIN,thresholdPp:THRESHOLD_PP,
    selectionStrategy:"KEEP_D23_TOP2_SWAP_TOP3_WITH_HIGHEST_RISING_OUTSIDER",
    summary,missedWinners:missed,allRaces:results,
  };
  const columns=[
    "date","raceNo","raceId","winnerNo","winnerName",
    "d23WinnerRank","winnerInitialAgf","winnerLastAgf",
    "winnerTrendPp","winnerTrendStatus","trendSnapshotCount",
    "winnerRankBand","alertCatchesWinner","GAIN","LOSS",
    "addedNo","droppedNo","fieldTrendCoverage","fieldSize"
  ] as const;
  const csvLines=[columns.join(";"),...missed.map(r=>
    columns.map(k=>csv(r[k])).join(";"))];
  fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
  fs.writeFileSync(missesFile, csvLines.join("\r\n")+"\r\n",{flag:"wx"});
  console.log("[AGF-60] RACES=60 D23_MISSES=30");
  console.log("[AGF-60] WINNER_TREND_COVERAGE="+observedWinners+"/60"+
    " STARTER_TREND_COVERAGE="+observedStarters+"/"+starterCount);
  console.log("[AGF-60] RISING_MISSED_WINNERS="+upMiss.length+
    " RANK_4_6="+summary.missedWinnersRisingRank4to6+
    " RANK_7PLUS="+summary.missedWinnersRisingRank7plus);
  console.log("[AGF-60] OUTSIDE_TOP3_ALERT_CAUGHT="+summary.missedWinnersAlertCaught);
  console.log("[AGF-60] FIXED3_D23="+originalHits+
    " FIXED3_WITH_TREND="+overlayHits+
    " RESCUED="+rescued.length+" LOST="+lost.length+
    " NET="+summary.fixed3NetNewHits);
  console.log("[AGF-60] JSON="+reportFile);
  console.log("[AGF-60] CSV="+missesFile);
  console.log("[AGF-60] RELEASE_ALLOWED=FALSE NO_DB_WRITE_NO_RETRAIN_NO_DEPLOY");
}
main().catch(e=>{console.error("[AGF-60] ERROR="+String(e));process.exitCode=1;})
  .finally(async()=>{await db.$disconnect();});
