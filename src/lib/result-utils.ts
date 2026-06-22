/** actualOrder girişleri hem sayı hem string ("3") olarak kaydedilmiş olabilir. */
function toRunnerNo(entry: unknown): number | null {
  if (typeof entry === "number") return entry;
  if (typeof entry === "string") {
    const n = parseInt(entry, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * "Tuttu" kuralı: tahminin 1. seçimi gerçek sonuçta ilk 6'ya girerse hit sayılır
 * (sadece kesin 1.lik değil). actualOrder boşsa (manuel girişte sık), winnerNo'ya
 * düşülür — kazanan zaten ilk 6'nın içinde olduğundan bu da geçerli bir top-6 sinyalidir.
 */
export function computeHitTop1(
  actualOrder: unknown[] | null | undefined,
  winnerNo: number | null | undefined,
  pickNo: number | null | undefined
): boolean {
  if (pickNo == null) return false;
  const normalized = (actualOrder ?? []).map(toRunnerNo).filter((n): n is number => n != null);
  const top6 = normalized.length > 0 ? normalized.slice(0, 6) : winnerNo != null ? [winnerNo] : [];
  return top6.includes(pickNo);
}

/** "1-3-7" gibi tire ile ayrılmış kupon string'ini at numaralarına çevirir. */
export function parseCouponNos(coupon: string | null | undefined): number[] {
  if (!coupon) return [];
  return coupon
    .split("-")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/**
 * Kazanan at normal kuponun dışında ama geniş kuponun içindeyse true döner —
 * "Genişte yer aldı" uyarısı için kullanılır.
 */
export function wonOnlyInWideCoupon(
  winnerNo: number | null | undefined,
  couponNormal: string | null | undefined,
  couponWide: string | null | undefined
): boolean {
  if (winnerNo == null) return false;
  const normal = parseCouponNos(couponNormal);
  const wide = parseCouponNos(couponWide);
  if (normal.length === 0 && wide.length === 0) return false;
  return !normal.includes(winnerNo) && wide.includes(winnerNo);
}
