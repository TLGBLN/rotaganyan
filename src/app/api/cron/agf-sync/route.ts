import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate } from "@/server/services/agf-sync";
import { verifyCronRequest } from "@/lib/cron-auth";

// v6.69 — kullanıcı bulgusu 2026-08-09: çoklu şehir günlerinde (İstanbul+İzmir+Karma
// aynı anda) sıralı işleme 60sn'yi aşıp cron'u sessizce (Vercel 504) başarısız kılıyordu —
// İstanbul'un AGF verisi 4+ saat güncellenmeden kalmıştı. Diğer ağır sync cron'larıyla
// (ingest-program, sync-galop vb.) aynı üst sınıra çekildi; ayrıca agf-sync.ts'teki
// per-runner DB yazımı artık paralel.
export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await syncAgfForDate(new Date());
    const total = result.cities.reduce((s, c) => s + c.runnersUpdated, 0);
    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
