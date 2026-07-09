import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json();
  const { jockey, hippoSlug, year, breed, surface, rides, wins, place2, place3, place4, place5, performanceScore, prizeTl } = body;

  if (!jockey || !hippoSlug || !surface || !breed) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }

  const tableCount = wins + place2 + place3 + place4 + place5;
  const winRate = rides > 0 ? wins / rides : 0;
  const tableRate = rides > 0 ? tableCount / rides : 0;

  await db.jockeyStatSync.upsert({
    where: {
      jockey_hippoSlug_year_breed_surface: { jockey, hippoSlug, year, breed, surface },
    },
    update: { rides, wins, place2, place3, place4, place5, tableCount, winRate, tableRate, prizeTl: prizeTl ?? 0, performanceScore: performanceScore ?? null },
    create: { jockey, hippoSlug, year, breed, surface, rides, wins, place2, place3, place4, place5, tableCount, winRate, tableRate, prizeTl: prizeTl ?? 0, performanceScore: performanceScore ?? null },
  });

  return NextResponse.json({ ok: true, jockey, winRate, tableRate });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json();
  const { jockey, hippoSlug, year, breed, surface } = body;

  await db.jockeyStatSync.deleteMany({
    where: { jockey, hippoSlug, year, breed, surface },
  });

  return NextResponse.json({ ok: true });
}
