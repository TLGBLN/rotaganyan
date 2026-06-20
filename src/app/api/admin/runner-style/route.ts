import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const VALID_STYLES = ["KACAK", "ON_GRUP", "BEKLEME", "EN_GERI"];

export async function POST(req: NextRequest) {
  try {
    await requireRole("EDITOR");
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { runnerId, style } = await req.json();

  if (!runnerId || !VALID_STYLES.includes(style)) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  await db.runner.update({
    where: { id: runnerId },
    data: { raceStyle: { style } },
  });

  return NextResponse.json({ ok: true });
}
