import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { dereceIstatistikleriniKontrolEtVeOnar, atProfiliniKontrolEtVeOnar } from "@/server/services/veri-tamligi-onarim.service";

// 2026-08-30 — kullanıcı talebi: veri-tamligi alanlarından kanıtlanmış-kırılgan olanı
// (Derece İstatistikleri) otomatik tespit edip onaran cron. Ayrıca güvenlik ağı olarak
// agf-sync/route.ts'e de asalak eklendi (yeni cron path'lerinin Vercel'e kayıt sorunu
// emsali, 2026-08-25 — sync-derece-ist'in kendisi de bu yüzden hiç kaydolmamıştı).
// 2026-08-30 (aynı gün, ikinci tur): At profil önbelleği de gerçek/fixable bulununca
// aynı "izle+onar" desenine ikinci alan olarak eklendi — bkz. veri-tamligi-onarim.service.ts
// başındaki not (Galop/AGF/HP için neden EKLENMEDİĞİ de orada açıklanıyor).
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const [derece, atProfili] = await Promise.all([
      dereceIstatistikleriniKontrolEtVeOnar(),
      atProfiliniKontrolEtVeOnar(),
    ]);
    return NextResponse.json({ ok: true, derece, atProfili });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
