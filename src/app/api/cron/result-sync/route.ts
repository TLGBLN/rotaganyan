import { type NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { syncResultsForDate } from "@/server/services/result-sync";
import { syncJockeyStatsFromTjk, syncTrainerStatsFromTjk } from "@/server/services/race.service";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";
import { syncAltiliIkramiyeLog } from "@/server/services/altili-ikramiye-log.service";
import { turkeyDateString } from "@/lib/tz";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncOwnPedigreeStats } from "@/server/services/pedigri-own-stat.service";
import { db } from "@/lib/db";

export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const today = turkeyDateString();
  const todayDate = new Date(today + "T00:00:00.000Z");

  const resultCountBefore = await db.result.count({
    where: { race: { raceDay: { date: todayDate } } },
  });

  await syncResultsForDate(today);

  const resultCountAfter = await db.result.count({
    where: { race: { raceDay: { date: todayDate } } },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/admin/pedigri");

  // Yeni resmi sonuç gerçekten DB'ye yazıldıysa Own pedigree istatistiklerini hemen
  // yenile. Böylece /admin/pedigri yalnız gece cron'unu beklemez; Sire/Dam/DamSire
  // istatistikleri yarışlar sonuçlandıkça büyür. Boş 5 dakikalık turlarda ağır yeniden
  // hesaplama yapılmaz.
  if (resultCountAfter > resultCountBefore) {
    after(async () => {
      await syncOwnPedigreeStats().catch((e) =>
        console.error("[result-sync] pedigri own sync hata:", e)
      );
      revalidatePath("/admin/pedigri");
    });
  }

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

  // 2026-09-12 kullanıcı talebi — "Altılı Ne Verir?" kalibrasyonu için (havuzBuyuklugu,
  // katsayi, gercekIkramiye) veri toplama. Bu cron zaten 5dk'da bir 11-21 arası çalışıyor —
  // hem havuz hâlâ açıkken hem sonuçlandığı an yakalamak için ideal sıklık. Yeni cron kaydı
  // AÇMADAN (bkz. proje hafızası: Vercel Cron Kayıt Bugu) mevcut çalışan cron'a eklendi.
  after(async () => {
    await syncAltiliIkramiyeLog().catch(() => {});
  });

  return NextResponse.json({ ok: true, date: today });
}
