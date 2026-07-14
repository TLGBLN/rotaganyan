import { getAdminRaceDays, getAnalystStats, getClassTypeAdvice } from "@/server/services/admin.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { turkeyDateString } from "@/lib/tz";
import DateNavigator from "@/components/kosular/DateNavigator";
import DeleteRaceDayButton from "@/components/admin/DeleteRaceDayButton";
import DeleteRaceButton from "@/components/admin/DeleteRaceButton";
import ForceIngestButton from "@/components/admin/ForceIngestButton";
import { forceIngestDate } from "@/server/actions/race.actions";

export const dynamic = "force-dynamic";

/** Kupon kademesi etiketi — RaceCard/InlineAnalysisPanel'deki sınıflandırmayla aynı eşikler. */
function couponTierLabel(rank: number): string {
  if (rank <= 3) return "Ekonomik";
  if (rank <= 6) return "Normal";
  return "Geniş";
}

type PageProps = {
  searchParams: Promise<{ tarih?: string }>;
};

function parseConditionsRef(conditions: string): { slug: string; raceNo: number } | null {
  const m = conditions.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u/i);
  if (!m) return null;
  const slug = m[1].trim()
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return { slug, raceNo: parseInt(m[2], 10) };
}

export default async function AdminKosularPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentDate = params.tarih ?? turkeyDateString();
  const [raceDays, analystStats] = await Promise.all([
    getAdminRaceDays(currentDate),
    getAnalystStats(currentDate),
  ]);

  // Build lookup: original races — by "slug:raceNo" AND by time (fallback for slug mismatches)
  type RaceRow = (typeof raceDays)[0]["races"][0];
  type OriginalMeta = {
    raceId: string;
    prediction: RaceRow["prediction"];
    classType: string;
    distance: number;
    runners: RaceRow["runners"];
  };
  const originalByKey = new Map<string, OriginalMeta>();
  const originalByTime = new Map<string, OriginalMeta>();
  for (const rd of raceDays) {
    if (rd.hippodrome.slug === "karma") continue;
    for (const race of rd.races) {
      if (race.conditions != null) continue;
      const meta: OriginalMeta = {
        raceId: race.id,
        prediction: race.prediction,
        classType: race.classType,
        distance: race.distance,
        runners: race.runners,
      };
      originalByKey.set(`${rd.hippodrome.slug}:${race.raceNo}`, meta);
      if (race.time) originalByTime.set(race.time, meta);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Koşu Programı</h1>
        <div className="flex items-center gap-2">
          <ForceIngestButton date={currentDate} action={forceIngestDate} />
          <DateNavigator currentDate={currentDate} basePath="/admin/kosular" />
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
                  {rd.races.map((race, i) => {
                    // Karma mirror: find original race's prediction + raceId
                    const karmaRef = race.conditions ? parseConditionsRef(race.conditions) : null;
                    const original = karmaRef
                      ? (originalByKey.get(`${karmaRef.slug}:${karmaRef.raceNo}`) ?? (race.time ? originalByTime.get(race.time) : null))
                      : null;
                    const effectivePred = race.prediction ?? original?.prediction ?? null;
                    const effectiveRaceId = original?.raceId ?? race.id;
                    const effectiveClassType = (race.classType && race.classType !== "—") ? race.classType : (original?.classType ?? race.classType);
                    const effectiveRunners = race.runners.length > 0 ? race.runners : (original?.runners ?? []);
                    const advice = getClassTypeAdvice(analystStats, effectiveClassType);
                    return (
                    <tr
                      key={race.id}
                      className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}
                    >
                      <td className="px-3 py-1.5 font-semibold">
                        {race.raceNo}
                        {race.conditions && (
                          <div className="text-[10px] font-normal text-muted-foreground">{race.conditions}</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{effectiveClassType}</span>
                          <span
                            title={advice.text}
                            className={cn(
                              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold cursor-help",
                              advice.level === "warn" && "bg-miss/20 text-miss",
                              advice.level === "info" && "bg-brand/20 text-brand",
                              advice.level === "good" && "bg-hit/20 text-hit",
                              advice.level === "none" && "bg-muted text-muted-foreground"
                            )}
                          >
                            {advice.level === "warn" ? "!" : advice.level === "good" ? "✓" : advice.level === "none" ? "–" : "i"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-[10px] leading-tight",
                            advice.level === "warn" && "text-miss",
                            advice.level === "info" && "text-brand",
                            advice.level === "good" && "text-hit",
                            advice.level === "none" && "text-muted-foreground/70"
                          )}
                        >
                          {advice.text}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">{effectiveRunners.length} at</td>
                      <td className="px-3 py-1.5">
                        {effectivePred ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/admin/analizler/${effectivePred.id}`}
                              className={cn(
                                "font-medium hover:underline",
                                effectivePred.published ? "text-hit" : "text-brand"
                              )}
                            >
                              {effectivePred.published ? "Yayında" : "Taslak"}
                            </Link>
                            <Link
                              href={`/admin/analizler/yeni?kosu=${effectiveRaceId}`}
                              className="text-muted-foreground hover:text-brand"
                              title="Analizi revize et"
                            >
                              + Ekle
                            </Link>
                            {effectivePred.picks
                              .filter((p) => p.isTarget)
                              .map((p) => (
                                <span
                                  key={p.rank}
                                  title="Hedef Safkan (şanslı/sürpriz potansiyelli at)"
                                  className="inline-flex items-center gap-0.5 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand"
                                >
                                  🎯 {couponTierLabel(p.rank)}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <Link
                            href={`/admin/analizler/yeni?kosu=${effectiveRaceId}`}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
