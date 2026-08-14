import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { gatherFaz1V4, faz2V4Sirala, muhakemeUretV4 } from "@/lib/methodology/v4-engine";
import { faz2BankoAdayiTespit, kategoriTespit } from "@/lib/methodology/v2-engine";

// 2026-08-14 — V4 motoru: Claude çağrısı YOK (yalnız DB okuma + mekanik sıralama), bu
// yüzden V2/V3'teki maxDuration/batching/createWithTruncationRetry karmaşıklığının
// hiçbiri gerekmiyor — tek istekte saniyeler içinde döner.

type Body = { raceId: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1V4(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });
  if (faz1.runners.length === 0) return NextResponse.json({ error: "Sahada koşacak at yok" }, { status: 400 });

  const sirali = faz2V4Sirala(faz1);

  const atlar = sirali.map((r) => ({
    no: r.no,
    ad: r.ad,
    teknikSira: r.teknikSira,
    karar: r.karar,
    sinyalSayisi: r.sinyal.sayi,
    etiketler: r.sinyal.etiketler,
    agfTrendVeAccuraceBirlikte: r.agfTrendVeAccuraceBirlikte,
    details: muhakemeUretV4(r),
  }));

  const bankoAdayi = faz2BankoAdayiTespit(sirali.map((r) => ({ no: r.no, ad: r.ad, teknikSira: r.teknikSira, karar: r.karar })));

  const nolar = sirali.map((r) => r.no);
  const couponNarrow = nolar.slice(0, 3).join("-");
  const couponNormal = nolar.slice(3, 6).join("-");
  const couponWide = nolar.slice(6).join("-");

  return NextResponse.json({
    ok: true,
    kategori: kategoriTespit(faz1.race.classType), // yalnız bilgi amaçlı, gate değil
    kosuBaslik: `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at`,
    atlar,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    bankoAdayi,
    couponNarrow,
    couponNormal,
    couponWide,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v4-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
