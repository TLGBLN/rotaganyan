import { type NextRequest, NextResponse } from "next/server";
import { syncYarisStiliForDate } from "@/server/services/yaris-stili.service";

// Kendi cron'u — daha önce ingest-program içindeydi ama program ingest + galop senkronuyla
// aynı istekte olduğu için toplam süre Vercel'in maxDuration sınırını (300s) aşıp
// yarış stili adımına hiç sıra gelmeden fonksiyon sonlanıyordu. Artık bağımsız çalışıyor.
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

  const today = await syncYarisStiliForDate(toIsoDate(now)).catch((e: unknown) => ({ atlar: 0, guncellenen: 0, errors: [String(e)] }));
  const tomorrowResult = await syncYarisStiliForDate(toIsoDate(tomorrow)).catch((e: unknown) => ({ atlar: 0, guncellenen: 0, errors: [String(e)] }));

  return NextResponse.json({
    today: { date: toIsoDate(now), ...today },
    tomorrow: { date: toIsoDate(tomorrow), ...tomorrowResult },
  });
}
