import { type NextRequest, NextResponse } from "next/server";
import { syncAgfForDate } from "@/server/services/agf-sync";

// v6.69 — kullanıcı bulgusu 2026-08-09: çoklu şehir günlerinde (İstanbul+İzmir+Karma
// aynı anda) sıralı işleme 60sn'yi aşıp cron'u sessizce (Vercel 504) başarısız kılıyordu —
// İstanbul'un AGF verisi 4+ saat güncellenmeden kalmıştı. Diğer ağır sync cron'larıyla
// (ingest-program, sync-galop vb.) aynı üst sınıra çekildi; ayrıca agf-sync.ts'teki
// per-runner DB yazımı artık paralel.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Allow Vercel Cron (sets Authorization header from CRON_SECRET env) or manual calls with secret
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAgfForDate(new Date());
    const total = result.cities.reduce((s, c) => s + c.runnersUpdated, 0);
    return NextResponse.json({ ...result, totalRunnersUpdated: total });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
