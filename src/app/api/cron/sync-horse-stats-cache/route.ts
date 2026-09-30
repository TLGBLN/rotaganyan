import { type NextRequest, NextResponse } from "next/server";
import { syncHorseStatsCache } from "@/server/services/ingest/tjk-at-profil.adapter";
import { runVeriDenetimi } from "@/server/services/veri-denetimi.service";
import { syncYurtDisiAtRaceHistory, syncYurtDisiRecentForm } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";
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
  // 2026-09-29 — syncYurtDisiAtRaceHistory de AYNI şekilde asalak eklendi: yurt dışı atların
  // TJK geçmiş yarış verisi TR akışından TAMAMEN BAĞIMSIZ (bkz. tjk-at-yurtdisi.adapter.ts),
  // ayrı bir cron açmaya değecek kadar sık/acil değil (veri günde birkaç kez değişmiyor).
  // syncYurtDisiRecentForm SIRALI (Promise.allSettled dizisinden AYRI) çalıştırılıyor —
  // az önce syncYurtDisiAtRaceHistory'nin doldurduğu geçmişi okur, paralel çalışırsa o
  // turda henüz yazılmamış satırları kaçırabilir.
  const [statsResult, denetimResult, yurtDisiResult] = await Promise.allSettled([
    syncHorseStatsCache(250, 3),
    runVeriDenetimi(),
    syncYurtDisiAtRaceHistory(40),
  ]);
  const recentFormResult = await syncYurtDisiRecentForm(60).catch((e) => ({ error: String(e) }));

  if (statsResult.status === "rejected") throw statsResult.reason;
  return NextResponse.json({
    ...statsResult.value,
    veriDenetimi: denetimResult.status === "fulfilled" ? denetimResult.value : { error: String(denetimResult.reason) },
    yurtDisiGecmisYaris: yurtDisiResult.status === "fulfilled" ? yurtDisiResult.value : { error: String(yurtDisiResult.reason) },
    yurtDisiRecentForm: recentFormResult,
  });
}
