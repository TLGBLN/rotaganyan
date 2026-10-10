import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { calistirRcaTaramasi } from "@/server/services/rca-scan.service";
import { calistirRcaBildirimTaramasi } from "@/server/services/rca-notification.service";

// RCA günlük otomatik tarama — SALT TEŞHİS. Scorer/weights/Prediction'a yazmaz, karar/refit
// tetiklemez; yalnız RcaScanSnapshot (izole raw-SQL tablo) günceller.
// 2026-10-10 kullanıcı talebi: tarama sonrası her koşu için ROOT_SUBCAUSE (BASE replay +
// allocator karşı-olgusal + market/fundamental ayrımı) otomatik hesaplanıp admin'e TEK
// seferlik bildirim gönderilir (RcaRootSubcauseEvent, idempotent — bkz. rca-notification.service.ts).
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await calistirRcaTaramasi();
  const bildirim = await calistirRcaBildirimTaramasi(3).catch((e) => ({ hata: String(e) }));
  return NextResponse.json({ ok: true, pencereler: sonuc, bildirim, ts: new Date().toISOString() });
}
