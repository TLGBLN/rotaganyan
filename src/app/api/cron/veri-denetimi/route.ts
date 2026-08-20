import { type NextRequest, NextResponse } from "next/server";
import { runVeriDenetimi } from "@/server/services/veri-denetimi.service";
import { verifyCronRequest } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await runVeriDenetimi();
  return NextResponse.json(sonuc);
}
