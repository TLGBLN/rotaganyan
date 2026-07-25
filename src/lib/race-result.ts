/** Result.actualOrder (JSON, bitiş sırasıyla at numaraları) içinde verilen atın kaçıncı
 *  bitirdiğini bulur — bulunamazsa null. Tek kaynak: PuanTablosu.tsx ve own-stat hesaplama
 *  servisi (pedigri-own-stat.service.ts) aynı parse mantığını paylaşır.
 *  At başı/beraberlik (dead heat): winnerNos verilirse ve at bu listedeyse (actualOrder'daki
 *  konumu ne olursa olsun) 1. sıra döner — TJK'da tüm beraber kazananlar resmi 1.'dir. */
export function finishPos(
  actualOrder: unknown,
  runnerNo: number | null | undefined,
  winnerNos?: number[] | null
): number | null {
  if (!Array.isArray(actualOrder) || runnerNo == null) return null;
  if (winnerNos && winnerNos.includes(runnerNo)) return 1;
  const idx = (actualOrder as string[]).findIndex((s) => parseInt(String(s), 10) === runnerNo);
  return idx >= 0 ? idx + 1 : null;
}
