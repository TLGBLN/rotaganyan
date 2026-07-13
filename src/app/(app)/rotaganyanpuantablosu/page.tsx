import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRaceDaysByDate } from "@/server/services/race.service";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";
import PuanTablosu from "@/components/kosular/PuanTablosu";
import DateNavigator from "@/components/kosular/DateNavigator";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function PuanTablosuPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const today = turkeyDateString();
  const currentDate = params.tarih ?? today;

  if (!session?.user) {
    redirect(
      `/giris?callbackUrl=${encodeURIComponent(`/rotaganyanpuantablosu${params.tarih ? `?tarih=${params.tarih}` : ""}`)}`
    );
  }

  // Kazanan atı hemen yansıtmak için (saatlik cron'u beklemeden) sayfa açılışında senkronla
  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );
  if (daysAhead <= 0 && daysAhead >= -7) {
    try { await syncResultsForDate(currentDate); } catch { /* ignore */ }
  }

  const raceDays = await getRaceDaysByDate(currentDate, undefined);
  const visibleRaceDays = raceDays.filter((rd) => rd.races.length > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Rotaganyan Puan Tablosu</h1>
        <DateNavigator currentDate={currentDate} basePath="/rotaganyanpuantablosu" />
      </div>

      {visibleRaceDays.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground rounded-lg border">
          Bu tarih için puan tablosu verisi bulunamadı.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleRaceDays.map((rd) => (
            <PuanTablosu key={rd.id} raceDay={rd} isLoggedIn={true} currentDate={currentDate} />
          ))}
        </div>
      )}
    </div>
  );
}
