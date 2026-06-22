import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createUserSchema } from "@/lib/validations/auth";

// POST /api/admin/users — yeni kullanıcı oluştur (admin)
export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" },
      { status: 400 }
    );
  }

  const { name, email, password, role, plan } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta adresi zaten kayıtlı." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { name, email, passwordHash, role, plan },
    select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
