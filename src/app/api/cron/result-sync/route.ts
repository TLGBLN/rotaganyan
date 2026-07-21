import { type NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { syncResultsForDate } from "@/server/services/result-sync";
import { syncJockeyStatsFromTjk, syncTrainerStatsFromTjk } from "@/server/services/race.service";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";
import { turkeyDateString } from "@/lib/tz";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = turkeyDateString();
  await syncResultsForDate(today);

  revalidatePath("/admin");
  revalidatePath("/");

  // Jokey ve antrenör istatistiklerini response sonrasında arka planda güncelle
  after(async () => {
    await syncJockeyStatsFromTjk();
    await syncTrainerStatsFromTjk();
    revalidatePath("/admin/jokey");
  });

  // Accurace sektörel zamanlama verisi de yarış bittikten sonra yayınlanıyor —
  // bugün VE dün için dene (Accurace bazen bir gün gecikmeli işliyor olabilir).
  after(async () => {
    await syncAccuraceForDate(today).catch(() => {});
    await syncAccuraceForDate(turkeyDateString(-1)).catch(() => {});
    revalidatePath("/admin/accurace");
  });

  return NextResponse.json({ ok: true, date: today });
}
