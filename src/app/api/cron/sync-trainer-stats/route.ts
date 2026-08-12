import { NextRequest, NextResponse } from "next/server";
import { syncTrainerStatsFromTjk } from "@/server/services/race.service";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const count = await syncTrainerStatsFromTjk(undefined, { includeMissing: true });
  return NextResponse.json({ ok: true, count, ts: new Date().toISOString() });
}