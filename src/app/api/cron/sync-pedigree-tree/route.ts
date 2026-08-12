import { type NextRequest, NextResponse } from "next/server";
import { syncMissingPedigreeTrees } from "@/server/services/ingest/tjk-pedigri.adapter";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await syncMissingPedigreeTrees(120);
  return NextResponse.json(result);
}
