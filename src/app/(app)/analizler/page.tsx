import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { getPublishedPredictions } from "@/server/services/race.service";

type PageProps = {
  searchParams: Promise<{ sayfa?: string; tur?: string }>;
};

const PER_PAGE = 20;

export default async function AnalizlerPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user) {
    redirect("/giris?callbackUrl=%2Fanalizler");
  }
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));

  const { items, total } = await getPublishedPredictions(page, PER_PAGE, params.tur);
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">İsabet Sağlayan Bankolar</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Henüz analiz yayımlanmamış.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Koşu</th>
                  <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Tarih</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">1. Seçim</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sonuç</th>
                  <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Yazar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((pred, i) => {
                  const race = pred.race;
                  const raceDay = race.raceDay;
                  const pick1 = pred.picks[0];
                  const result = race.result;

                  return (
                    <tr
                      key={pred.id}
                      className={cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/30",
                        i % 2 === 1 && "race-row-even"
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="font-semibold">
                          {raceDay.hippodrome.name} {race.raceNo}. Koşu
                        </span>
                        <div className="text-[11px] text-muted-foreground">
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {race.classType}
                          </Badge>
                          <Badge variant="outline" className="ml-1 mt-0.5 text-[10px] text-brand">
                            ★ Banko
                          </Badge>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                        {format(raceDay.date, "d MMM yyyy", { locale: tr })}
                      </td>
                      <td className="px-3 py-2">
                        {pick1?.runner ? (
                          <span className="font-medium">
                            #{pick1.runner.no} {pick1.runner.name}
                            {result?.hitTop1 && result.ganyan != null && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                (Gny {result.ganyan.toFixed(2)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {result ? (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              result.hitTop1 ? "text-hit" : "text-miss"
                            )}
                          >
                            {result.hitTop1 ? "Tuttu ✓" : "Tutmadı ✗"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Bekleniyor</span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <Link
                  href={`/analizler?sayfa=${page - 1}${params.tur ? `&tur=${params.tur}` : ""}`}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  ← Önceki
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/analizler?sayfa=${page + 1}${params.tur ? `&tur=${params.tur}` : ""}`}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Sonraki →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
