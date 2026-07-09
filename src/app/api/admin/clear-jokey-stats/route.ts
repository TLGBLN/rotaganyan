import { NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export async function DELETE() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { count } = await db.jockeyStatSync.deleteMany({ where: { year: 2026 } });
  return NextResponse.json({ ok: true, deleted: count });
}
