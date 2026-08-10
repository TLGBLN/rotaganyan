/**
 * ANALİZ EŞZAMANLILIK KİLİDİ
 * ---------------------------------------------------------------
 * Sorun: AynÄ± raceId için admin panelden iki kez "Analiz Başlat"a
 * basılırsa (ya da bir cron + manuel tetikleme çakışırsa), iki paralel
 * istek aynı Claude çağrılarını tekrar yapabilir — ClaudeUsageLog
 * önbelleği (getRecentCachedResult, 60dk pencere) bunu TAM engellemez,
 * çünkü iki paralel istek aynı anda "önbellekte yok" görüp aynı anda
 * çağrı başlatabilir (race condition).
 *
 * Çözüm: Postgres'te tek bir UPDATE sorgusu atomiktir — iki paralel
 * istek aynı anda çalışsa bile yalnız biri claimed.count === 1 alır,
 * diğeri 0 alır ve hemen durur. Ayrı bir mutex/lock servisi gerekmez.
 *
 * v6.99 — bu projenin kendi `@/lib/db` singleton'ı (özel PrismaPg
 * adaptörü + max:25 havuz ayarıyla) kullanılıyor — YENİ bir
 * PrismaClient() AÇILMIYOR (bu, /program yavaşlığında çözülen "çok
 * fazla eşzamanlı bağlantı" sorununu büyütürdü).
 */

import { db } from "@/lib/db";

export type ClaimSonucu =
  | { basarili: true }
  | { basarili: false; sebep: "zaten_devam_ediyor" };

/** Kilidin ne kadar süre sonra "askıda kalmış" sayılıp otomatik serbest
 * bırakılacağı — bir istek sunucu tarafında çökerse (Vercel'in fonksiyonu
 * sonlandırması vb.) kilit sonsuza kadar IN_PROGRESS'te kalıp koşuyu
 * kilitlemesin diye. Tek bir grup/sıralama çağrısı (thinking dahil)
 * birkaç dakikayı geçmemeli — 15dk cömert bir güvenlik payı.
 */
const STALE_LOCK_MS = 15 * 60 * 1000;

/**
 * Bir koşunun analizini (yalnız İLK adım — batchIndex 0) "üstlenmeye"
 * çalışır. Başarılıysa çağıran taraf analiz işini başlatabilir;
 * başarısızsa hiçbir Claude çağrısı yapmadan çıkmalıdır.
 */
export async function analizKilidiAl(raceId: string): Promise<ClaimSonucu> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_LOCK_MS);

  const claimed = await db.race.updateMany({
    where: {
      id: raceId,
      OR: [
        { analysisStatus: "IDLE" },
        { analysisStatus: "IN_PROGRESS", analysisClaimedAt: { lt: staleThreshold } },
      ],
    },
    data: { analysisStatus: "IN_PROGRESS", analysisClaimedAt: now },
  });

  if (claimed.count === 0) {
    return { basarili: false, sebep: "zaten_devam_ediyor" };
  }
  return { basarili: true };
}

/** Analiz bitince (başarılı ya da başarısız) kilidi serbest bırakır —
 * hemen IDLE'a döner, admin isterse anında tekrar deneyebilir (15dk'lık
 * stale-timeout'u beklemek zorunda kalmaz). */
export async function analizKilidiBirak(raceId: string): Promise<void> {
  await db.race.update({
    where: { id: raceId },
    data: { analysisStatus: "IDLE", analysisClaimedAt: null },
  }).catch(() => {
    // Kilit bırakma sessizce başarısız olsa bile (ör. raceId bulunamadı)
    // ana akışı bloklamamalı — en kötü ihtimalle 15dk sonra stale-timeout
    // devreye girer.
  });
}
