import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { calistirRcaTaramasi } from "@/server/services/rca-scan.service";

// RCA günlük otomatik tarama — SALT TEŞHİS. Scorer/weights/Prediction'a yazmaz, karar/refit
// tetiklemez; yalnız RcaScanSnapshot (izole raw-SQL tablo) günceller.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await calistirRcaTaramasi();
  return NextResponse.json({ ok: true, pencereler: sonuc, ts: new Date().toISOString() });
}
