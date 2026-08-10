import { type NextRequest, NextResponse } from "next/server";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncHorseStatsCache(150, 3);
  return NextResponse.json(result);
}
