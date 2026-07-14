import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { syncJockeyStatsFromTjk } from "@/server/services/race.service";
import type { Role } from "@prisma/client";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  void req;
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const count = await syncJockeyStatsFromTjk(undefined, { includeMissing: true });
  return NextResponse.json({ ok: true, count, ts: new Date().toISOString() });
}
