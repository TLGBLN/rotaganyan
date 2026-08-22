import { NextRequest, NextResponse } from "next/server";
import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const yil = new Date().getUTCFullYear();
  const sonuc = await syncDereceIstatistikleri(yil);
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
