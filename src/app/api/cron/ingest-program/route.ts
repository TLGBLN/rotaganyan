import { type NextRequest, NextResponse } from "next/server";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";

export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [todayResult, tomorrowResult] = await Promise.all([
    ingestDate(toTjkDate(now)),
    ingestDate(toTjkDate(tomorrow)),
  ]);

  const summary = (r: typeof todayResult) =>
    r.cities.map((c) => `${c.sehirAdi}: ${c.ok ? `${c.runners} koşucu` : `HATA: ${c.error}`}`);

  return NextResponse.json({
    today:    { date: toTjkDate(now),      cities: summary(todayResult) },
    tomorrow: { date: toTjkDate(tomorrow), cities: summary(tomorrowResult) },
  });
}
