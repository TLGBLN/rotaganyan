import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import type { Role } from "@prisma/client";

// Claude'a hiç gitmiyor (ücretsiz) — TJK/Accurace/H2H gibi ağ çağrılarını tek başına
// yapıp döner. Bu, /oto-analiz-faz2'nin KENDİ isteğinden veri toplama süresini çıkarır —
// Faz2'nin 300sn'lik penceresinin tamamı artık yalnız Claude çağrısına kalır (bkz.
// AIAnalysisPanel.tsx'teki 3 adımlı akış).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as { raceId: string };
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  return NextResponse.json({ ok: true, faz1 });
}
