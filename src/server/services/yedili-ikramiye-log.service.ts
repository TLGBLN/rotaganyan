/**
 * 2026-10-17 kullanıcı talebi — "Ankara 7'li ganyan 2.641,40 ₺ vermiş, bunu da yansıt sisteme."
 * AltiliIkramiyeLog'un (altili-ikramiye-log.service.ts) AYNI deseniyle, 7'Lİ GANYAN'ın
 * GERÇEK (sonuçlanmış) ikramiyesini TJK'dan otomatik çeker ve kaydeder. Altılı'dan farkı:
 * günde yalnız TEK pool var (slot YOK), ve bu ilk sürümde yalnız gerçek ikramiye + kazanan
 * kombinasyon tutuluyor (havuzBuyuklugu/katsayi kapsam dışı — kullanıcı talebiyle sınırlı).
 */
import { db } from "@/lib/db";
import { fetchTodaysYediliGanyanSonuclari } from "./ingest/tjk-altili.adapter";
import { turkeyDateString } from "@/lib/tz";

/** Bugün sonuçlanmış HER 7'Lİ GANYAN için bir kez kaydeder — zaten kayıtlıysa DOKUNMAZ
 *  (finalize edilmiş bir sonucu asla üzerine yazmaz). */
export async function syncYediliIkramiyeLog(): Promise<void> {
  const todayStr = turkeyDateString();
  const todayDate = new Date(todayStr + "T00:00:00.000Z");

  const sonuclar = await fetchTodaysYediliGanyanSonuclari();
  for (const s of sonuclar) {
    const existing = await db.yediliIkramiyeLog.findUnique({
      where: { hippodromeName_date: { hippodromeName: s.sehirAdi, date: todayDate } },
    });
    if (existing) continue;

    await db.yediliIkramiyeLog.create({
      data: { hippodromeName: s.sehirAdi, date: todayDate, kombinasyon: s.kombinasyon, gercekIkramiye: s.gercekIkramiye },
    });
  }
}
