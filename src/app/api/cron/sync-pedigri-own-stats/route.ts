import { NextRequest, NextResponse } from "next/server";
import { syncOwnPedigreeStats } from "@/server/services/pedigri-own-stat.service";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sonuc = await syncOwnPedigreeStats();
  return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
}
