// ADMIN DEV-ONLY: RAN'nin bizzat hesapladigi snapshot'lari tek havuzda dondurur.
// Prediction / Pick / HomeKupon'u degistirmez. Production'da KAPALIDIR.
import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { runRanEngineForRace } from "@/app/api/admin/test-ran-engine/route";
import { buildRanSnapshotBundle, readRanSnapshotBundle, type RanBundleLeg } from "@/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle";
import { persistRanSnapshotBundle, loadRanSnapshotBundle } from "@/server/services/ran-snapshot-bundle.service";

async function authorized(): Promise<boolean> {
  const session=await auth();
  return !!session?.user && hasRole(session.user.role as Role, "EDITOR");
}
function disabled() {
  return NextResponse.json({error:"RAN test bundle production'da kapali."}, {status:404});
}
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return disabled();
  if (!(await authorized())) return NextResponse.json({error:"Yetkisiz"}, {status:401});
  const id=new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({error:"id gerekli"}, {status:400});
  try {
    const saved=await loadRanSnapshotBundle(id);
    if (!saved) return NextResponse.json({error:"Snapshot paketi bulunamadi"}, {status:404});
    return NextResponse.json(saved);
  } catch (e) {
    console.error("[test-ran-bundle][GET]",e);
    return NextResponse.json({error:"RAN bundle okunamadi / semantik butunluk bozuk"}, {status:500});
  }
}
type Input = {
  legs: {raceId: string; raceNo: number}[];
  maxCombinations: number;
  persist?: boolean;
};
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return disabled();
  if (!(await authorized())) return NextResponse.json({error:"Yetkisiz"}, {status:401});
  let input: Input;
  try {input=await req.json() as Input;}
  catch {return NextResponse.json({error:"JSON bozuk"}, {status:400});}
  if (!Array.isArray(input.legs) || input.legs.length !== 6 ||
      !input.legs.every((r)=>r && typeof r.raceId==="string" && r.raceId.length>0 && Number.isSafeInteger(r.raceNo)) ||
      !Number.isSafeInteger(input.maxCombinations) || input.maxCombinations < 1 ||
      (input.persist != null && typeof input.persist !== "boolean")) {
    return NextResponse.json({error:"Tam 6 ayak, raceId/raceNo ve maxCombinations gerekli"}, {status:400});
  }
  if (input.persist === true && process.env.RAN_SHADOW_SNAPSHOT_WRITES !== "isolated-test-only") {
    return NextResponse.json({error:"Izole DB yazma izni yok"}, {status:403});
  }
  try {
    // Tek server-side as-of engine kaynagi: istemciden puan/sira/snapshot ALINMAZ.
    const legs: RanBundleLeg[]=[];
    let dayKey: string|null=null;
    for (const leg of input.legs) {
      const race=await db.race.findUnique({
        where:{id:leg.raceId},
        select:{
          raceNo:true,
          raceDay:{select:{date:true, hippodrome:{select:{name:true}}}},
          runners:{where:{scratched:false},select:{no:true, ekuriGroup:true}},
        },
      });
      if (!race || race.raceNo !== leg.raceNo) throw new Error("RACE_ID/RACE_NO_MISMATCH");
      const context=race.raceDay.date.toISOString().slice(0,10)+":"+race.raceDay.hippodrome.name;
      if (dayKey!==null && dayKey!==context) throw new Error("MIXED_RACE_DAY_OR_HIPPODROME");
      dayKey=context;
      const r=await runRanEngineForRace(leg.raceId);
      const ekuri=new Map(race.runners.map((x)=>[x.no,x.ekuriGroup]));
      if (r.atlar.length !== race.runners.length || r.atlar.some(x=>!ekuri.has(x.no))) {
        throw new Error("RUNNER_FIELD_MISMATCH");
      }
      legs.push({raceId:leg.raceId,raceNo:leg.raceNo,
        runners:r.atlar.map((x)=>({...x,ekuriGroup:ekuri.get(x.no)??null,scratched:false}))});
    }
    const bundle=buildRanSnapshotBundle(legs,input.maxCombinations,new Date().toISOString());
    const view=readRanSnapshotBundle(bundle);
    const stored=input.persist ? await persistRanSnapshotBundle(bundle):null;
    return NextResponse.json({...view, storage: stored ?? "NOT_PERSISTED", publication:"DISABLED"});
  } catch(e) {
    console.error("[test-ran-bundle][POST]",e);
    return NextResponse.json({error: e instanceof Error ? e.message:"RAN bundle olusturulamadi"}, {status:422});
  }
}
