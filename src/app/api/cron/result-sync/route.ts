import { type NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { syncResultsForDate, recordResultSyncCronRun } from "@/server/services/result-sync";
import { syncJockeyStatsFromTjk, syncTrainerStatsFromTjk } from "@/server/services/race.service";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";
import { syncAltiliIkramiyeLog } from "@/server/services/altili-ikramiye-log.service";
import { turkeyDateString } from "@/lib/tz";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runRaceContextWatch } from "@/app/api/cron/race-context-watch/route";
import { reconcileAllActiveHomeKupons } from "@/server/services/home-kupon-sync.service";
import { runProgramSyncIfDue } from "@/server/services/ingest/tjk-info.adapter";

// 2026-09-24 kullanıcı kararı — Program Sync fallback piggyback'i (bkz. runProgramSyncIfDue)
// için 60sn yetersiz: gerçek bir fallback ingest ~90-120sn sürebilir (bugün+yarın, paralel,
// her biri kendi içinde city-city SIRALI+400ms bekleme). due-check'in KENDİSİ ucuz (tek
// findUnique) — yalnız GERÇEKTEN çalıştığı (günde en fazla birkaç kez, 11/13/15/17 UTC
// slotlarından biri boşsa) nadir anlarda bu üst sınıra ihtiyaç var. Normal result-sync
// turlarının süresi (birkaç saniye) DEĞİŞMİYOR — bu yalnız bir TAVAN, zorunlu bekleme değil.
export const maxDuration = 150;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const today = turkeyDateString();
  const startedAt = Date.now();
  try {
    await syncResultsForDate(today);
  } catch (err) {
    await recordResultSyncCronRun({ ok: false, durationMs: Date.now() - startedAt, error: String(err) }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  await recordResultSyncCronRun({ ok: true, durationMs: Date.now() - startedAt }).catch(() => {});

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

  // 2026-09-12 kullanıcı talebi — "Altılı Ne Verir?" kalibrasyonu için (havuzBuyuklugu,
  // katsayi, gercekIkramiye) veri toplama. Bu cron zaten 5dk'da bir 11-21 arası çalışıyor —
  // hem havuz hâlâ açıkken hem sonuçlandığı an yakalamak için ideal sıklık. Yeni cron kaydı
  // AÇMADAN (bkz. proje hafızası: Vercel Cron Kayıt Bugu) mevcut çalışan cron'a eklendi.
  after(async () => {
    await syncAltiliIkramiyeLog().catch(() => {});
  });

  // 2026-09-21 — bkz. [[project_vercel_cron_kayit_bugu]]: race-context-watch VE
  // homekupon-reconcile TAMAMEN YENİ path oldukları için Vercel'in cron kaydına hiç
  // işlenmedi (belgeli, kalıcı platform kısıtı). Bu ikisi de zaten çalışan bu cron'a
  // asalak eklendi — birbirinden BAĞIMSIZ, biri hata verirse diğerini etkilemez.
  after(async () => {
    await runRaceContextWatch().catch((e) => console.error("[result-sync piggyback] race-context-watch hata:", e));
  });
  after(async () => {
    await reconcileAllActiveHomeKupons().catch((e) => console.error("[result-sync piggyback] homekupon-reconcile hata:", e));
  });

  // 2026-09-24 — Program Sync fallback (bkz. runProgramSyncIfDue, tjk-info.adapter.ts):
  // ingest-program cron'unun Vercel'de yalnız 3/6 declared saati (05/08/11 UTC) gerçekten
  // KAYITLI, 13/15/17 hiç tetiklenmiyordu (gerçek bulgu, agf-sync'teki diff false-alarm'ından
  // FARKLI). Bu piggyback yalnız DUE olduğunda (ucuz bir DB kontrolü, günde en fazla birkaç
  // kez) gerçek bir fallback ingest çalıştırır — result-sync'in KENDİSİNİ ASLA ETKİLEMEZ
  // (Program piggyback failure ≠ Result Sync failure, kullanıcı kararı).
  after(async () => {
    await runProgramSyncIfDue().catch((e) => console.error("[result-sync piggyback] program-sync-fallback hata:", e));
  });

  return NextResponse.json({ ok: true, date: today });
}
