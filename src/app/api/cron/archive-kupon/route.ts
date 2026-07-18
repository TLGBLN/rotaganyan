import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";

// Gün sonunda (Türkiye saatiyle) o güne ait tüm HomeKupon kayıtlarını arşivler
// (isActive: false) — anasayfada yalnızca "bugünün" aktif kuponları gösterildiği
// için bu adım olmadan da pratikte kaybolurlar, ama isActive bayrağını temiz
// tutmak ve admin panelindeki "Geçmiş Kuponlar" listesinde net bir "arşivlendi"
// anı olması için elle de kapatılıyor. Kayıtlar silinmiyor, sadece pasife alınıyor.
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = turkeyDateString();
  const date = new Date(today + "T00:00:00.000Z");

  const { count } = await db.homeKupon.updateMany({
    where: { isActive: true, date },
    data: { isActive: false },
  });

  return NextResponse.json({ date: today, archived: count });
}
