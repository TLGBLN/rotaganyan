import { db } from "@/lib/db";

/**
 * program/altili sayfaları her açılışta canlı TJK ingest/sonuç-senkron fonksiyonlarını
 * tetikliyordu (revalidate=0 + her ziyaretçide ingestDate/syncResultsForDate) — 100
 * ziyaretçi 100 kez TJK'ya gidiyordu, cron'un (günde birkaç kez) yaptığı işi gereksiz
 * tekrarlıyordu. SiteSetting'i basit bir zaman kilidi olarak kullanıyoruz: aynı key
 * minMinutes içinde tekrar kilitlenmeye çalışılırsa false döner (çağıran atlar), aksi
 * halde kilidi şimdiki zamana günceller ve true döner — böylece aynı anda gelen çok
 * sayıda istekten yalnız ilki TJK'ya gider.
 */
export async function tryAcquireIngestLock(key: string, minMinutes: number): Promise<boolean> {
  const now = new Date();
  const existing = await db.siteSetting.findUnique({ where: { key } }).catch(() => null);
  if (existing && now.getTime() - existing.updatedAt.getTime() < minMinutes * 60_000) {
    return false;
  }
  await db.siteSetting
    .upsert({ where: { key }, create: { key, value: now.toISOString() }, update: { value: now.toISOString() } })
    .catch(() => {});
  return true;
}
