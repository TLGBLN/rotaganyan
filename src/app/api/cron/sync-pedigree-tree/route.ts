import { type NextRequest, NextResponse } from "next/server";
import { syncMissingPedigreeTrees } from "@/server/services/ingest/tjk-pedigri.adapter";

export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMissingPedigreeTrees(120);
  return NextResponse.json(result);
}
