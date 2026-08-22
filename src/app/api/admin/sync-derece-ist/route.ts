import { type NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const yil = body.yil ? parseInt(body.yil, 10) : new Date().getUTCFullYear();

  try {
    const sonuc = await syncDereceIstatistikleri(yil);
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
