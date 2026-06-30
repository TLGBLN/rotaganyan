import { NextRequest, NextResponse } from "next/server";
import { fetchAllDayMuhtemellerFromCdn } from "@/server/services/ingest/vhs-muhtemeller.adapter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tarih = req.nextUrl.searchParams.get("tarih");
  if (!tarih) return NextResponse.json({ error: "tarih gerekli" }, { status: 400 });

  const data = await fetchAllDayMuhtemellerFromCdn(tarih);
  return NextResponse.json({ data });
}
