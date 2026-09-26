import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate, recordAgfCronRun } from "@/server/services/agf-sync";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runChallengerShadowLog } from "@/server/services/challenger-shadow-log.service";
import { runSr6ShadowLog, enrichSr6ShadowOutcomes } from "@/server/services/sr6-shadow-log.service";
import { dereceIstatistikleriniKontrolEtVeOnar, atProfiliniKontrolEtVeOnar } from "@/server/services/veri-tamligi-onarim.service";
import { runHotWatchdogIfDue } from "@/server/services/ingest/tjk-at-profil.adapter";

// v6.69 — kullanıcı bulgusu 2026-08-09: çoklu şehir günlerinde (İstanbul+İzmir+Karma
// aynı anda) sıralı işleme 60sn'yi aşıp cron'u sessizce (Vercel 504) başarısız kılıyordu —
// İstanbul'un AGF verisi 4+ saat güncellenmeden kalmıştı. Diğer ağır sync cron'larıyla
// (ingest-program, sync-galop vb.) aynı üst sınıra çekildi; ayrıca agf-sync.ts'teki
// per-runner DB yazımı artık paralel.
export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  let result: Awaited<ReturnType<typeof syncAgfForDate>>;
  try {
    result = await syncAgfForDate(new Date());
  } catch (err) {
    await recordAgfCronRun({ ok: false, error: String(err) }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  await recordAgfCronRun({ ok: true, result }).catch(() => {});

  try {
    const total = result.cities.reduce((s, c) => s + c.runnersUpdated, 0);

    // 2026-08-29 — V6 Aşama 3 (bkz. plan): asalak ekleme deseni (sync-derece-ist/
    // veri-denetimi emsali, 2026-08-25 — yeni cron path'leri Vercel'e hiç kaydolmayabiliyor)
    // — ayrı /api/cron/challenger-shadow-log rotası da var ama buraya da güvenlik ağı
    // olarak eklendi. Hata durumunda AGF senkronunu ASLA bloke etmez/başarısız kılmaz.
    try {
      await runChallengerShadowLog();
    } catch (e) {
      console.error("[agf-sync] challenger-shadow-log piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    // 2026-09-26 — SR6 Shadow Logger (bkz. proje hafızası: Surprise Rescue SR6-HC) —
    // AYNI piggyback deseni: AGF her senkronlandığında T3-A adayı gerçek (senkronlanmış)
    // veriyle değerlendirilebilir hale gelir (first-valid-snapshot ön koşulu), bu yüzden
    // AGF sync SONRASI SR6'yı kontrol etmek doğal bir tetikleyici. Ayrıca kendi ayrı
    // cron'unun (/api/cron/sr6-shadow-log) "yeni path Vercel'e kaydolmayabiliyor" riskine
    // karşı ikinci güvenlik ağı. Hata durumunda AGF senkronunu ASLA bloke etmez/etkilemez.
    try {
      await runSr6ShadowLog();
      await enrichSr6ShadowOutcomes();
    } catch (e) {
      console.error("[agf-sync] sr6-shadow-log piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    // 2026-08-30 — kullanıcı talebi: veri-tamligi'nin kanıtlanmış-kırılgan alanı (Derece
    // İstatistikleri) için ikinci bir güvenlik ağı. Kontrol sorgusu ucuz (yalnız COUNT) —
    // onarım GEREKMEDİKÇE (haftada birkaç gün eksikse) tetiklenmez, gerektiğinde nadiren
    // uzun sürer. Hata durumunda AGF senkronunu ASLA bloke etmez/başarısız kılmaz.
    try {
      await dereceIstatistikleriniKontrolEtVeOnar();
    } catch (e) {
      console.error("[agf-sync] veri-tamligi-onarim piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    // 2026-08-30 (aynı gün, ikinci tur) — At profil önbelleği de kanıtlanmış/fixable
    // bulununca aynı güvenlik ağına ikinci alan olarak eklendi. Kontrol ucuz (tek COUNT
    // sorgusu), onarım yalnız backlog eşiği aşılırsa tetiklenir (bkz. AT_PROFIL_ESIK).
    try {
      await atProfiliniKontrolEtVeOnar();
    } catch (e) {
      console.error("[agf-sync] at-profili-onarim piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    // 2026-09-24 — HOT Cache Watchdog need-aware fallback (bkz. runHotWatchdogIfDue) — artık
    // agf-sync/result-sync/ingest-program ÜÇÜ de aynı ucuz due-check'i paylaşıyor, yalnız
    // GERÇEKTEN ihtiyaç varsa (SLA ihlali) ağır iş çalışır. Hata durumunda AGF senkronunu
    // ASLA bloke etmez/başarısız kılmaz.
    try {
      await runHotWatchdogIfDue({ source: "agf-sync" });
    } catch (e) {
      console.error("[agf-sync] hot-cache-watchdog piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
