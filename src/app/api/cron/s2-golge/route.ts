import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { s2GolgeCalistir } from "@/server/services/s2-golge.service";

// S2 gölge kıyas: sonuçlanan koşuları kayıtlı snapshot'tan canlı(24) vs S2(17) olarak puanlayıp S2GolgeKiyas'a yazar (canlıyı DEĞİŞTİRMEZ).
// Günde bir kez (akşam yarışlar bittikten sonra); son 3 günü tarar, böylece geç sonuçlanan koşular ertesi gün yakalanır.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;
  try {
    const sonuc = await s2GolgeCalistir({ gunSayisi: 3 });
    return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
  } catch (e) {
    console.error("[s2-golge]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
