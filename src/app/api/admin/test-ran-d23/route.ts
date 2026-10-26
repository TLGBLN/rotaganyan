import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { runD23StagingRace } from "@/lib/rotaganyan-analiz-motoru/ran-d23-staging";

export const runtime = "nodejs";
/**
 * Private read-only research route. The production site stays on its existing
 * engine until a separate release passes full train/live, PIT and coupon parity.
 */
export async function POST(req:NextRequest) {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({error:"D23 production release is blocked pending verification"},{status:404});
  const session=await auth();
  if(!session?.user || !hasRole(session.user.role as Role,"EDITOR"))
    return NextResponse.json({error:"Yetkisiz"},{status:401});
  let body:{raceId?:unknown};
  try { body=await req.json() as {raceId?:unknown}; }
  catch { return NextResponse.json({error:"Bad JSON"},{status:400}); }
  if(typeof body.raceId!=="string" || !body.raceId.trim())
    return NextResponse.json({error:"raceId required"},{status:400});
  try {
    const out=await runD23StagingRace(body.raceId);
    return NextResponse.json(out,{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    console.error("[test-ran-d23]",e);
    return NextResponse.json({error:e instanceof Error?e.message:"Staging prediction failed"},{status:422});
  }
}
