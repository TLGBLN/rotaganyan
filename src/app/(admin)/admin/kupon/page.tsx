import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getHippodromes, getRaceDaysByDate } from "@/server/services/race.service";

import { turkeyDateString } from "@/lib/tz";
import PuanTablosu from "@/components/kosular/PuanTablosu";
import DateNavigator from "@/components/kosular/DateNavigator";
import KuponForm from "./KuponForm";
import KuponActions from "./KuponActions";
import type { HomeKuponLegInput } from "@/server/actions/home-kupon.actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AdminKuponPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;
  const [kuponlar, hippodromes, raceDays] = await Promise.all([
    db.homeKupon.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getHippodromes(),
    getRaceDaysByDate(currentDate),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kupon Hazırla</h1>
        <DateNavigator currentDate={currentDate} basePath="/admin/kupon" />
      </div>

      {/* ── Puan Tablosu ── */}
      {raceDays.map((rd) => (
        <PuanTablosu key={rd.id} raceDay={rd} isLoggedIn={true} currentDate={today} />
      ))}

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">Yeni Kombine Kupon</h2>
        <KuponForm hippodromes={hippodromes} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Geçmiş Kuponlar</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hipodrom</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ayak</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kuponlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Henüz kupon oluşturulmadı.
                  </td>
                </tr>
              )}
              {kuponlar.map((k, i) => {
                const legCount = Array.isArray(k.legs) ? k.legs.length : 0;
                return (
                  <tr key={k.id} className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}>
                    <td className="px-3 py-2 font-medium">{k.hippodromeName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(new Date(k.date), "d MMMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{legCount} ayak</td>
                    <td className="px-3 py-2">
                      <Badge variant={k.isActive ? "default" : "secondary"} className="text-xs">
                        {k.isActive ? "Yayında" : "Pasif"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <KuponActions
                        id={k.id}
                        isActive={k.isActive}
                        hippodromeName={k.hippodromeName}
                        date={k.date}
                        legs={Array.isArray(k.legs) ? (k.legs as HomeKuponLegInput[]) : []}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
