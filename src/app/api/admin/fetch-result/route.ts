import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { discoverTurkishCities, toTjkDate, toSlug } from "@/server/services/ingest/tjk-info.adapter";
import { fetchCityResults } from "@/server/services/ingest/tjk-result.adapter";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = await req.json();
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const race = await db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: { select: { no: true, name: true } },
      prediction: {
        include: { picks: { orderBy: { rank: "asc" }, include: { runner: { select: { no: true } } } } },
      },
    },
  });
  if (!race) return NextResponse.json({ error: "Koşu bulunamadı" }, { status: 404 });

  const tjkDate = toTjkDate(race.raceDay.date);

  const cities = await discoverTurkishCities(tjkDate);
  const city = cities.find((c) => toSlug(c.sehirAdi) === race.raceDay.hippodrome.slug);
  if (!city) {
    return NextResponse.json(
      { error: `TJK'da ${race.raceDay.hippodrome.name} için ${tjkDate} tarihinde program bulunamadı.` },
      { status: 404 }
    );
  }

  const cityResults = await fetchCityResults(city, tjkDate);
  const raceResult = cityResults?.find((r) => r.raceNo === race.raceNo);
  if (!raceResult) {
    return NextResponse.json(
      { error: "TJK sonuç sayfasında bu koşu için veri yok (henüz sonuçlanmamış olabilir)." },
      { status: 404 }
    );
  }

  const actualOrder = raceResult.rows.map((r) => r.no);
  const matchCount = actualOrder.filter((no) => race.runners.some((r) => r.no === no)).length;
  if (matchCount === 0) {
    return NextResponse.json(
      { error: "Çekilen sonuçtaki at numaraları bu koşudaki atlarla eşleşmiyor, hipodrom karışmış olabilir." },
      { status: 422 }
    );
  }

  const winnerNo = actualOrder[0];
  const topPick = race.prediction?.picks.find((p) => p.rank === 1);
  const hitTop1 = topPick?.runner?.no === winnerNo;

  return NextResponse.json({
    ok: true,
    winnerNo,
    actualOrder,
    hitTop1,
    rows: raceResult.rows,
  });
}
