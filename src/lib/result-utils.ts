/**
 * "Tuttu" kuralı: tahminin 1. seçimi yarışı kesin olarak kazanırsa hit sayılır.
 * Top-3/top-6 gibi yakınsama kabul edilmez — kazanmayan at "tuttu" sayılmaz.
 * At başı/beraberlik (dead heat) durumunda TJK aynı SONUCNO=1'i birden fazla ata
 * verebiliyor — bu atların HEPSİ resmi kazanandır, herhangi biriyle eşleşme hit sayılır.
 */
export function computeHitTop1(
  actualOrder: unknown[] | null | undefined,
  winnerNos: number[] | null | undefined,
  pickNo: number | null | undefined
): boolean {
  if (pickNo == null || !winnerNos || winnerNos.length === 0) return false;
  return winnerNos.includes(pickNo);
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
 * Kazananlardan biri normal kuponun dışında ama geniş kuponun içindeyse true döner —
 * "Genişte yer aldı" uyarısı için kullanılır.
 */
export function wonOnlyInWideCoupon(
  winnerNos: number[] | null | undefined,
  couponNormal: string | null | undefined,
  couponWide: string | null | undefined
): boolean {
  if (!winnerNos || winnerNos.length === 0) return false;
  const normal = parseCouponNos(couponNormal);
  const wide = parseCouponNos(couponWide);
  if (normal.length === 0 && wide.length === 0) return false;
  const inNormal = winnerNos.some((no) => normal.includes(no));
  const inWide = winnerNos.some((no) => wide.includes(no));
  return !inNormal && inWide;
}
