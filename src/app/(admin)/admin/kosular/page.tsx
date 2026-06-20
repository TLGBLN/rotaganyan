import { getAdminRaceDays } from "@/server/services/admin.service";
import AgfSyncButton from "./AgfSyncButton";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DateNavigator from "@/components/kosular/DateNavigator";
import DeleteRaceDayButton from "@/components/admin/DeleteRaceDayButton";
import DeleteRaceButton from "@/components/admin/DeleteRaceButton";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tarih?: string }>;
};

export default async function AdminKosularPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentDate = params.tarih ?? format(new Date(), "yyyy-MM-dd");
  const raceDays = await getAdminRaceDays(currentDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Koşu Programı</h1>
        <div className="flex items-center gap-2">
          <DateNavigator currentDate={currentDate} basePath="/admin/kosular" />
          <AgfSyncButton date={currentDate} />
        </div>
      </div>

      {raceDays.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Bu tarih için koşu programı bulunamadı.
        </div>
      )}

      <div className="space-y-4">
        {raceDays.map((rd) => (
          <section key={rd.id} className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <h2 className="text-sm font-semibold">
                {rd.hippodrome.name} —{" "}
                {format(rd.date, "d MMMM yyyy (EEEE)", { locale: tr })}
              </h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {rd.races.length} koşu
                </Badge>
                <DeleteRaceDayButton
                  raceDayId={rd.id}
                  label={`${rd.hippodrome.name} — ${format(rd.date, "d MMMM yyyy", { locale: tr })}`}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">No</th>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Tür</th>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">At</th>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Analiz</th>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Sonuç</th>
                    <th className="px-3 py-1.5 text-right font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {rd.races.map((race, i) => (
                    <tr
                      key={race.id}
                      className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}
                    >
                      <td className="px-3 py-1.5 font-semibold">{race.raceNo}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{race.classType}</td>
                      <td className="px-3 py-1.5">{race.runners.length} at</td>
                      <td className="px-3 py-1.5">
                        {race.prediction ? (
                          <Link
                            href={`/admin/analizler/${race.prediction.id}`}
                            className={cn(
                              "font-medium hover:underline",
                              race.prediction.published ? "text-hit" : "text-brand"
                            )}
                          >
                            {race.prediction.published ? "Yayında" : "Taslak"}
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/analizler/yeni?kosu=${race.id}`}
                            className="text-muted-foreground hover:text-brand"
                          >
                            + Analiz Ekle
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {race.result ? (
                          <span className="text-hit">✓ Girildi</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <DeleteRaceButton
                          raceId={race.id}
                          label={`${rd.hippodrome.name} ${race.raceNo}. Koşu`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
