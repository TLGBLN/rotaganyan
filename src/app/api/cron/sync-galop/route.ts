import { type NextRequest, NextResponse } from "next/server";
import { syncGalopForDate } from "@/server/services/ingest/liderform-galop.adapter";

export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow overriding date via ?date=YYYY-MM-DD
  const dateParam = req.nextUrl.searchParams.get("date");
  const now = new Date();
  const dateStr =
    dateParam ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const result = await syncGalopForDate(dateStr);

  return NextResponse.json({ date: dateStr, ...result });
}
