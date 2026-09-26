import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runSr6ShadowLog, enrichSr6ShadowOutcomes } from "@/server/services/sr6-shadow-log.service";

// SR6 Shadow Logger v1 (bkz. proje hafızası: Surprise Rescue SR6-HC) — SHADOW_ONLY, Prediction/
// finalRank/olasılık/kupon/HomeKupon'a hiç dokunmaz. challenger-shadow-log/route.ts ile AYNI
// iskelet, bilerek AYRI bir rota (bkz. sr6-shadow-log.service.ts başlığındaki izolasyon gerekçesi).
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const candidates = await runSr6ShadowLog();
    const outcomes = await enrichSr6ShadowOutcomes();
    return NextResponse.json({ ok: true, candidates, outcomes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
