import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncResultsForDate } from "@/server/services/result-sync";
import type { Role } from "@prisma/client";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { dateFrom, dateTo } = await req.json() as { dateFrom?: string; dateTo?: string };

  const yearStart = new Date(`${dateFrom ?? `${new Date().getFullYear()}-01-01`}T00:00:00.000Z`);
  const yearEnd   = new Date(`${dateTo   ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  // Sonucu eksik yarış olan tüm günleri bul
  const raceDays = await db.raceDay.findMany({
    where: {
      date: { gte: yearStart, lte: yearEnd },
      races: { some: { result: null } },
    },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  const dates = raceDays.map((d) => d.date.toISOString().slice(0, 10));

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const dateStr of dates) {
    try {
      await syncResultsForDate(dateStr);
      synced++;
    } catch (e) {
      failed++;
      errors.push(`${dateStr}: ${e instanceof Error ? e.message : String(e)}`);
    }
    // TJK'ya nazik ol
    await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({ ok: true, total: dates.length, synced, failed, errors });
}

// Kaç gün eksik var sadece say (çalıştırmadan önce önizleme)
export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00.000Z`);

  const raceDays = await db.raceDay.findMany({
    where: {
      date: { gte: yearStart, lte: new Date() },
      races: { some: { result: null } },
    },
    orderBy: { date: "asc" },
    select: { date: true, _count: { select: { races: true } } },
  });

  const totalRaces = await db.race.count({
    where: { raceDay: { date: { gte: yearStart } }, result: null },
  });

  return NextResponse.json({
    daysWithMissingResults: raceDays.length,
    totalRacesWithoutResult: totalRaces,
    days: raceDays.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      races: d._count.races,
    })),
  });
}
