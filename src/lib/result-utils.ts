/**
 * "Tuttu" kuralı: tahminin 1. seçimi yarışı kesin olarak kazanırsa hit sayılır.
 * Top-3/top-6 gibi yakınsama kabul edilmez — kazanmayan at "tuttu" sayılmaz.
 */
export function computeHitTop1(
  actualOrder: unknown[] | null | undefined,
  winnerNo: number | null | undefined,
  pickNo: number | null | undefined
): boolean {
  if (pickNo == null || winnerNo == null) return false;
  return pickNo === winnerNo;
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
