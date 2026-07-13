import { type NextRequest, NextResponse } from "next/server";
import { syncGalopForDate } from "@/server/services/ingest/liderform-galop.adapter";

export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?date=YYYY-MM-DD override; otherwise auto-detects from liderform main page
  const dateParam = req.nextUrl.searchParams.get("date") ?? undefined;

  const result = await syncGalopForDate(dateParam);

  return NextResponse.json({ date: dateParam ?? "auto", ...result });
}
