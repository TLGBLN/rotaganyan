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

/**
 * hitTop1/hitInCoupon YALNIZ sonuç ilk geldiği anda (result-sync.ts/race.actions.ts'in
 * db.result.create'i) bir kereye mahsus hesaplanıyordu — tahmin SONRADAN düzenlenip
 * yeniden kaydedilirse (ör. admin bir at seçimini düzeltirse, ya da bugünkü oturumda
 * defalarca olduğu gibi analiz sonucu düzeltilip yeniden yayınlanırsa) bu iki alan
 * sonsuza kadar BAYAT kalıyordu — kullanıcı denetimi (2026-07-27) bunu Puan Tablosu'nun
 * gerçek isabet oranını (%38 gösterirken gerçek %67'ymiş) yanlış göstermesine yol açtığını
 * ortaya çıkardı. Bu fonksiyon, GÜNCEL picks'ten yeniden hesaplayıp Result'u senkron tutar —
 * upsertPrediction'ın sonunda (sonuç zaten varsa) çağrılır.
 */
export async function recomputeHitStatsForRace(raceId: string): Promise<void> {
  const { db } = await import("@/lib/db");
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      result: { select: { id: true, actualOrder: true, winnerNos: true, hitTop1: true, hitInCoupon: true } },
      prediction: {
        select: { picks: { where: { rank: { lte: 3 } }, select: { rank: true, runner: { select: { no: true } } } } },
      },
    },
  });
  if (!race?.result) return;
  const picks = race.prediction?.picks ?? [];
  const topPick = picks.find((p) => p.rank === 1);
  const winnerNos = race.result.winnerNos as number[];
  const hitTop1 = computeHitTop1(race.result.actualOrder as unknown[], winnerNos, topPick?.runner?.no);
  const top3Nos = picks.map((p) => p.runner?.no).filter((n): n is number => n != null);
  const hitInCoupon = winnerNos.some((no) => top3Nos.includes(no));
  if (hitTop1 === race.result.hitTop1 && hitInCoupon === race.result.hitInCoupon) return;
  await db.result.update({ where: { id: race.result.id }, data: { hitTop1, hitInCoupon } });
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
