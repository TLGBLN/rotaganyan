import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { getActivePredictions } from "@/server/services/race.service";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function TahminOnerileriPage() {
  // Sonuçlanmış bir koşu "aktif" listede takılı kalmasın diye bugünü senkronla
  try { await syncResultsForDate(turkeyDateString()); } catch { /* ignore */ }

  const [items, session] = await Promise.all([getActivePredictions(), auth()]);
  if (!session?.user) {
    redirect("/giris?callbackUrl=%2Ftahmin-onerileri");
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Banko Önerileri</h1>
        <span className="text-sm text-muted-foreground">{items.length} öneri</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Şu an için sonuçlanmamış aktif banko önerisi yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Koşu</th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Tarih</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">1. Seçim</th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Kupon Önerisi</th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Yazar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pred, i) => {
                const race = pred.race;
                const raceDay = race.raceDay;
                const pick1 = pred.picks[0];
                const href = `/kosular/${format(raceDay.date, "yyyy-MM-dd")}/${raceDay.hippodrome.slug}/${race.raceNo}`;

                return (
                  <tr
                    key={pred.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      i % 2 === 1 && "race-row-even"
                    )}
                  >
                    <td className="px-3 py-2">
                      <Link href={href} className="font-semibold text-brand hover:underline">
                        {raceDay.hippodrome.name} {race.raceNo}. Koşu
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          {race.classType}
                        </Badge>
                        {pred.isBanko && (
                          <Badge variant="outline" className="ml-1 mt-0.5 text-[10px] text-brand">
                            ★ Banko
                          </Badge>
                        )}
                        {race.conditions && (
                          <div className="mt-0.5 text-[10px] text-brand/70 font-medium">↳ {race.conditions}</div>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                      {format(raceDay.date, "d MMM yyyy", { locale: tr })}
                      {pred.publishedAt && (
                        <div className="text-[10px]">
                          Yayım: {formatDate(pred.publishedAt, "d MMM HH:mm")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {pick1?.runner ? (
                        <span className="font-medium">
                          #{pick1.runner.no} {pick1.runner.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-xs font-mono sm:table-cell">
                      {pred.couponNarrow || pred.couponNormal || pred.couponWide ? (
                        <div className="space-y-0.5">
                          {pred.couponNarrow && <div>Ekonomik: {pred.couponNarrow}</div>}
                          {pred.couponNormal && <div>Normal: {pred.couponNormal}</div>}
                          {pred.couponWide && <div>Geniş: {pred.couponWide}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                      ROTAGANYAN Admin
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
