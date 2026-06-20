import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["USER", "EDITOR", "ADMIN"];

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { userId, role } = await req.json();

  if (!userId || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Geçersiz parametre" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { role } });

  return NextResponse.json({ ok: true });
}
