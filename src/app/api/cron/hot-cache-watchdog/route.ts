import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runHotCacheWatchdogIfDue } from "@/server/services/ingest/tjk-at-profil.adapter";

// 2026-09-23 — HOT Cache Watchdog (Sistem Anatomisi P0 bulgusu): yalnız önümüzdeki 48
// saatte koşacak atları, her 2 saatte bir, WARM/COLD'a hiç dokunmadan kontrol eder.
// "Vercel Cron Kayıt Bugu" riski nedeniyle (bkz. proje hafızası) bu rota agf-sync'e de
// asalak eklendi — ikisinden hangisi önce tetiklerse `lastRunAt` kapısı diğerini
// gereksiz DB taramasından bile alıkoyar.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await runHotCacheWatchdogIfDue();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
