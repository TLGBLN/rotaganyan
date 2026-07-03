import { type NextRequest, NextResponse } from "next/server";
import { createHourlyHorseNotifications } from "@/server/services/horse-notification.service";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await createHourlyHorseNotifications();
  return NextResponse.json({ ok: true, ...result });
}
