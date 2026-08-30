import { type NextRequest, NextResponse } from "next/server";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { runVeriDenetimi } from "@/server/services/veri-denetimi.service";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  // 2026-08-25 — /api/cron/veri-denetimi vercel.json'da tanımlı olmasına rağmen Vercel'in
  // proje kaydına hiç işlenmedi (dashboard + CLI'dan defalarca redeploy denendi, hepsi
  // başarısız — platform tarafı bir sorun, destek talebi açık). Zaten günlük çalışan bu
  // cron'a paralel asalak eklendi; runVeriDenetimi kendi içinde gün-bazlı tekilleştirme
  // yaptığı için saatin 07:00 yerine 03:00 UTC olması sorun yaratmaz.
  const [statsResult, denetimResult] = await Promise.allSettled([
    syncHorseStatsCache(250, 3),
    runVeriDenetimi(),
  ]);

  if (statsResult.status === "rejected") throw statsResult.reason;
  return NextResponse.json({
    ...statsResult.value,
    veriDenetimi: denetimResult.status === "fulfilled" ? denetimResult.value : { error: String(denetimResult.reason) },
  });
}
