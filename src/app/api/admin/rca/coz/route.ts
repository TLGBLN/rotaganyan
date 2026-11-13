// RCA "Çöz" aksiyonu — yalnız ADMIN. Güvenli, idempotent senkron işlerini tetikler (cron'ların yaptığı aynı işler).
// Kısa iş (AGF ≈15 sn) yanıtı bekletir; uzun işler (derece ≈9 dk, at profili) `after()` ile arka planda sürer ve hemen 202 döner.
import { after, type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { COZUM_BILGI, type CozumKodu } from "@/lib/rca/rca-cekirdek";
import { syncAgfForDate } from "@/server/services/agf-sync";
import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { rcaOnbellekSil } from "@/server/services/rca-v2.service";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { kod?: string };
  const kod = body.kod as CozumKodu | undefined;
  if (!kod || !(kod in COZUM_BILGI)) return NextResponse.json({ error: "Geçersiz çözüm kodu" }, { status: 400 });

  try {
    if (kod === "AGF_SYNC") {
      const bugun = new Date(); bugun.setUTCHours(0, 0, 0, 0);
      const sonuc = await syncAgfForDate(bugun);
      rcaOnbellekSil();
      return NextResponse.json({ ok: true, kod, arkaPlan: false, mesaj: "AGF senkronu tamamlandı.", sonuc });
    }
    if (kod === "DERECE_SYNC") {
      after(async () => { try { await syncDereceIstatistikleri(new Date().getUTCFullYear()); } catch (e) { console.error("[rca-coz] derece", e); } finally { rcaOnbellekSil(); } });
      return NextResponse.json({ ok: true, kod, arkaPlan: true, mesaj: "Derece yenilemesi arka planda başladı (≈9 dk). Bitince sayfayı yenile; ölçüt sağlanırsa sorun kendiliğinden 'çözüldü' olur." }, { status: 202 });
    }
    after(async () => { try { await syncHorseStatsCache(400, 3); } catch (e) { console.error("[rca-coz] at-profil", e); } finally { rcaOnbellekSil(); } });
    return NextResponse.json({ ok: true, kod, arkaPlan: true, mesaj: "At profil tamamlama arka planda başladı. Birkaç dakika sonra sayfayı yenile." }, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
