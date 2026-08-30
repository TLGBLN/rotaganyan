export const TZ = "Europe/Istanbul";

/**
 * Sunucu UTC'de çalışsa da (Vercel), "bugün" her zaman Türkiye saatine göre hesaplanır.
 * Gece yarısından sonra (TR 00:00–03:00 arası UTC henüz önceki günde) sunucu saat
 * dilimine güvenmek "bugün"ü bir gün eski gösterir — bu yüzden new Date() yerine
 * bu yardımcı kullanılmalı.
 */
export function turkeyDateString(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Verilen zamanı, verilen saat dilimindeki "duvar saati" değerlerini (yıl/ay/gün/saat/
 * dakika) taşıyan YENİ bir Date'e çevirir — date-fns'in format() fonksiyonu her zaman
 * JS motorunun YEREL saat dilimini okur (Vercel'de bu UTC'dir), bu yüzden format()'a
 * doğrudan verilen bir Date her zaman UTC saatini gösterir. Bu yardımcıyı kullanmadan
 * `format(new Date(n.createdAt), "HH:mm")` her zaman UTC saatini gösterir.
 *
 * 2026-08-30 kullanıcı kararı: TR arayüzü Türkiye saati (Europe/Istanbul), EN arayüzü
 * UTC göstermeli — bu yüzden Türkiye'ye SABİT değil, herhangi bir IANA saat dilimi
 * kabul edecek şekilde genelleştirildi (bkz. formatDateForLocale, utils.ts).
 */
export function toWallClockInTz(date: Date | string, timeZone: string): Date {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") % 24; // bazı motorlar gece yarısını "24" olarak verir
  return new Date(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
}

/** Geriye dönük uyumluluk — Türkiye saatine sabit. Yeni kod formatDateForLocale
 *  (utils.ts) veya doğrudan toWallClockInTz(date, "Europe/Istanbul") kullanmalı. */
export function toTurkeyWallClock(date: Date | string): Date {
  return toWallClockInTz(date, TZ);
}

/** İki zamanın Türkiye saatine göre AYNI takvim gününde olup olmadığını kontrol eder — "bugün gösterildi mi" gibi günlük tekrar kontrolleri için. */
export function isSameTurkeyDay(a: Date, b: Date): boolean {
  const wa = toTurkeyWallClock(a);
  const wb = toTurkeyWallClock(b);
  return wa.getFullYear() === wb.getFullYear() && wa.getMonth() === wb.getMonth() && wa.getDate() === wb.getDate();
}
