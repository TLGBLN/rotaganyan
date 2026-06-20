import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate } from "@/server/services/agf-sync";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Allow Vercel Cron (sets Authorization header from CRON_SECRET env) or manual calls with secret
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAgfForDate(new Date());
    const total = result.cities.reduce((s, c) => s + c.runnersUpdated, 0);
    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
