import { NextRequest, NextResponse } from "next/server";
import { syncTrainerStatsFromTjk } from "@/server/services/race.service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const count = await syncTrainerStatsFromTjk(undefined, { includeMissing: true });
  return NextResponse.json({ ok: true, count, ts: new Date().toISOString() });
}