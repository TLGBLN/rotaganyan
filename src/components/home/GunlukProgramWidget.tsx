import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn, surfaceLabel, breedLabel } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";

type Props = {
  raceDays: ProgramRaceDay[];
  dateStr: string;
  isLoggedIn: boolean;
};

function SurfaceDot({ surface }: { surface: string }) {
  const cls =
    surface === "CIM" ? "bg-hit" :
    surface === "SENTETIK" ? "bg-brand" :
    "bg-[#996633]";
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", cls)} />;
}

export default function GunlukProgramWidget({ raceDays, dateStr, isLoggedIn }: Props) {
  if (raceDays.length === 0) return null;

  const totalRaces = raceDays.reduce((s, rd) => s + rd.races.length, 0);
  const analyzedRaces = raceDays.reduce(
    (s, rd) => s + rd.races.filter((r) => r.prediction?.published).length,
    0
  );

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Günün Koşu Programı</h2>
            {isLoggedIn ? (
              <p className="mt-1 text-sm text-muted-foreground/70 italic">
                Analizleri görmek için bir koşu seçiniz.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground/70 italic">
                Analizleri görmek için bir koşuya tıklayınız.
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalRaces} koşu · {analyzedRaces} analiz yayımlandı
            </p>
          </div>
          <Link
            href={`/kosular?tarih=${dateStr}`}
            className="text-sm text-brand hover:underline"
          >
            Tüm Program →
          </Link>
        </div>

        {/* Hippodrome cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {raceDays.map((rd) => {
            const hipSlug = rd.hippodrome.slug;
            const hipName = rd.hippodrome.name;
            const races = rd.races;
            const analyzed = races.filter((r) => r.prediction?.published).length;
            const banko = races.filter((r) => r.prediction?.published && r.prediction.isBanko).length;

            return (
              <div key={rd.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{hipName}</span>
                    {banko > 0 && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                        {banko} BANKO
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{races.length} koşu</span>
                </div>

                {/* Race rows */}
                <div className="divide-y">
                  {races.map((race) => {
                    const hasAnalysis = !!race.prediction?.published;
                    const isBanko = race.prediction?.isBanko;
                    const isResulted = !!race.result;
                    const href = `/kosular?tarih=${dateStr}`;

                    return (
                      <Link
                        key={race.id}
                        href={href}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-muted/40"
                      >
                        {/* Race no */}
                        <span className="w-5 shrink-0 font-mono font-semibold text-muted-foreground">
                          {race.raceNo}.
                        </span>

                        {/* Time */}
                        <span className="w-10 shrink-0 font-mono text-muted-foreground">
                          {race.time ?? "—"}
                        </span>

                        {/* Surface dot + class */}
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <SurfaceDot surface={race.surface} />
                          <span className="truncate font-medium">{race.classType}</span>
                        </div>

                        {/* Distance */}
                        <span className="shrink-0 font-mono text-muted-foreground">
                          {race.distance}m
                        </span>

                        {/* Analysis badge */}
                        {isResulted ? (
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Bitti
                          </span>
                        ) : hasAnalysis ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              isBanko
                                ? "bg-brand/15 text-brand"
                                : "bg-hit/15 text-hit"
                            )}
                          >
                            {isBanko ? "★ Banko" : "Analiz"}
                          </span>
                        ) : (
                          <span className="shrink-0 w-10" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Card footer */}
                <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-hit" /> Çim
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#996633]" /> Kum
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" /> Sentetik
                  </span>
                  {analyzed > 0 && (
                    <span className="ml-auto text-hit font-medium">{analyzed}/{races.length} analiz</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
