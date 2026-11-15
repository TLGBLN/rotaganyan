// Bir koşuda KAYITLI tahminin (Pick.rank) kazananı kaçıncı sıraya koyduğu — Top1/Top3/Top6 TEK tanım.
// Top1  = kazanan kayıtlı 1. seçim            (kupon dışı "tek at" isabeti)
// Top3  = kazanan kayıtlı ilk 3 seçimden biri  (kapsama)
// Top6  = kazanan kayıtlı ilk 6 seçimden biri
// "Kayıtlı sıra" = Pick.rank (terfi/garanti mekanizmaları ham olasılıktan bilerek saptırabilir; admin bunu görmeli).
// Beraberlikte (birden fazla kazanan) EN İYİ sıradaki kazanan sayılır.
export type SiraliPick = { runnerLabel: string; rank: number };

const noOf = (label: string) => parseInt(String(label).match(/#(\d+)/)?.[1] ?? "", 10);

/** Kazananın kayıtlı model sırası (1 = en üst). Kazanan listede değilse null. */
export function kazananSirasi(winnerNos: number[], picks: SiraliPick[]): number | null {
  let en: number | null = null;
  for (const p of picks) {
    const n = noOf(p.runnerLabel);
    if (Number.isFinite(n) && winnerNos.includes(n)) en = en == null ? p.rank : Math.min(en, p.rank);
  }
  return en;
}

export type IsabetOzeti = { n: number; top1: number; top3: number; top6: number; listedeYok: number };

export function isabetOzeti(satirlar: { winnerNos: number[]; picks: SiraliPick[] }[]): IsabetOzeti {
  const o: IsabetOzeti = { n: 0, top1: 0, top3: 0, top6: 0, listedeYok: 0 };
  for (const s of satirlar) {
    if (!s.winnerNos.length) continue;
    o.n++;
    const r = kazananSirasi(s.winnerNos, s.picks);
    if (r == null) { o.listedeYok++; continue; }
    if (r <= 1) o.top1++;
    if (r <= 3) o.top3++;
    if (r <= 6) o.top6++;
  }
  return o;
}
