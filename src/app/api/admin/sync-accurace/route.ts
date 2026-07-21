import { type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { syncAccuraceForDate } from "@/server/services/accurace-sync.service";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { date } = (await req.json().catch(() => ({}))) as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Geçerli bir tarih gerekli (YYYY-MM-DD)" }, { status: 400 });
  }

  const sonuc = await syncAccuraceForDate(date);
  return NextResponse.json(sonuc);
}
