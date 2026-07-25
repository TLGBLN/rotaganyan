/**
 * pace-analizi.ts'in ürettiği ham veriyi (checkpoint dizisi, stil sınıflandırması) hem
 * admin Accurace panosunda (admin/accurace/page.tsx) hem herkese açık Accurace panelinde
 * (Son800Panel.tsx) AYNI biçimde göstermek için paylaşılan format yardımcıları — tek
 * yerden bakım, iki ekran arasında sessizce ayrışmasın diye.
 */
import type { TekYarisStil } from "./pace-analizi";

export function fmtSaniye(ms: number): string {
  const totalSec = ms / 1000;
  const dk = Math.floor(totalSec / 60);
  const sn = totalSec - dk * 60;
  return dk > 0 ? `${dk}'${sn.toFixed(2)}''` : `${sn.toFixed(2)}''`;
}

/** 400m'den başlayıp 200m aralıklarla + bitiş — okunabilir bir sektörel özet için. */
export function checkpointCols(length: number): number[] {
  const cols: number[] = [];
  for (let c = 400; c < length; c += 200) cols.push(c);
  cols.push(length);
  return cols;
}

export const STIL_LABEL: Record<TekYarisStil, string> = {
  KACAK_AT: "Kaçak At",
  ON_GRUP_ARKASI: "Ön Grup Arkası",
  BEKLEME_GRUBU: "Bekleme Grubu",
  EN_GERI_TAKIP: "En Geri Takip",
};

export const STIL_RENK: Record<TekYarisStil, string> = {
  KACAK_AT: "bg-hit-bg text-hit",
  ON_GRUP_ARKASI: "bg-brand/15 text-brand",
  BEKLEME_GRUBU: "bg-muted text-muted-foreground",
  EN_GERI_TAKIP: "bg-risk-bg text-risk",
};
