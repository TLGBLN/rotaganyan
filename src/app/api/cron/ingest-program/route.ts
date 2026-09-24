import { type NextRequest, NextResponse } from "next/server";
import { toTjkDate, ingestDate, recordProgramCronRun } from "@/server/services/ingest/tjk-info.adapter";
import { syncIdmanForDate } from "@/server/services/ingest/tjk-idman-stats.adapter";
import { runHotWatchdogIfDue } from "@/server/services/ingest/tjk-at-profil.adapter";
import { verifyCronRequest } from "@/lib/cron-auth";

export const maxDuration = 800; // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi

function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const startedAt = Date.now();

  // 1. Program ingest: bugün + yarın
  let todayResult: Awaited<ReturnType<typeof ingestDate>>;
  let tomorrowResult: Awaited<ReturnType<typeof ingestDate>>;
  try {
    [todayResult, tomorrowResult] = await Promise.all([
      ingestDate(toTjkDate(now)),
      ingestDate(toTjkDate(tomorrow)),
    ]);
  } catch (err) {
    await recordProgramCronRun({ ok: false, durationMs: Date.now() - startedAt, error: String(err) }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
  await recordProgramCronRun({
    ok: true,
    durationMs: Date.now() - startedAt,
    result: { today: todayResult, tomorrow: tomorrowResult },
  }).catch(() => {});

  // 2026-09-24 — HOT Cache Watchdog need-aware fallback (bkz. runHotWatchdogIfDue) —
  // ingest-program üçüncü bağımsız tetikleme kaynağı (agf-sync/result-sync ile birlikte).
  // Hata durumunda program ingest'i ASLA bloke etmez/başarısız kılmaz.
  try {
    await runHotWatchdogIfDue({ source: "program-sync" });
  } catch (e) {
    console.error("[ingest-program] hot-watchdog piggyback hatası (program ingest etkilenmedi)", e);
  }

  // 2. İdman (galop) sync: program yüklendikten sonra bugün + yarın
  const [todayGalop, tomorrowGalop] = await Promise.all([
    syncIdmanForDate(toIsoDate(now)).catch((e: unknown) => ({ hippodromes: 0, rows: 0, skipped: 0, errors: [String(e)] })),
    syncIdmanForDate(toIsoDate(tomorrow)).catch((e: unknown) => ({ hippodromes: 0, rows: 0, skipped: 0, errors: [String(e)] })),
  ]);

  const summary = (r: typeof todayResult) =>
    r.cities.map((c) => `${c.sehirAdi}: ${c.ok ? `${c.runners} koşucu` : `HATA: ${c.error}`}`);

  return NextResponse.json({
    today: {
      date: toTjkDate(now),
      cities: summary(todayResult),
      galop: { hippodromes: todayGalop.hippodromes, rows: todayGalop.rows, skipped: todayGalop.skipped },
    },
    tomorrow: {
      date: toTjkDate(tomorrow),
      cities: summary(tomorrowResult),
      galop: { hippodromes: tomorrowGalop.hippodromes, rows: tomorrowGalop.rows, skipped: tomorrowGalop.skipped },
    },
  });
}
