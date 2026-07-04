import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getHippodromes, getRaceDaysByDate } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import PuanTablosu from "@/components/kosular/PuanTablosu";
import KuponForm from "./KuponForm";
import KuponActions from "./KuponActions";
import type { HomeKuponLegInput } from "@/server/actions/home-kupon.actions";

export const dynamic = "force-dynamic";

function couponTierLabel(rank: number) {
  if (rank <= 3) return { label: "E", title: "Ekonomik (1-3)", cls: "bg-hit/20 text-hit" };
  if (rank <= 6) return { label: "N", title: "Normal (4-6)", cls: "bg-brand/20 text-brand" };
  return { label: "G", title: "Geniş (7+)", cls: "bg-muted text-muted-foreground" };
}

export default async function AdminKuponPage() {
  const today = turkeyDateString();
  const [kuponlar, hippodromes, raceDays] = await Promise.all([
    db.homeKupon.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getHippodromes(),
    getRaceDaysByDate(today),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Kupon Hazırla</h1>

      {/* ── Bugünün Analiz Referansı ── */}
      {raceDays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bugün ({format(new Date(today), "d MMMM", { locale: tr })}) — Analiz Referansı
          </h2>
          {raceDays.map((rd) => {
            const analyzedRaces = rd.races.filter((r) => r.prediction?.published);
            if (analyzedRaces.length === 0) return null;
            return (
              <div key={rd.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                  <span className="text-sm font-semibold">{rd.hippodrome.name}</span>
                  <span className="text-xs text-muted-foreground">{analyzedRaces.length}/{rd.races.length} analiz</span>
                </div>
                <div className="divide-y">
                  {rd.races.map((race) => {
                    const pred = race.prediction;
                    const hasAnalysis = pred?.published;
                    return (
                      <div
                        key={race.id}
                        className={cn(
                          "flex gap-3 px-3 py-2 text-xs",
                          !hasAnalysis && "opacity-40"
                        )}
                      >
                        {/* Koşu no + saat */}
                        <div className="w-16 shrink-0">
                          <span className="font-bold">{race.raceNo}. Koşu</span>
                          {race.time && (
                            <div className="text-[10px] text-muted-foreground">{race.time}</div>
                          )}
                        </div>

                        {/* Sınıf */}
                        <div className="w-32 shrink-0 text-muted-foreground leading-tight">
                          <div>{race.classType}</div>
                          <div className="text-[10px]">{race.distance}m</div>
                        </div>

                        {/* Analiz seçimleri */}
                        {hasAnalysis ? (
                          <div className="flex flex-wrap gap-1 flex-1">
                            {pred!.isBanko && (
                              <span className="mr-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">BANKO</span>
                            )}
                            {pred!.picks.map((pick) => {
                              const tier = couponTierLabel(pick.rank);
                              return (
                                <span
                                  key={pick.id}
                                  title={`${pick.rank}. sıra · ${tier.title}${pick.score ? ` · ${pick.score} puan` : ""}`}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono",
                                    tier.cls,
                                    pick.isTarget && "ring-1 ring-brand"
                                  )}
                                >
                                  <span className="font-bold">{pick.runner?.no ?? "?"}</span>
                                  <span className="text-[10px] opacity-80 truncate max-w-[80px]">
                                    {pick.runner?.name ?? pick.runnerLabel}
                                  </span>
                                  <span className={cn("text-[9px] font-semibold rounded", tier.cls)}>{tier.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Analiz yok</span>
                        )}

                        {/* Sonuç */}
                        {race.result && (
                          <span className="shrink-0 text-hit font-medium">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Puan Tablosu */}
          {raceDays.map((rd) => (
            <PuanTablosu key={rd.id} raceDay={rd} isLoggedIn={true} currentDate={today} />
          ))}
        </div>
      )}

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
