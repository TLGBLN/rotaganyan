import { type NextRequest, NextResponse } from "next/server";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";
import { turkeyDateString } from "@/lib/tz";

// Kullanıcı talimatı: her günün sonunda (UTC 21:00 — vercel.json'da "0 21 * * *")
// o günün BİTMİŞ koşularının Accurace verisi kesin olarak çekilsin. result-sync
// cron'u zaten Accurace'i günde 11+ kez tetikliyor (bkz. result-sync/route.ts) ama
// bu, o güvenceyi tek bir amaca adanmış, açıkça denetlenebilir bir cron'la
// PEKİŞTİRİYOR — syncAccuraceForDate zaten yalnız accuraceRace:null koşuları
// işlediği için iki kez çalışması güvenli/idempotent, çift veri oluşturmaz.
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = turkeyDateString();
  const dun = turkeyDateString(-1);

  const [bugun, dunku] = await Promise.all([
    syncAccuraceForDate(today).catch((e: unknown) => ({ kosular: 0, kaydedilen: 0, atlanan: 0, errors: [String(e)] })),
    syncAccuraceForDate(dun).catch((e: unknown) => ({ kosular: 0, kaydedilen: 0, atlanan: 0, errors: [String(e)] })),
  ]);

  return NextResponse.json({
    bugun: { date: today, ...bugun },
    dun: { date: dun, ...dunku },
  });
}
