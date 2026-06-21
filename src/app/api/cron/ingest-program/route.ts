import { type NextRequest, NextResponse } from "next/server";
import { persistRaceDays, TjkAdapter, GanyanDefteriAdapter } from "@/server/services/ingest";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const PROVIDERS = [new TjkAdapter(), new GanyanDefteriAdapter()];

// Bugün + yarının koşu programını çeker. Geçmiş tarihlere hiç dokunmaz —
// her gün sabah çalışıp programı güncel tutmak içindir.
async function ingestDate(date: Date) {
  for (const provider of PROVIDERS) {
    try {
      const raceDays = await provider.fetchRaceDays(date);
      if (raceDays.length === 0) continue;
      const result = await persistRaceDays(raceDays);
      if (result.ok && result.inserted + result.updated > 0) return { provider: provider.name, ...result };
    } catch (err) {
      return { provider: provider.name, ok: false, error: String(err) };
    }
  }
  return { ok: false, reason: "Hiçbir sağlayıcıdan veri gelmedi" };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [todayResult, tomorrowResult] = await Promise.all([
    ingestDate(today),
    ingestDate(tomorrow),
  ]);

  return NextResponse.json({
    today: { date: today.toISOString().split("T")[0], ...todayResult },
    tomorrow: { date: tomorrow.toISOString().split("T")[0], ...tomorrowResult },
  });
}
