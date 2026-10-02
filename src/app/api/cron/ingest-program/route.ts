import { type NextRequest, NextResponse } from "next/server";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncIdmanForDate } from "@/server/services/ingest/tjk-idman-stats.adapter";
import { TjkAdapter } from "@/server/services/ingest/tjk.adapter";
import { persistYurtDisiRaceDays } from "@/server/services/ingest/yurtdisi-persist";
import { syncYurtDisiAtRaceHistory, syncYurtDisiRecentForm } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";
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
      if (raceDays.length > 0) await persistYurtDisiRaceDays(raceDays);
      return raceDays.map((rd) => `${rd.hippodromeName}: ${rd.races.reduce((s, r) => s + r.runners.length, 0)} koşucu`);
    } catch (e) {
      return [`HATA: ${String(e)}`];
    }
  }
  const [todayYurtDisi, tomorrowYurtDisi] = await Promise.all([
    ingestYurtDisiGunu(now),
    ingestYurtDisiGunu(tomorrow),
  ]);

  // 1c. Kullanıcı bulgusu (2026-10-01, "her yarış programında bunları düzeltmek zorunda
  // mıyız") — geçmiş yarış + Son Yarışlar pist rengi senkronu ÖNCEDEN yalnız günde 1 kez
  // (sync-horse-stats-cache, 03:00) çalışıyordu; ingest-program günde 6 kez yeni runner
  // ekliyor, bu yüzden gün içinde eklenen atlar ERTESİ güne kadar rengi/geçmişi eksik
  // kalıyordu. Artık BURADA, her ingest'ten HEMEN SONRA da çalışıyor (sync-horse-stats-
  // cache'teki çağrı KALDIRILMADI — "compute once, zaten doluysa atla" deseni sayesinde
  // iki yerde çalışması zararsız, yalnız ek bir güvenlik katmanı).
  const yurtDisiGecmisVeForm = await (async () => {
    try {
      const gecmis = await syncYurtDisiAtRaceHistory(80);
      const form = await syncYurtDisiRecentForm(100);
      return { gecmis, form };
    } catch (e) {
      return { error: String(e) };
    }
  })();

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
    yurtDisiGecmisVeForm,
  });
}
