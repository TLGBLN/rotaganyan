// Kupon genişlik sözleşmesi: bir ayakta narrow ⊆ normal ⊆ wide olmalı (Ekonomik en dar, Geniş en geniş).
// Bu modül yalnız denetler; kayıt veya geçmiş veri değiştirmez.

export type KuponAyagi = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

export type KuponIhlali = {
  raceNo: number;
  tip: "NARROW_NOT_IN_NORMAL" | "NORMAL_NOT_IN_WIDE";
  narrow: number[];
  normal: number[];
  wide: number[];
};

function altKume(a: number[], b: number[]): boolean {
  return a.every((x) => b.includes(x));
}

export function kuponGenislikIhlalleri(ayaklar: KuponAyagi[]): KuponIhlali[] {
  const ihlaller: KuponIhlali[] = [];
  for (const a of ayaklar) {
    const kayit = { raceNo: a.raceNo, narrow: a.narrow, normal: a.normal, wide: a.wide };
    if (!altKume(a.narrow, a.normal)) ihlaller.push({ ...kayit, tip: "NARROW_NOT_IN_NORMAL" });
    if (!altKume(a.normal, a.wide)) ihlaller.push({ ...kayit, tip: "NORMAL_NOT_IN_WIDE" });
  }
  return ihlaller;
}
