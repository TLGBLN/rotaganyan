import { type NextRequest, NextResponse } from "next/server";
import { createHourlyHorseNotifications } from "@/server/services/horse-notification.service";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await createHourlyHorseNotifications();
  return NextResponse.json({ ok: true, ...result });
}
