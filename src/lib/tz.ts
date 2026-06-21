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
