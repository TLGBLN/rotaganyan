import { type NextRequest, NextResponse } from "next/server";
import { syncIdmanForDate } from "@/server/services/ingest/tjk-idman-stats.adapter";
import { turkeyDateString } from "@/lib/tz";

export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?date=YYYY-MM-DD override; otherwise bugün + yarın senkronlanır
  const dateParam = req.nextUrl.searchParams.get("date");
  const dates = dateParam ? [dateParam] : [turkeyDateString(), turkeyDateString(1)];

  const results = [];
  for (const d of dates) {
    results.push({ date: d, ...(await syncIdmanForDate(d)) });
  }

  return NextResponse.json({ results });
}