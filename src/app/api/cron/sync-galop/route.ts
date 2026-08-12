import { type NextRequest, NextResponse } from "next/server";
import { syncIdmanForDate } from "@/server/services/ingest/tjk-idman-stats.adapter";
import { turkeyDateString } from "@/lib/tz";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  // Optional ?date=YYYY-MM-DD override; otherwise bugün + yarın senkronlanır
  const dateParam = req.nextUrl.searchParams.get("date");
  const dates = dateParam ? [dateParam] : [turkeyDateString(), turkeyDateString(1)];

  const results = await Promise.all(dates.map(async (d) => ({ date: d, ...(await syncIdmanForDate(d)) })));

  return NextResponse.json({ results });
}