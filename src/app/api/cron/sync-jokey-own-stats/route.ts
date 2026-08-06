import { NextRequest, NextResponse } from "next/server";
import { syncJokeyOwnStats } from "@/server/services/jokey-own-stat.service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sonuc = await syncJokeyOwnStats();
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
