import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TargetBadge from "@/components/prediction/TargetBadge";
import FollowButton from "@/components/kosular/FollowButton";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";

type Picks = NonNullable<ProgramRaceDay["races"][number]["prediction"]>["picks"];

type Props = {
  picks: Picks;
  winnerNo: number | null | undefined;
  isLoggedIn: boolean;
  racePath?: string;
  followedHorseNames?: Set<string>;
};

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
  let a = "—", b = "—", c = "—", bcDirect = "";
  const rest: string[] = [];
  for (const d of list) {
    if (/^A:\s*/.test(d))      a        = scoreOnly(d.replace(/^A:\s*/, ""));
    else if (/^B\+C:\s*/.test(d)) bcDirect = scoreOnly(d.replace(/^B\+C:\s*/, ""));
    else if (/^B:\s*/.test(d)) b        = scoreOnly(d.replace(/^B:\s*/, ""));
    else if (/^C:\s*/.test(d)) c        = scoreOnly(d.replace(/^C:\s*/, ""));
    else rest.push(d);
  }
  // B+C: önce "B+C:" girişini kullan, yoksa ayrı B ve C değerlerini topla
  const bcNum = bcDirect
    ? parseInt(bcDirect, 10)
    : (parseInt(b, 10) || 0) + (parseInt(c, 10) || 0);
  const bc = bcDirect || (b !== "—" || c !== "—") ? (isNaN(bcNum) ? "—" : String(bcNum)) : "—";
  return { a, bc, gerekce: rest.join(" · ") || "—" };
}

export default function InlineAnalysisPanel({ picks, winnerNo, isLoggedIn, racePath, followedHorseNames }: Props) {
  if (!isLoggedIn) {
    const girisHref = racePath
      ? `/giris?callbackUrl=${encodeURIComponent(racePath)}`
      : "/giris";
    const kayitHref = racePath
      ? `/kayit?callbackUrl=${encodeURIComponent(racePath)}`
      : "/kayit";
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        <Lock className="h-5 w-5" />
        <p>Bu koşu için analiz mevcut. Görmek için giriş yapmalısınız.</p>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={girisHref}>Giriş Yap</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={kayitHref}>Kayıt Ol</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ── MOBİL: her at ayrı satır ── */}
      <div className="md:hidden rounded-lg border divide-y">
        {picks.map((pick, i) => {
          const isWinner = winnerNo != null && pick.runner?.no === winnerNo;
          const coupon = couponCategory(pick.rank);
          return (
            <div
              key={pick.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5",
                i % 2 === 1 && "race-row-even",
                pick.isTarget && "bg-target/10",
                isWinner && "bg-[#C98F02]/20"
              )}
            >
              <span className="w-4 shrink-0 text-center text-[11px] text-muted-foreground tabular-nums">
                {pick.rank}
              </span>
              <span className="w-5 shrink-0 font-mono text-xs tabular-nums">
                {pick.runner?.no ?? "—"}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className={cn("truncate text-xs font-medium", isWinner && "font-bold text-[#F5C518]", pick.runner?.scratched && "line-through opacity-50")}>
                  {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                </span>
                {pick.runner?.scratched && (
                  <span className="shrink-0 text-[10px] font-semibold text-red-400">Koşmaz</span>
                )}
                {pick.isTarget && <TargetBadge />}
                {pick.runner?.jockeyChanged && pick.runner.previousJockey && (
                  <span title={`Jokey değişti → önceki: ${pick.runner.previousJockey}`} className="shrink-0 rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    ÖJ
                  </span>
                )}
                {pick.runner?.name && followedHorseNames !== undefined && (
                  <FollowButton
                    horseName={pick.runner.name}
                    initialFollowing={followedHorseNames.has(pick.runner.name)}
                  />
                )}
              </div>
              <span className="shrink-0 font-mono text-xs font-bold text-brand">
                {pick.score ?? "—"}
              </span>
              <Badge variant="outline" className={cn("shrink-0 text-[10px]", coupon.className)}>
                {coupon.label}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* ── MASAÜSTÜ: tablo ── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Sıra</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Kupon</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">No</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">At</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">A</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">B+C</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Toplam</th>
              <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground md:table-cell">Kilit Gerekçe</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick, i) => {
              const { a, bc, gerekce } = splitLayerDetails(pick.details);
              const isWinner = winnerNo != null && pick.runner?.no === winnerNo;
              const coupon = couponCategory(pick.rank);
              return (
                <tr
                  key={pick.id}
                  className={cn(
                    "border-b last:border-0",
                    i % 2 === 1 && "race-row-even",
                    pick.isTarget && "bg-target/10",
                    isWinner && "bg-[#C98F02]/20"
                  )}
                >
                  <td className="px-2 py-2 font-semibold">{pick.rank}</td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className={cn("text-[10px]", coupon.className)}>
                      {coupon.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 font-mono">{pick.runner?.no ?? "—"}</td>
                  <td className="px-2 py-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(isWinner ? "font-bold text-[#F5C518]" : "", pick.runner?.scratched && "line-through opacity-50")}>
                        {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                      </span>
                      {pick.runner?.scratched && (
                        <span className="text-[10px] font-semibold text-red-400">Koşmaz</span>
                      )}
                      {pick.isTarget && <TargetBadge className="ml-1.5" />}
                      {pick.runner?.jockeyChanged && pick.runner.previousJockey && (
                        <span title={`Jokey değişti → önceki: ${pick.runner.previousJockey}`} className="rounded bg-orange-100 px-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          ÖJ
                        </span>
                      )}
                      {pick.runner?.name && followedHorseNames !== undefined && (
                        <FollowButton
                          horseName={pick.runner.name}
                          initialFollowing={followedHorseNames.has(pick.runner.name)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{a}</td>
                  <td className="px-2 py-2 text-right font-mono">{bc}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-brand">{pick.score ?? "—"}</td>
                  <td className="hidden px-2 py-2 text-muted-foreground md:table-cell">{gerekce}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
