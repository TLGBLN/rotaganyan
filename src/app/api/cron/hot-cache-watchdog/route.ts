import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runHotWatchdogIfDue } from "@/server/services/ingest/tjk-at-profil.adapter";

// 2026-09-23 — HOT Cache Watchdog (Sistem Anatomisi P0 bulgusu): yalnız önümüzdeki 48
// saatte koşacak atları, need-aware olarak (bkz. runHotWatchdogIfDue), WARM/COLD'a hiç
// dokunmadan kontrol eder. "Vercel Cron Kayıt Bugu" riski nedeniyle (bkz. proje hafızası)
// bu rota Vercel'e hiç kayıtlı olmayabilir — agf-sync/result-sync/ingest-program'a da
// AYNI need-aware fonksiyon asalak eklendi, hangisi gerçek ihtiyacı önce yakalarsa o çalışır.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await runHotWatchdogIfDue({ source: "direct-cron" });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
