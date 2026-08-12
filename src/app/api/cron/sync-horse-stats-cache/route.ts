import { type NextRequest, NextResponse } from "next/server";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await syncHorseStatsCache(150, 3);
  return NextResponse.json(result);
}
