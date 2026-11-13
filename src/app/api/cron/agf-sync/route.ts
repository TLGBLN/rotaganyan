import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate } from "@/server/services/agf-sync";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runChallengerShadowLog } from "@/server/services/challenger-shadow-log.service";

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

    // 2026-11-13 KÖK NEDEN DÜZELTMESİ (GitHub 'AGF Sync' iş akışı sürekli 13 dk 23 sn'de başarısız oluyordu = maxDuration 800 sn sınırı):
    // Bu rotaya 'asalak' olarak eklenen ağır işler her çağrıda çalışıyordu:
    //  - dereceIstatistikleriniKontrolEtVeOnar: Derece arşivi 7 gün geride olduğu için HER çağrıda TJK'dan tüm yılı (10 şehir × ~210 sayfa)
    //    taramaya çalışıyordu; tek çağrıya sığmayıp 800 sn'de öldürülüyor, yazma EN SONDA olduğu için hiçbir şey kaydedilmiyor, arşiv
    //    hiç ilerlemiyor, koşul hiç düzelmiyor → her 15 dakikada yeniden tetikleniyordu (kısır döngü; arşiv 06 Kasım'da takıldı).
    //  - atProfiliniKontrolEtVeOnar: 400 atlık TJK taraması.
    // AGF senkronu hızlı ve güvenilir olmalı; bu işlerin kendi cron'ları var (sync-derece-ist, veri-tamligi-onarim, sync-horse-stats-cache).
    // Shadow-log ise sınırlı çalışır: son yazımdan 45 dk geçmediyse atlanır, süre bütçesi 120 sn. Hata AGF senkronunu ASLA bloke etmez.
    try {
      const shadow = await runChallengerShadowLog(new Date(), { maksMs: 120_000, minAralikDk: 45 });
      if (shadow.sureAsimi) console.warn("[agf-sync] challenger-shadow-log süre bütçesini aştı (kalan koşular sonraki çağrıda)");
    } catch (e) {
      console.error("[agf-sync] challenger-shadow-log piggyback hatası (AGF senkronu etkilenmedi)", e);
    }
    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
