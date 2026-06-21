import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { PredictionListItem } from "@/server/services/race.service";

export default function KuponOnerileri({ items }: { items: PredictionListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-5 text-lg font-semibold">Kupon Önerileri</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((pred) => {
            const race = pred.race;
            const raceDay = race.raceDay;
            const href = `/kosular/${format(new Date(raceDay.date), "yyyy-MM-dd")}/${raceDay.hippodrome.slug}/${race.raceNo}`;

            return (
              <Link
                key={pred.id}
                href={href}
                className="rounded-lg border p-4 transition hover:border-brand/50"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold">
                    {raceDay.hippodrome.name} {race.raceNo}. Koşu
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(raceDay.date), "d MMM", { locale: tr })}
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  {pred.couponNarrow && (
                    <div>
                      <span className="text-muted-foreground">Dar: </span>
                      {pred.couponNarrow}
                    </div>
                  )}
                  {pred.couponNormal && (
                    <div>
                      <span className="text-muted-foreground">Normal: </span>
                      {pred.couponNormal}
                    </div>
                  )}
                  {pred.couponWide && (
                    <div>
                      <span className="text-muted-foreground">Geniş: </span>
                      {pred.couponWide}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
