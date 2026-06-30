import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TargetBadge from "@/components/prediction/TargetBadge";
import { cn, surfaceLabel, breedLabel } from "@/lib/utils";
import type { RaceDetail } from "@/server/services/race.service";

type Props = {
  race: RaceDetail;
  isLoggedIn: boolean;
};

function RecentFormBadges({ form }: { form?: string | null }) {
  if (!form) return <span className="text-muted-foreground">—</span>;
  const digits = form.replace(/\D/g, "").split("");
  return (
    <div className="flex justify-center gap-0.5">
      {digits.map((d, i) => {
        const pos = parseInt(d, 10);
        const color =
          pos === 0 ? "bg-muted text-muted-foreground" :
          pos === 1 ? "bg-hit text-white" :
          pos === 2 ? "bg-hit/70 text-white" :
          pos === 3 ? "bg-brand/60 text-white" :
          "bg-muted-foreground/40 text-foreground";
        return (
          <span key={i} className={cn("inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold", color)}>
            {pos === 0 ? "—" : d}
          </span>
        );
      })}
    </div>
  );
}

function couponCategory(rank: number): { label: string; className: string } {
  if (rank <= 3) return { label: "Ekonomik", className: "border-hit text-hit" };
  if (rank <= 6) return { label: "Normal", className: "border-brand text-brand" };
  return { label: "Geniş", className: "border-muted-foreground text-muted-foreground" };
}

/** "51/60" gibi tavanlı bir skor metninden sadece pay (gerçek puan) kısmını döner. */
function scoreOnly(value: string): string {
  return value.split("/")[0]?.trim() || value;
}

function splitLayerDetails(details: unknown) {
  const list = Array.isArray(details) ? (details as string[]) : [];
  let a = "—";
  let b = "—";
  let c = "—";
  const rest: string[] = [];
  for (const d of list) {
    if (/^A:\s*/.test(d)) a = scoreOnly(d.replace(/^A:\s*/, ""));
    else if (/^B:\s*/.test(d)) b = scoreOnly(d.replace(/^B:\s*/, ""));
    else if (/^C:\s*/.test(d)) c = scoreOnly(d.replace(/^C:\s*/, ""));
    else rest.push(d);
  }
  return { a, b, c, gerekce: rest.join(" · ") || "—" };
}

