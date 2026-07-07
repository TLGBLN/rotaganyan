import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getHippodromes, getRaceDaysByDate } from "@/server/services/race.service";
import { getAdminRaceDays, getAnalystStats, getClassTypeAdvice } from "@/server/services/admin.service";
import { turkeyDateString } from "@/lib/tz";
import PuanTablosu from "@/components/kosular/PuanTablosu";
import DateNavigator from "@/components/kosular/DateNavigator";
import KuponForm from "./KuponForm";
import KuponActions from "./KuponActions";
import type { HomeKuponLegInput } from "@/server/actions/home-kupon.actions";

export const dynamic = "force-dynamic";

function couponTierLabel(rank: number): string {
  if (rank <= 3) return "Ekonomik";
  if (rank <= 6) return "Normal";
  return "Geniş";
}

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

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AdminKuponPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  const [kuponlar, hippodromes, raceDays, adminRaceDays, analystStats] = await Promise.all([
    db.homeKupon.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getHippodromes(),
    getRaceDaysByDate(currentDate),        // PuanTablosu için
    getAdminRaceDays(currentDate),         // Koşu programı tablosu için (kosular ile aynı)
    getAnalystStats(),
  ]);

  // Karma mirror lookup — kosular/page.tsx ile aynı mantık
  type RaceRow = (typeof adminRaceDays)[0]["races"][0];
  type OriginalMeta = {
    raceId: string;
    prediction: RaceRow["prediction"];
    classType: string;
    distance: number;
    runners: RaceRow["runners"];
  };
  const originalByKey = new Map<string, OriginalMeta>();
  const originalByTime = new Map<string, OriginalMeta>();
  for (const rd of adminRaceDays) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kupon Hazırla</h1>
        <DateNavigator currentDate={currentDate} basePath="/admin/kupon" />
      </div>

      {/* ── Koşu Programı (kosular ile aynı veri) ── */}
      {adminRaceDays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Koşu Programı
          </h2>
          {adminRaceDays.map((rd) => (
            <div key={rd.id} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                {rd.hippodrome.name}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">No</th>
                      <th className="px-3 py-1.5 text-left font-medium">Saat</th>
                      <th className="px-3 py-1.5 text-left font-medium">Tür</th>
                      <th className="px-3 py-1.5 text-left font-medium">Mesafe</th>
                      <th className="px-3 py-1.5 text-left font-medium">At</th>
                      <th className="px-3 py-1.5 text-left font-medium">Analiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rd.races.map((race, i) => {
                      const karmaRef = race.conditions ? parseConditionsRef(race.conditions) : null;
                      const original = karmaRef
                        ? (originalByKey.get(`${karmaRef.slug}:${karmaRef.raceNo}`) ?? (race.time ? originalByTime.get(race.time) : null))
                        : null;
                      const effectivePred = race.prediction ?? original?.prediction ?? null;
                      const effectiveClassType =
                        race.classType && race.classType !== "—"
                          ? race.classType
                          : (original?.classType ?? race.classType);
                      const effectiveRunners =
                        race.runners.length > 0 ? race.runners : (original?.runners ?? []);
                      const advice = getClassTypeAdvice(analystStats, effectiveClassType);

                      return (
                        <tr
                          key={race.id}
                          className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}
                        >
                          <td className="px-3 py-1.5 font-semibold">
                            {race.raceNo}
                            {race.conditions && (
                              <div className="text-[10px] font-normal text-muted-foreground">
                                {race.conditions}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{race.time ?? "—"}</td>
                          <td className="px-3 py-1.5">
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
                          <td className="px-3 py-1.5 text-muted-foreground">{race.distance}m</td>
                          <td className="px-3 py-1.5">{effectiveRunners.length}</td>
                          <td className="px-3 py-1.5">
                            {effectivePred ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <Link
                                  href={`/admin/analizler/${effectivePred.id}`}
                                  className={cn(
                                    "font-medium hover:underline",
                                    effectivePred.published ? "text-hit" : "text-brand"
                                  )}
                                >
                                  {effectivePred.published ? "Yayında" : "Taslak"}
                                </Link>
                                {effectivePred.picks
                                  .filter((p) => p.isTarget)
                                  .map((p) => (
                                    <span
                                      key={p.rank}
                                      className="inline-flex items-center gap-0.5 rounded-full border border-brand/40 bg-brand/10 px-1 py-0 text-[9px] font-semibold text-brand"
                                    >
                                      🎯 {couponTierLabel(p.rank)}
                                    </span>
                                  ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

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
