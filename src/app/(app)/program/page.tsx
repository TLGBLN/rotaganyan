import { after } from "next/server";
import { db } from "@/lib/db";
import { getProgramData, getKuponOnerileri, getHitPredictions, getJockeyStats, getTrainerStats, type JockeyStat, type TrainerStat } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { getAgfMovers } from "@/server/services/agf-trend.service";
import { syncResultsForDate } from "@/server/services/result-sync";
import { fetchTodaysAltiliResults } from "@/server/services/ingest/tjk-altili.adapter";
import { fetchTjkTicker } from "@/lib/tjk-ticker";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { getFollowedHorses } from "@/server/actions/horse-follow";
import ProgramView from "@/components/program/ProgramView";
import AutoRefresh from "@/components/program/AutoRefresh";
import DateNavigator from "@/components/kosular/DateNavigator";
import SteamWidget from "@/components/kosular/SteamWidget";
import AltiliGanyanResults from "@/components/home/AltiliGanyanResults";
import TahminOnerileri from "@/components/home/TahminOnerileri";
import HitsCarousel from "@/components/home/HitsCarousel";
import NewsTicker from "@/components/home/NewsTicker";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function ProgramPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );

  // Bu istekten tamamen bağımsız veriler — ingest/senkron kontrolüyle aynı anda başlar,
  // sırayla beklenmez (getProgramData'nın kendisi ayrıca ve sadece bir kez, aşağıda,
  // ingest/senkron kesinleştikten SONRA çekilir — sonuçları etkilememeleri için).
  const independentDataPromise = Promise.all([
    auth(),
    getAgfMovers(today),
    fetchTodaysAltiliResults(),
    fetchTjkTicker(),
    getFollowedHorses().catch(() => [] as { horseName: string }[]),
    getKuponOnerileri().catch(() => []),
    getHitPredictions(16).catch(() => []),
  ]);

  if (daysAhead >= 0 && daysAhead <= 7) {
    const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
    // getProgramData()'nın tamamını (tüm koşular+atlar+galoplar+picks) sadece "veri var mı,
    // yaş bilgisi dolu mu" kontrolü için çekip sonucu atmak yerine, hafif bir varlık
    // sorgusu kullanılıyor — asıl veri aşağıda, ingest/senkron bittikten sonra tek sefer
    // çekiliyor.
    const date = new Date(currentDate + "T00:00:00.000Z");
    const runnerWithAge = await db.runner.findFirst({
      where: { race: { raceDay: { date } }, age: { not: null } },
      select: { id: true },
    });

    if (!runnerWithAge) {
      try { await ingestDate(tjkDate); } catch { /* ignore */ }
    } else {
      after(async () => {
        try { await ingestDate(tjkDate); } catch { /* ignore */ }
      });
    }
  }

  // Sonucu çıkmış ama henüz senkronlanmamış koşuların kazananını yakala
  // (hourly cron her koşu bitiminde hemen tetiklenmiyor, bu yüzden sayfa açılışında da deneriz)
  if (daysAhead <= 0 && daysAhead >= -7) {
    try { await syncResultsForDate(currentDate); } catch { /* ignore */ }
  }

  const days = await getProgramData(currentDate);
  const [session, agfMovers, altiliResults, tickerItems, followedHorses, coupons, hitPredictions] =
    await independentDataPromise;
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role ? hasRole(session.user.role as Role, "EDITOR") : false;
  // ŞİMDİLİK devre dışı: doğrulama maili gönderimi (Resend) henüz kurulmadığı için yeni üyeler
  // mail hiç gelmediğinden asla doğrulayamıyor ve analizlere sonsuza dek erişemiyordu. Resend
  // kurulunca `isAdmin || !!session?.user?.isEmailVerified` haline geri alınmalı.
  const isVerified = true;
  const userEmail = session?.user?.email ?? "";
  const followedNames = followedHorses.map((h) => h.horseName);

  // Jokey ve antrenör istatistikleri — TJK'nın resmi bu yıl galibiyet/biniş verileri
  const allJockeys = [...new Set(
    days.flatMap((d) => d.races.flatMap((r) => r.runners.map((ru) => ru.jockey).filter((j): j is string => !!j)))
  )];
  const allTrainers = [...new Set(
    days.flatMap((d) => d.races.flatMap((r) => r.runners.map((ru) => ru.trainer).filter((t): t is string => !!t)))
  )];
  const [jockeyStats, trainerStats] = await Promise.all([
    getJockeyStats(allJockeys).catch(() => ({} as Record<string, JockeyStat>)),
    getTrainerStats(allTrainers).catch(() => ({} as Record<string, TrainerStat>)),
  ]);

  // Üye olmayanlar için picks verisi client'a gönderilmez
  const viewDays = isLoggedIn
    ? days
    : days.map((d) => ({
        ...d,
        races: d.races.map((r) => ({ ...r, picks: [] as typeof r.picks })),
      }));

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-6">
      {/* Haber Akışı */}
      {tickerItems.length > 0 && <NewsTicker items={tickerItems} />}

      {/* Program */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">Yarış Programı</h1>
            {daysAhead >= 0 && <AutoRefresh />}
          </div>
          <DateNavigator currentDate={currentDate} basePath="/program" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <ProgramView days={viewDays} dateStr={currentDate} followedNames={followedNames} isLoggedIn={isLoggedIn} isAdmin={isAdmin} isVerified={isVerified} userEmail={userEmail} jockeyStats={jockeyStats} trainerStats={trainerStats} />
        </div>
      </div>

      {/* Kupon Önerileri */}
      {coupons.length > 0 && (
        <TahminOnerileri data={coupons} altiliResults={altiliResults} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      )}

      {/* Para Akışı (AGF) */}
      {(agfMovers.risers.length > 0 || agfMovers.fallers.length > 0) && (
        <div>
          <h2 className="text-base font-semibold mb-3">Para Akışı (AGF)</h2>
          <SteamWidget movers={agfMovers} />
        </div>
      )}

      {/* Yarış Sonuçları */}
      <AltiliGanyanResults results={altiliResults} />

      {/* İsabet Sağlayan Bankolar */}
      {hitPredictions.length > 0 && (
        <section className="border-t pt-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-hit" />
            <h2 className="text-base font-semibold">İsabet Sağlayan Bankolar</h2>
          </div>
          <HitsCarousel items={hitPredictions} />
        </section>
      )}
    </div>
  );
}
