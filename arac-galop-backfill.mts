/**
 * KALICI ARAÇ — 2026-08-24: /admin/veri-tamligi denetiminde Galop kapsamının HER GÜN
 * (2026-07-01'den itibaren 57/57 gün) ~%10-20 eksik kaldığı görüldü — sync-galop cron'u
 * (src/app/api/cron/sync-galop/route.ts) yalnız "bugün + yarın" için çalışıyor, geçmiş
 * günlere hiç dönmüyor. Ama altındaki syncIdmanForDate (tjk-idman-stats.adapter.ts)
 * fonksiyonunun kendisi HERHANGİ bir tarihle çalışabiliyor — bugünün/yarının cron'undan
 * bağımsız. Bu araç, eksik kalan geçmiş günler için AYNI (test edilmiş, değiştirilmemiş)
 * fonksiyonu tekrar çağırır — yeni bir parse/eşleştirme mantığı YAZILMADI, sıfırdan
 * risk almamak için mevcut kod birebir yeniden kullanıldı.
 *
 * Tekrar çalıştırılabilir: fonksiyon zaten var olan galop kayıtlarını atlıyor
 * (bulkCountByName / coveredRunnerIds kontrolü), yalnız eksik kalanları TJK'dan çeker.
 */
import "dotenv/config";
import { db } from "./src/lib/db";
import { syncIdmanForDate } from "./src/server/services/ingest/tjk-idman-stats.adapter";

const rows = await db.$queryRawUnsafe<{ d: Date }[]>(`
  SELECT DISTINCT rd.date AS d
  FROM "Runner" r
  JOIN "Race" ra ON ra.id = r."raceId"
  JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
  JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
  WHERE r.scratched = false AND rd.date >= '2026-07-01' AND h.slug NOT IN ('karma','perak-malezya')
    AND NOT EXISTS (SELECT 1 FROM "Gallop" g WHERE g."runnerId" = r.id AND g.date < rd.date)
  ORDER BY rd.date ASC;
`);
const dates = rows.map((r) => r.d.toISOString().slice(0, 10));
console.log(`Eksik içeren ${dates.length} gün işlenecek.`);

let toplamSatir = 0, toplamHata = 0;
for (let i = 0; i < dates.length; i++) {
  const d = dates[i];
  try {
    const sonuc = await syncIdmanForDate(d);
    toplamSatir += sonuc.rows;
    toplamHata += sonuc.errors.length;
    console.log(`[${i + 1}/${dates.length}] ${d}: ${sonuc.hippodromes} hipodrom, ${sonuc.rows} satır yazıldı, ${sonuc.skipped} atlandı, ${sonuc.errors.length} hata`);
  } catch (e) {
    console.log(`[${i + 1}/${dates.length}] ${d}: TAM HATA — ${String(e).slice(0, 200)}`);
  }
}
console.log(`\nBİTTİ — toplam ${toplamSatir} galop satırı yazıldı, ${toplamHata} hata.`);
await db.$disconnect();
