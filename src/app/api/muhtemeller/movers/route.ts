import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchAllDayMuhtemeller } from "@/server/services/ingest/vhs-muhtemeller.adapter";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tarih = req.nextUrl.searchParams.get("tarih");
  if (!tarih) return NextResponse.json({ error: "tarih gerekli" }, { status: 400 });

  const date = new Date(tarih + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true, slug: true } },
      races: {
        select: {
          raceNo: true,
          runners: { select: { no: true, name: true }, orderBy: { no: "asc" } },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });

  if (raceDays.length === 0) return NextResponse.json({ data: [] });

  const hippodromes = raceDays.map((rd) => ({
    name: rd.hippodrome.name,
    slug: rd.hippodrome.slug,
    races: rd.races,
  }));

  const data = await fetchAllDayMuhtemeller(tarih, hippodromes);
  return NextResponse.json({ data });
}
