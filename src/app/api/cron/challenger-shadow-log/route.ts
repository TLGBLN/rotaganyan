import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runChallengerShadowLog } from "@/server/services/challenger-shadow-log.service";

// 2026-08-29 — V6 Aşama 3 (bkz. plan). Ayrıca güvenlik ağı olarak agf-sync/route.ts'in
// sonuna da (asalak ekleme, bkz. sync-derece-ist/veri-denetimi emsali 2026-08-25 —
// yeni cron path'leri bazen Vercel'e hiç kaydolmuyor) eklendi. Bu ayrı rota, manuel
// tetikleme/QA için hâlâ duruyor.
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await runChallengerShadowLog();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
