import { type NextRequest, NextResponse } from "next/server";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncIdmanForDate } from "@/server/services/ingest/tjk-idman-stats.adapter";
import { TjkAdapter } from "@/server/services/ingest/tjk.adapter";
import { persistRaceDays } from "@/server/services/ingest/base";
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

  // 1. Program ingest: bugün + yarın
  const [todayResult, tomorrowResult] = await Promise.all([
    ingestDate(toTjkDate(now)),
    ingestDate(toTjkDate(tomorrow)),
  ]);

  // 1b. Yurt dışı (ABD/Birleşik Krallık/Kanada) program ingest — bkz. TjkAdapter.fetchRaceDays
  // üstündeki 2026-09-30 notu. ingestDate (yukarıdaki) TR-only olduğu için bu adım AYRI,
  // TR'ye HİÇ dokunmadan (onlyForeign:true) eklendi. Bir hipodrom/gün başarısız olsa bile
  // TR ingest'ini asla etkilemez (ayrı try/catch, ayrı sonuç alanı).
  const yurtDisiAdapter = new TjkAdapter();
  async function ingestYurtDisiGunu(d: Date): Promise<string[]> {
    try {
      const raceDays = await yurtDisiAdapter.fetchRaceDays(d, { onlyForeign: true });
      if (raceDays.length > 0) await persistRaceDays(raceDays);
      return raceDays.map((rd) => `${rd.hippodromeName}: ${rd.races.reduce((s, r) => s + r.runners.length, 0)} koşucu`);
    } catch (e) {
      return [`HATA: ${String(e)}`];
    }
  }
  const [todayYurtDisi, tomorrowYurtDisi] = await Promise.all([
    ingestYurtDisiGunu(now),
    ingestYurtDisiGunu(tomorrow),
  ]);

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
      yurtDisi: todayYurtDisi,
      galop: { hippodromes: todayGalop.hippodromes, rows: todayGalop.rows, skipped: todayGalop.skipped },
    },
    tomorrow: {
      date: toTjkDate(tomorrow),
      cities: summary(tomorrowResult),
      yurtDisi: tomorrowYurtDisi,
      galop: { hippodromes: tomorrowGalop.hippodromes, rows: tomorrowGalop.rows, skipped: tomorrowGalop.skipped },
    },
  });
}
