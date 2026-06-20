import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { importAnalyses, type AnalysisItem } from "@/lib/analysis-importer";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let items: AnalysisItem[];
  try {
    const body = await req.json();
    items = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  if (!items.length) {
    return NextResponse.json({ error: "Boş liste" }, { status: 400 });
  }

  // Use the session user as the author
  const adminUser = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!adminUser) {
    return NextResponse.json({ error: "Admin kullanıcı bulunamadı" }, { status: 500 });
  }

  const results = await importAnalyses(items, adminUser.id);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;

  return NextResponse.json({ ok, fail, results });
}
