// TJK pedigri istatistikleri — SAF yardımcılar (DB'siz): günlük görüntü kodlama/çözme, günlük yenileme birimlerinin planı, Türkiye günü.
import { gunzipSync, gzipSync } from "node:zlib";

/** [kind, tjkId, year, groupId, pistId, normalizedName, breed, runnerCount, starts, wins] — TjkPedigriStat'ın yarış analizi için gereken alanları. */
export type SnapSatir = [string, number, number, number, number, string, string, number, number, number];

export function snapshotKodla(satirlar: SnapSatir[]): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(satirlar), "utf8"), { level: 9 });
}
export function snapshotCoz(buf: Uint8Array): SnapSatir[] {
  return JSON.parse(gunzipSync(Buffer.from(buf)).toString("utf8")) as SnapSatir[];
}

export type SyncBirim = { kind: "SIRE" | "DAM" | "DAMSIRE"; year: number; groupId: number; pistId: number };
/** Günlük yenileme birimleri, ÖNCELİK sırasıyla: Kısrak (tek büyük çekim) → genel Aygır → genel Kısrak Babası → kalan Aygır (grup×pist) → kalan Kısrak Babası (grup).
 *  Aygır: grup + pist; Kısrak Babası: yalnız grup (TJK'da pist yok); Kısrak: ikisi de yok (-1,-1). */
export function syncBirimleri(yil: number, aygirGruplari: number[], aygirPistleri: number[], kisrakBabasiGruplari: number[]): SyncBirim[] {
  const out: SyncBirim[] = [{ kind: "DAM", year: yil, groupId: -1, pistId: -1 }, { kind: "SIRE", year: yil, groupId: -1, pistId: -1 }, { kind: "DAMSIRE", year: yil, groupId: -1, pistId: -1 }];
  for (const g of aygirGruplari) for (const p of aygirPistleri) if (!(g === -1 && p === -1)) out.push({ kind: "SIRE", year: yil, groupId: g, pistId: p });
  for (const g of kisrakBabasiGruplari) if (g !== -1) out.push({ kind: "DAMSIRE", year: yil, groupId: g, pistId: -1 });
  return out;
}
export const birimAnahtari = (b: SyncBirim) => `${b.kind}|${b.year}|${b.groupId}|${b.pistId}`;

/** Türkiye (UTC+3) takvim günü, YYYY-MM-DD. */
export function trGunu(d: Date): string {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}
/** Yarış başlangıç anı (UTC ms): yarış günü (UTC gece yarısı) + saat (TR) . */
export function yarisBaslangicMs(gunUtcMs: number, saat: string | null | undefined): number {
  const [hh, mm] = (saat ?? "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  return gunUtcMs + ((hh ?? 0) * 60 + (mm ?? 0)) * 60_000 - 3 * 3600_000;
}
