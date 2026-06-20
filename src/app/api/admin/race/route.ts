import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = await req.json();
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  await db.race.delete({ where: { id: raceId } });
  return NextResponse.json({ ok: true });
}
