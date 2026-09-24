/**
 * Race.time TJK'dan gelen ham "HH:mm" (Türkiye duvar saati, sabit UTC+3) + RaceDay.date (UTC gece yarısı) → yarışın başlangıç anı (UTC).
 * Geçersiz/eksik/kaymış girdide null döner — çağıran "başlangıcı bilinmiyor" diye ele alır, ASLA varsayımsal bir an üretilmez.
 */
export function raceStartAtUtc(dayDate: Date, time: string | null | undefined): Date | null {
  if (!(dayDate instanceof Date) || !Number.isFinite(dayDate.getTime())) return null;
  if (dayDate.getUTCHours() !== 0 || dayDate.getUTCMinutes() !== 0 || dayDate.getUTCSeconds() !== 0 || dayDate.getUTCMilliseconds() !== 0) return null;
  const m = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim()) : null;
  if (!m) return null;
  return new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), Number(m[1]) - 3, Number(m[2])));
}
