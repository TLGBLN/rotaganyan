import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { tjkPedigriSyncCalistir } from "@/server/services/tjk-pedigri-sync.service";

// TJK pedigri istatistiklerinin günlük yenilemesi (parçalı kuyruk, bkz. tjk-pedigri-sync.service.ts). Sabah ~20 dk arayla çağrılır;
// iş bitince / zaten bittiyse hızlıca döner. Bittiğinde günlük görüntü (TjkPedigriSnapshot) alınır.
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;
  try {
    const sonuc = await tjkPedigriSyncCalistir({ butceMs: 740_000 });
    return NextResponse.json({ ok: true, ...sonuc, ts: new Date().toISOString() });
  } catch (e) {
    console.error("[sync-tjk-pedigri]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
