import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";
import { fetchTodaysAltiliResults } from "@/server/services/ingest/tjk-altili.adapter";
import { findIkramiyeForHippodrome } from "@/lib/altili-match";
import { verifyCronRequest } from "@/lib/cron-auth";

// Gün sonunda (Türkiye saatiyle) o güne ait tüm HomeKupon kayıtlarını arşivler
// (isActive: false) — anasayfada yalnızca "bugünün" aktif kuponları gösterildiği
// için bu adım olmadan da pratikte kaybolurlar, ama isActive bayrağını temiz
// tutmak ve admin panelindeki "Geçmiş Kuponlar" listesinde net bir "arşivlendi"
// anı olması için elle de kapatılıyor. Kayıtlar silinmiyor, sadece pasife alınıyor.
//
// 2026-07-26, kullanıcı talebiyle eklendi: arşivlemeden HEMEN ÖNCE TJK'nın resmi
// ikramiye cümlesini de yakalayıp kaydediyoruz — TJK'nın AltiliSonuc sayfası yalnız
// "bugünü" gösteriyor (geçmişe dönük sorgu yok), bu yüzden bu an kaçırılırsa o günün
// gerçek ikramiye tutarı BİR DAHA hiç elde edilemez.
export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const today = turkeyDateString();
  const date = new Date(today + "T00:00:00.000Z");

  const activeKuponlar = await db.homeKupon.findMany({ where: { isActive: true, date } });
  const altiliResults = await fetchTodaysAltiliResults().catch(() => []);

  let archived = 0;
  for (const k of activeKuponlar) {
    const ikramiye = findIkramiyeForHippodrome(k.hippodromeName, altiliResults);
    await db.homeKupon.update({ where: { id: k.id }, data: { isActive: false, ikramiye } });
    archived++;
  }

  return NextResponse.json({ date: today, archived });
}
