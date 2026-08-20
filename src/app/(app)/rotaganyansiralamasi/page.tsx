import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRaceDaysByDate } from "@/server/services/race.service";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";
import PuanTablosu from "@/components/kosular/PuanTablosu";
import DateNavigator from "@/components/kosular/DateNavigator";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

// v6.50 — kullanıcı talebi 2026-08-03: yeni V2 motorunda Faz3 (sayısal puanlama)
// kullanılmayacağı için (bkz. [[project_v2_manuel_siralama]]) "Puan Tablosu" adı artık
// yanıltıcı — bu sayfa sıralamalı liste gösterecek, puan değil. "/rotaganyanpuantablosu"
// eski adresten buraya YÖNLENDİRİYOR (aşağıdaki eski page.tsx), bookmark/linkler kırılmasın.
export default async function RotaganyanSiralamasiPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const today = turkeyDateString();
  const currentDate = params.tarih ?? today;

  if (!session?.user) {
    redirect(
      `/giris?callbackUrl=${encodeURIComponent(`/rotaganyansiralamasi${params.tarih ? `?tarih=${params.tarih}` : ""}`)}`
    );
  }
  const isAdmin = hasRole(session.user.role as Role, "ADMIN");

  // Kazanan atı hemen yansıtmak için (saatlik cron'u beklemeden) sayfa açılışında senkronla.
  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );
  if (daysAhead <= 0 && daysAhead >= -7) {
    after(async () => {
      try { await syncResultsForDate(currentDate); } catch { /* ignore */ }
    });
  }

  const raceDays = await getRaceDaysByDate(currentDate, undefined);
  const visibleRaceDays = raceDays.filter((rd) => rd.races.length > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Rotaganyan Sıralama Tablosu</h1>
        <DateNavigator currentDate={currentDate} basePath="/rotaganyansiralamasi" />
      </div>

      {visibleRaceDays.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground rounded-lg border">
          Bu tarih için sıralama tablosu verisi bulunamadı.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleRaceDays.map((rd) => (
            <PuanTablosu key={rd.id} raceDay={rd} isLoggedIn={true} currentDate={currentDate} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
