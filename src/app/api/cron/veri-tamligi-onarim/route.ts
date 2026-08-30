import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { dereceIstatistikleriniKontrolEtVeOnar } from "@/server/services/veri-tamligi-onarim.service";

// 2026-08-30 — kullanıcı talebi: veri-tamligi alanlarından kanıtlanmış-kırılgan olanı
// (Derece İstatistikleri) otomatik tespit edip onaran cron. Ayrıca güvenlik ağı olarak
// agf-sync/route.ts'e de asalak eklendi (yeni cron path'lerinin Vercel'e kayıt sorunu
// emsali, 2026-08-25 — sync-derece-ist'in kendisi de bu yüzden hiç kaydolmamıştı).
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const sonuc = await dereceIstatistikleriniKontrolEtVeOnar();
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
