import { NextRequest, NextResponse } from "next/server";
import { syncOwnPedigreeStats } from "@/server/services/pedigri-own-stat.service";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const sonuc = await syncOwnPedigreeStats();
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
