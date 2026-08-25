import { NextRequest, NextResponse } from "next/server";
import { syncTrainerStatsFromTjk } from "@/server/services/race.service";
import { syncDereceIstatistikleri } from "@/server/services/ingest/tjk-derece-ist.adapter";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  // 2026-08-25 — /api/cron/sync-derece-ist vercel.json'da tanımlı olmasına rağmen Vercel'in
  // proje kaydına hiç işlenmedi (dashboard + CLI'dan defalarca redeploy denendi, hepsi
  // başarısız — platform tarafı bir sorun, destek talebi açık). Zaten günlük çalışan ve
  // aynı maxDuration'a sahip bu cron'a paralel olarak asalak eklendi; biri hata verirse
  // diğerini etkilemesin diye Promise.allSettled kullanıldı.
  const [trainerResult, dereceResult] = await Promise.allSettled([
    syncTrainerStatsFromTjk(undefined, { includeMissing: true }),
    syncDereceIstatistikleri(new Date().getUTCFullYear()),
  ]);

  const count = trainerResult.status === "fulfilled" ? trainerResult.value : null;
  const dereceIst =
    dereceResult.status === "fulfilled" ? dereceResult.value : { error: String(dereceResult.reason) };

  return NextResponse.json({ ok: true, count, dereceIst, ts: new Date().toISOString() });
}