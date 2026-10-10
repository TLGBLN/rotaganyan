import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { calistirRescueShadow } from "@/server/services/rescue-shadow.service";

// RESCUE SHADOW — SALT GÖZLEM. Production'a (V5.46.1 scorer, kupon, kullanıcı ekranları)
// hiç uygulanmaz; yalnız izole RescueShadowObservation tablosuna (raw SQL) kaydeder.
// 2026-10-10'dan (VALIDATION_START_DATE) itibaren prospektif doğrulama penceresi boyunca
// kural DONDURULMUŞ (rescue-shadow.ts) — eşiklerle bir daha oynanmayacak.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await calistirRescueShadow(5);
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
