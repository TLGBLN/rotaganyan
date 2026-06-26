import { NextResponse } from "next/server";

/** Vercel her deploy'da otomatik dolduruyor — yeni deploy çıktığında değişen tek güvenilir kimlik. */
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
