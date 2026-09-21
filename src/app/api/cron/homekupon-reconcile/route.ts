// Prediction-to-HomeKupon Auto Synchronization (2026-09-21, bkz. plan) — `race-context-watch`
// cron'uyla AYNI iskelet/pencere. `upsertPrediction`'ın anlık `after()` tetiği TEK BAŞINA
// fail-safe sayılmaz (geçici hata/hiçbir sonraki değişiklik olmazsa kupon süresiz bayat
// kalabilir) — bu cron kaçırılan HERHANGİ bir senkronu en geç 5 dakikada onarır.
import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { reconcileAllActiveHomeKupons } from "@/server/services/home-kupon-sync.service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await reconcileAllActiveHomeKupons();
  return NextResponse.json(result);
}
