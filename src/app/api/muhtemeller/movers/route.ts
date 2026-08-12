import { NextRequest, NextResponse } from "next/server";
import { fetchAllDayMuhtemellerFromCdn } from "@/server/services/ingest/vhs-muhtemeller.adapter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tarih = req.nextUrl.searchParams.get("tarih");
  // v6.109 — kullanıcı talebi 2026-08-11: tarih doğrudan (doğrulanmadan) CDN
  // fetch URL'ine ekleniyordu — sabit host'a bağlı kalsa da (tam SSRF değil),
  // temel girdi doğrulaması eksikti. YYYY-MM-DD dışındaki her şey reddedilir.
  if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
    return NextResponse.json({ error: "tarih gerekli (YYYY-MM-DD)" }, { status: 400 });
  }

  const data = await fetchAllDayMuhtemellerFromCdn(tarih);
  return NextResponse.json({ data });
}