export default function RaceCard({ race, isLoggedIn }: Props) {
  const { runners } = race;
  const picks = race.prediction?.published ? race.prediction.picks : [];
  const hasAnalysis = picks.length > 0;

  return (
    <section>
      {/* Race meta */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{race.classType}</Badge>
        <Badge variant="outline">{breedLabel(race.breed)}</Badge>
        <Badge variant="outline">{surfaceLabel(race.surface)}</Badge>
        <span>{race.distance}m</span>
        {race.ageWeight && <span>· {race.ageWeight}</span>}
        {race.conditions && <span>· {race.conditions}</span>}
        {race.trackRecord && <span className="text-xs">E.İ.D.: {race.trackRecord}</span>}
      </div>

      {hasAnalysis && !isLoggedIn ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Lock className="h-6 w-6" />
          <p>Bu koşu için analiz mevcut. Görmek için giriş yapmalısınız.</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/giris">Giriş Yap</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/kayit">Kayıt Ol</Link>
            </Button>
          </div>
        </div>
      ) : picks.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Sıra</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Kupon</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">No</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">At</th>
                <th className="hidden px-2 py-2 text-right font-medium text-muted-foreground sm:table-cell">A Katmanı</th>
                <th className="hidden px-2 py-2 text-right font-medium text-muted-foreground sm:table-cell">B Katmanı</th>
                <th className="hidden px-2 py-2 text-right font-medium text-muted-foreground sm:table-cell">C Katmanı</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Toplam</th>
                <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground md:table-cell">Kilit Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((pick, i) => {
                const { a, b, c, gerekce } = splitLayerDetails(pick.details);
                const isWinner = race.result?.winnerNo != null && pick.runner?.no === race.result.winnerNo;
                const coupon = couponCategory(pick.rank);
                return (
                  <tr
                    key={pick.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      i % 2 === 1 && "race-row-even",
                      pick.isTarget && "bg-target/10",
                      isWinner && "bg-[#C98F02]/20"
                    )}
                  >
                    <td className="px-2 py-2 font-semibold">{pick.rank}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", coupon.className)}>
                        {coupon.label}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 font-mono">{pick.runner?.no ?? "—"}</td>
                    <td className="px-2 py-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className={isWinner ? "font-bold text-[#C98F02]" : ""}>
                          {pick.runner?.name ?? pick.runnerLabel}
                        </span>
                        {isWinner && <span className="ml-1">🏆</span>}
                        {pick.isTarget && <TargetBadge className="ml-1.5" />}
                        {pick.runner?.jockeyChanged && pick.runner.previousJockey && (
                          <span title={`Jokey değişti → önceki: ${pick.runner.previousJockey}`} className="rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            ÖJ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{a}</td>
                    <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{b}</td>
                    <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{c}</td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-brand">
                      {pick.score ?? "—"}
                    </td>
                    <td className="hidden px-2 py-2 text-muted-foreground md:table-cell">{gerekce}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">No</th>
                <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground sm:table-cell">St</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">At</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Jokey</th>
                <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground sm:table-cell">Antrenör</th>
                <th className="hidden px-2 py-2 text-right font-medium text-muted-foreground sm:table-cell">KG</th>
                <th className="hidden px-2 py-2 text-center font-medium text-muted-foreground md:table-cell">Son 6 Y.</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">AGF</th>
                <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground lg:table-cell">Takı</th>
              </tr>
            </thead>
            <tbody>
              {runners.map((runner, i) => (
                <tr
                  key={runner.id}
                  className={cn(
                    "border-b last:border-0 transition-colors hover:bg-muted/30",
                    i % 2 === 1 && "race-row-even"
                  )}
                >
                  <td className="px-2 py-2 font-mono font-semibold">{runner.no}</td>
                  <td className="hidden px-2 py-2 font-mono text-muted-foreground sm:table-cell">{runner.startNo ?? "—"}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{runner.name}</span>
                      {runner.sameJockey && (
                        <span className="rounded bg-yellow-100 px-1 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          İJ
                        </span>
                      )}
                    </div>
                    {runner.sire && (
                      <div className="text-[10px] text-muted-foreground">
                        {runner.sire}
                        {runner.damSire && ` × ${runner.damSire}`}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <span>{runner.jockey ?? "—"}</span>
                      {runner.jockeyChanged && runner.previousJockey && (
                        <span title={`Önceki jokey: ${runner.previousJockey}`} className="rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          ÖJ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-2 py-2 text-muted-foreground sm:table-cell">{runner.trainer ?? "—"}</td>
                  <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">
                    {runner.weight ?? "—"}
                    {runner.weightChange != null && (
                      <span
                        className={cn(
                          "ml-1 text-[10px]",
                          runner.weightChange < 0 ? "text-hit" : "text-miss"
                        )}
                      >
                        ({runner.weightChange > 0 ? "+" : ""}
                        {runner.weightChange})
                      </span>
                    )}
                  </td>
                  <td className="hidden px-2 py-2 text-center md:table-cell">
                    <RecentFormBadges form={runner.recentForm} />
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {runner.agf != null ? `%${runner.agf.toFixed(1)}` : "—"}
                  </td>
                  <td className="hidden px-2 py-2 text-muted-foreground lg:table-cell">
                    <div>
                      {runner.equipment ?? "—"}
                      {runner.equipmentAdded && (
                        <span className="ml-1 text-[10px] text-hit">+{runner.equipmentAdded}</span>
                      )}
                      {runner.equipmentRemoved && (
                        <span className="ml-1 text-[10px] text-miss">-{runner.equipmentRemoved}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
