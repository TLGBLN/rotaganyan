import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TargetBadge from "@/components/prediction/TargetBadge";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";

type Picks = NonNullable<ProgramRaceDay["races"][number]["prediction"]>["picks"];

type Props = {
  picks: Picks;
  winnerNo: number | null | undefined;
  isLoggedIn: boolean;
};

function couponCategory(rank: number): { label: string; className: string } {
  if (rank <= 3) return { label: "Ekonomik", className: "border-hit text-hit" };
  if (rank <= 7) return { label: "Normal", className: "border-brand text-brand" };
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

export default function InlineAnalysisPanel({ picks, winnerNo, isLoggedIn }: Props) {
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        <Lock className="h-5 w-5" />
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
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Sıra</th>
              <th className="hidden px-2 py-2 text-left font-medium text-muted-foreground sm:table-cell">Kupon</th>
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
              const isWinner = winnerNo != null && pick.runner?.no === winnerNo;
              const coupon = couponCategory(pick.rank);
              return (
                <tr
                  key={pick.id}
                  className={cn(
                    "border-b last:border-0",
                    i % 2 === 1 && "race-row-even",
                    pick.isTarget && "bg-target/10",
                    isWinner && "bg-brand/20"
                  )}
                >
                  <td className="px-2 py-2 font-semibold">{pick.rank}</td>
                  <td className="hidden px-2 py-2 sm:table-cell">
                    <Badge variant="outline" className={cn("text-[10px]", coupon.className)}>
                      {coupon.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 font-mono">{pick.runner?.no ?? "—"}</td>
                  <td className="px-2 py-2 font-medium">
                    <span className={isWinner ? "font-bold text-brand" : ""}>
                      {pick.runner?.name ?? pick.runnerLabel}
                    </span>
                    {isWinner && <span className="ml-1">🏆</span>}
                    {pick.isTarget && <TargetBadge className="ml-1.5" />}
                  </td>
                  <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{a}</td>
                  <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{b}</td>
                  <td className="hidden px-2 py-2 text-right font-mono sm:table-cell">{c}</td>
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
