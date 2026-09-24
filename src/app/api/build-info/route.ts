import { NextResponse } from "next/server";
import { currentBuildId } from "@/lib/build-id";

/** Yeni deploy çıktığında değişen tek güvenilir kimlik (git SHA, yoksa deployment id — bkz. lib/build-id.ts). */
const BUILD_ID = currentBuildId();

export async function GET() {
  return NextResponse.json({ buildId: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
