import { type NextRequest, NextResponse } from "next/server";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncGalopForDate } from "@/server/services/ingest/liderform-galop.adapter";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // 1. Program ingest: bugün + yarın
  const [todayResult, tomorrowResult] = await Promise.all([
    ingestDate(toTjkDate(now)),
    ingestDate(toTjkDate(tomorrow)),
  ]);

  // 2. Galop sync: program yüklendikten sonra bugün + yarın
  const [todayGalop, tomorrowGalop] = await Promise.all([
    syncGalopForDate(toIsoDate(now)).catch((e: unknown) => ({ pages: 0, horses: 0, rows: 0, skipped: 0, errors: [String(e)] })),
    syncGalopForDate(toIsoDate(tomorrow)).catch((e: unknown) => ({ pages: 0, horses: 0, rows: 0, skipped: 0, errors: [String(e)] })),
  ]);

  const summary = (r: typeof todayResult) =>
    r.cities.map((c) => `${c.sehirAdi}: ${c.ok ? `${c.runners} koşucu` : `HATA: ${c.error}`}`);

  return NextResponse.json({
    today: {
      date: toTjkDate(now),
      cities: summary(todayResult),
      galop: { pages: todayGalop.pages, horses: todayGalop.horses, rows: todayGalop.rows, skipped: todayGalop.skipped },
    },
    tomorrow: {
      date: toTjkDate(tomorrow),
      cities: summary(tomorrowResult),
      galop: { pages: tomorrowGalop.pages, horses: tomorrowGalop.horses, rows: tomorrowGalop.rows, skipped: tomorrowGalop.skipped },
    },
  });
}
