import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { calistirTempCalShadow } from "@/server/services/kupon-temp-cal-shadow.service";

// TEMP_CAL SHADOW-PASS — SALT GÖZLEM. BASE production kuponuna/kullanıcıya hiç uygulanmaz;
// yalnız izole TempCalShadowObservation tablosuna (raw SQL) kaydeder. Kasım 2026 ileri-
// doğrulama penceresi boyunca T/eşikler DONDURULMUŞ (kupon-temp-cal-shadow.ts).
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await calistirTempCalShadow(5);
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
