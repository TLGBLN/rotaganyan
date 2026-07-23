const TZ = "Europe/Istanbul";

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
 * Verilen zamanı Türkiye saatindeki "duvar saati" değerlerini (yıl/ay/gün/saat/dakika)
 * taşıyan YENİ bir Date'e çevirir — date-fns'in format() fonksiyonu her zaman JS
 * motorunun YEREL saat dilimini okur (Vercel'de bu UTC'dir), bu yüzden format()'a
 * doğrudan verilen bir Date her zaman UTC saatini gösterir. Bu yardımcıyı kullanmadan
 * `format(new Date(n.createdAt), "HH:mm")` her zaman UTC saatini gösterir — kullanıcı
 * Türkiye saati bekler. formatDate/formatDateTime bu yüzden bunu sarmalıyor.
 */
export function toTurkeyWallClock(date: Date | string): Date {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour") % 24; // bazı motorlar gece yarısını "24" olarak verir
  return new Date(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
}
