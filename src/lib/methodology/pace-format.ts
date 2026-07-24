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
  KACAK: "Kaçak",
  ONCU: "Öncü (erken düştü)",
  PRESCI: "Presçi",
  TAKIPCI: "Takipçi",
  BEKLEYEN: "Bekleyen/Sprintçi",
};

export const STIL_RENK: Record<TekYarisStil, string> = {
  KACAK: "bg-hit-bg text-hit",
  ONCU: "bg-risk-bg text-risk",
  PRESCI: "bg-brand/15 text-brand",
  TAKIPCI: "bg-muted text-muted-foreground",
  BEKLEYEN: "bg-hit-bg text-hit",
};
