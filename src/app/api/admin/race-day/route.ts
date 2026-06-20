import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceDayId } = await req.json();
  if (!raceDayId) return NextResponse.json({ error: "raceDayId gerekli" }, { status: 400 });

  // RaceDay kaydını silmiyoruz: boş bırakıyoruz ki public sayfa, gün boş diye
  // TJK'dan canlı veri çekip aynı koşuları otomatik geri yazmasın.
  await db.race.deleteMany({ where: { raceDayId } });
  return NextResponse.json({ ok: true });
}
