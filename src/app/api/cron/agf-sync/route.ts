import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate } from "@/server/services/agf-sync";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runChallengerShadowLog } from "@/server/services/challenger-shadow-log.service";
import { dereceIstatistikleriniKontrolEtVeOnar } from "@/server/services/veri-tamligi-onarim.service";

// v6.69 — kullanıcı bulgusu 2026-08-09: çoklu şehir günlerinde (İstanbul+İzmir+Karma
// aynı anda) sıralı işleme 60sn'yi aşıp cron'u sessizce (Vercel 504) başarısız kılıyordu —
// İstanbul'un AGF verisi 4+ saat güncellenmeden kalmıştı. Diğer ağır sync cron'larıyla
// (ingest-program, sync-galop vb.) aynı üst sınıra çekildi; ayrıca agf-sync.ts'teki
// per-runner DB yazımı artık paralel.
export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await syncAgfForDate(new Date());
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

    // 2026-08-30 — kullanıcı talebi: veri-tamligi'nin kanıtlanmış-kırılgan alanı (Derece
    // İstatistikleri) için ikinci bir güvenlik ağı. Kontrol sorgusu ucuz (yalnız COUNT) —
    // onarım GEREKMEDİKÇE (haftada birkaç gün eksikse) tetiklenmez, gerektiğinde nadiren
    // uzun sürer. Hata durumunda AGF senkronunu ASLA bloke etmez/başarısız kılmaz.
    try {
      await dereceIstatistikleriniKontrolEtVeOnar();
    } catch (e) {
      console.error("[agf-sync] veri-tamligi-onarim piggyback hatası (AGF senkronu etkilenmedi)", e);
    }

    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
