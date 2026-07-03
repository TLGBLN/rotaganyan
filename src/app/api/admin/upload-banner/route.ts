import { type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Role } from "@prisma/client";

export const maxDuration = 30;

const BUCKET = "banners";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Dosya seçilmedi" }, { status: 400 });
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: "Geçersiz dosya tipi (jpeg/png/webp/gif)" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Dosya 5 MB'dan büyük olamaz" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `banner.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await db.siteSetting.upsert({
    where: { key: "banner_url" },
    create: { key: "banner_url", value: publicUrl },
    update: { value: publicUrl },
  });

  return NextResponse.json({ url: publicUrl });
}
