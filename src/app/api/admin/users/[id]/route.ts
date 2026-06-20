import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { Plan } from "@prisma/client";

const VALID_PLANS: Plan[] = ["FREE", "PREMIUM"];

// PATCH /api/admin/users/[id]  — plan değiştir
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await params;
  const { plan } = await req.json();

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Geçersiz plan" }, { status: 400 });
  }

  await db.user.update({ where: { id }, data: { plan } });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id]  — kullanıcıyı sil
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await params;

  // Prediction → Pick cascade zinciri var; Article'lar da siliniyor
  await db.prediction.deleteMany({ where: { authorId: id } });
  await db.article.deleteMany({ where: { authorId: id } });
  // Account, Session, Notification cascade ile kendi şemalarında tanımlı
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
