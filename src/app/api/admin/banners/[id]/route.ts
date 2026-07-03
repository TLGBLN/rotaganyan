import { type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Role } from "@prisma/client";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) return null;
  return session;
}

// DELETE /api/admin/banners/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;

  const slide = await db.bannerSlide.findUnique({ where: { id } });
  if (!slide) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  await supabaseAdmin.storage.from("banners").remove([slide.storagePath]);
  await db.bannerSlide.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/banners/[id]  — body: { order?: number; active?: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const slide = await db.bannerSlide.update({
    where: { id },
    data: {
      ...(body.order !== undefined && { order: body.order }),
      ...(body.active !== undefined && { active: body.active }),
    },
  });

  return NextResponse.json({ slide });
}
