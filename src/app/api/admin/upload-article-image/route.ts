import { type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Role } from "@prisma/client";

// 2026-09-18 kullanıcı talebi ("makaleye görsel ekleyeceğim ama nereye yüklemem gerek") —
// upload-banner/route.ts ile AYNI desen (supabaseAdmin, ADMIN kontrolü, aynı doğrulamalar).
// Ayrı bir "articles" bucket'ı oluşturmayı denedim ama anon key RLS politikası bucket
// OLUŞTURMAYA izin vermiyor (yalnız var olan bucket içindeki nesnelere erişime izin
// veriyor) — bu yüzden mevcut, zaten çalışan "banners" bucket'ı "articles/" alt
// klasörüyle yeniden kullanılıyor (gerçek yükleme+public URL+silme test edildi).
export const maxDuration = 30;

const BUCKET = "banners";
const PREFIX = "articles";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

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
  const storagePath = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: urlData.publicUrl });
}
