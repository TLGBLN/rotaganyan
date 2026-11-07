import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import {
  historyCacheTazeliginiKontrolEtVeOnar,
  agfSenkronuKontrolEtVeOnar,
  programIngestKontrolEtVeOnar,
  sonucSenkronuKontrolEtVeOnar,
  siteErisilebilirligeiKontrolEt,
  accuraceKapsamKontrolEtVeOnar,
} from "@/server/services/site-saglik-denetimi.service";

// 2026-11-07 kullanıcı talebi: "siteyi kontrol etsin, aksayan yerlerde müdahale etsin" —
// günde 12 kez (2 saatte bir) çalışır. Her kontrol birbirinden BAĞIMSIZ (Promise.allSettled)
// — biri hata verse/çökse diğerleri etkilenmez, agf-sync'teki asalak desenle aynı disiplin.
export const maxDuration = 800;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const [historyCache, agf, programIngest, sonuc, site, accurace] = await Promise.allSettled([
    historyCacheTazeliginiKontrolEtVeOnar(),
    agfSenkronuKontrolEtVeOnar(),
    programIngestKontrolEtVeOnar(),
    sonucSenkronuKontrolEtVeOnar(),
    siteErisilebilirligeiKontrolEt(),
    accuraceKapsamKontrolEtVeOnar(),
  ]);

  const al = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : { kontrolEdildi: false, sorunVarMiydi: true, hata: String(r.reason) });

  return NextResponse.json({
    historyCache: al(historyCache),
    agf: al(agf),
    programIngest: al(programIngest),
    sonucSenkronu: al(sonuc),
    site: al(site),
    accurace: al(accurace),
  });
}
