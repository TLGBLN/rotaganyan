import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = turkeyDateString();
  await syncResultsForDate(today);

  revalidatePath("/");

  return NextResponse.json({ ok: true, date: today });
}
