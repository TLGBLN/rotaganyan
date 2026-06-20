import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role, PedigreeRating, Surface, Breed } from "@prisma/client";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, tier, surface, breed, note } = await req.json();
  if (!name || !tier) {
    return NextResponse.json({ error: "name ve tier gerekli" }, { status: 400 });
  }

  const sireTier = await db.sireTier.upsert({
    where: { name: name.trim() },
    create: {
      name: name.trim(),
      tier: tier as PedigreeRating,
      surface: (surface || null) as Surface | null,
      breed: (breed || null) as Breed | null,
      note: note || null,
    },
    update: {
      tier: tier as PedigreeRating,
      surface: (surface || null) as Surface | null,
      breed: (breed || null) as Breed | null,
      note: note || null,
    },
  });

  return NextResponse.json({ ok: true, sireTier });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  await db.sireTier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
