import { after } from "next/server";
import { getProgramData } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { tryAcquireIngestLock } from "@/lib/ingest-lock";
import DateNavigator from "@/components/kosular/DateNavigator";
import AltiliView from "@/components/altili/AltiliView";
import { fetchGunlukTevziTutarlariByHipodrom, fetchTodaysAltiliResults } from "@/server/services/ingest/tjk-altili.adapter";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AltiliPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );

  if (daysAhead >= 0 && daysAhead <= 7) {
    const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
    const existing = await getProgramData(currentDate);
    const totalRunners = existing.reduce(
      (s, d) => s + d.races.reduce((s2, r) => s2 + r.runners.length, 0),
      0
    );
    const hasAge = existing.some((d) =>
      d.races.some((r) => r.runners.some((ru) => ru.age))
    );

    if (totalRunners === 0 || !hasAge) {
      if (await tryAcquireIngestLock(`ingest:${tjkDate}`, 1)) {
        try { await ingestDate(tjkDate); } catch { /* ignore */ }
      }
    } else {
      after(async () => {
        // program/page.tsx ile AYNI kilit anahtarı — ikisi de aynı TJK verisini çekiyor,
        // biri az önce yenilediyse diğeri gereksiz yere tekrar gitmesin. Kilit süresi
        // minimumda (1dk) — bahis kararlarını etkileyen veri gecikmesi riskine girilmiyor.
        if (await tryAcquireIngestLock(`ingest:${tjkDate}`, 1)) {
          try { await ingestDate(tjkDate); } catch { /* ignore */ }
        }
      });
    }
  }

  const days = await getProgramData(currentDate);
  // 2026-09-12 kullanıcı talebi — TJK'nın gerçek "Dağıtılacak Tutar"ı yalnız BUGÜN için
  // anlamlı (geçmiş/gelecek bir tarihte TJK'nın canlı sayfası o güne ait veri döndürmez).
  // HER hipodromun KENDİ tutarı var (ulusal DEĞİL, bkz. adapter'daki 2026-09-12 düzeltme
  // notu) — Map, Client Component'e (AltiliView) JSON-serileştirilemediği için düz nesneye
  // çevriliyor, anahtar TJK'nın sehirAdi'si (hippodromeName ile aynı Türkçe isim).
  const tevziByHipo = currentDate === today ? await fetchGunlukTevziTutarlariByHipodrom().catch(() => new Map()) : new Map();
  const tevzi = Object.fromEntries(tevziByHipo);
  // 2026-09-12 kullanıcı bulgusu: "Dağıtılacak Tutar" (havuz TOPLAMI) ile gerçek
  // "X ₺ vermiştir" (kombinasyon başı GERÇEK ikramiye) TAMAMEN FARKLI sayılar — Altılı
  // sonuçlanınca artık pool-büyüklüğü değil GERÇEK ikramiyeyi göstermeliyiz. fetchTodaysAltiliResults
  // (zaten var olan, HomeKupon.ikramiye'yi de besleyen scraper) bunu grup başına taşıyor.
  const altiliSonuclariListesi = currentDate === today ? await fetchTodaysAltiliResults().catch(() => []) : [];
  const altiliSonuclari = Object.fromEntries(altiliSonuclariListesi.map((r) => [r.sehirAdi, r]));

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Altılı Ne Verir?</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Her ayak için bir at seçin — Altılı, Beşli, Dörtlü, Üçlü ve 7&apos;li Ganyan tahminleri aynı anda hesaplanır
          </p>
        </div>
        <DateNavigator currentDate={currentDate} basePath="/altili" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <AltiliView days={days} tevzi={tevzi} altiliSonuclari={altiliSonuclari} />
      </div>
    </div>
  );
}
