import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchRaceMuhtemeller } from "@/server/services/ingest/vhs-muhtemeller.adapter";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ hipodrom: string; kosuNo: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { hipodrom, kosuNo } = await params;
  const raceNo = parseInt(kosuNo, 10);
  const tarih = req.nextUrl.searchParams.get("tarih");
  if (isNaN(raceNo) || !tarih) {
    return NextResponse.json({ error: "Geçersiz parametre" }, { status: 400 });
  }

  const hippodrome = await db.hippodrome.findFirst({ where: { slug: hipodrom }, select: { name: true } });
  if (!hippodrome) {
    return NextResponse.json({ error: "Hipodrom bulunamadı" }, { status: 404 });
  }

  const data = await fetchRaceMuhtemeller(tarih, hippodrome.name, raceNo);
  return NextResponse.json({ data });
}
