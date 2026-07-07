import { after } from "next/server";
import { getProgramData, getKuponOnerileri } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { getAgfMovers } from "@/server/services/agf-trend.service";
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
      try { await ingestDate(tjkDate); } catch { /* ignore */ }
    } else {
      after(async () => {
        try { await ingestDate(tjkDate); } catch { /* ignore */ }
      });
    }
  }

  const [session, days, agfMovers, altiliResults, tickerItems, followedHorses, coupons] = await Promise.all([
    auth(),
    getProgramData(currentDate),
    getAgfMovers(today),
    fetchTodaysAltiliResults(),
    fetchTjkTicker(),
    getFollowedHorses().catch(() => [] as { horseName: string }[]),
    getKuponOnerileri().catch(() => []),
  ]);
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role ? hasRole(session.user.role as Role, "EDITOR") : false;
  const followedNames = followedHorses.map((h) => h.horseName);

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
          <ProgramView days={days} dateStr={currentDate} followedNames={followedNames} isLoggedIn={isLoggedIn} />
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
          <SteamWidget movers={agfMovers} dateStr={today} />
        </div>
      )}

      {/* Yarış Sonuçları */}
      <AltiliGanyanResults results={altiliResults} />
    </div>
  );
}
