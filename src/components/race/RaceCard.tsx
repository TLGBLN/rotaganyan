import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TargetBadge from "@/components/prediction/TargetBadge";
import { cn, surfaceLabel, breedLabel } from "@/lib/utils";
import type { RaceDetail } from "@/server/services/race.service";
import type { PedigreeRating } from "@prisma/client";

type Props = {
  race: RaceDetail;
  isLoggedIn: boolean;
};

const PED_LABEL: Record<PedigreeRating, string> = {
  ZAYIF: "Zayıf",
  DUSUK: "Düşük",
  ORTA: "Orta",
  GUCLU: "Güçlü",
  YUKSEK: "Yüksek",
  COK_YUKSEK: "Çok Yüksek",
  SORU: "?",
  BILINMIYOR: "—",
};

function couponCategory(rank: number): { label: string; className: string } {
  if (rank <= 4) return { label: "Ekonomik", className: "border-hit text-hit" };
  if (rank <= 7) return { label: "Normal", className: "border-brand text-brand" };
  return { label: "Geniş", className: "border-muted-foreground text-muted-foreground" };
}

function splitLayerDetails(details: unknown) {
  const list = Array.isArray(details) ? (details as string[]) : [];
  let a = "—";
  let b = "—";
  let c = "—";
  const rest: string[] = [];
  for (const d of list) {
    if (/^A:\s*/.test(d)) a = d.replace(/^A:\s*/, "");
    else if (/^B:\s*/.test(d)) b = d.replace(/^B:\s*/, "");
    else if (/^C:\s*/.test(d)) c = d.replace(/^C:\s*/, "");
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
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">A Katmanı</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">B Katmanı</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">C Katmanı</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">Toplam</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Pedigri</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Kilit Gerekçe</th>
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
                      isWinner && "bg-brand/20"
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
                      <span className={isWinner ? "font-bold text-brand" : ""}>
                        {pick.runner?.name ?? pick.runnerLabel}
                      </span>
                      {isWinner && <span className="ml-1">🏆</span>}
                      {pick.isTarget && <TargetBadge className="ml-1.5" />}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{a}</td>
                    <td className="px-2 py-2 text-right font-mono">{b}</td>
                    <td className="px-2 py-2 text-right font-mono">{c}</td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-brand">
                      {pick.score ?? "—"}
                    </td>
                    <td className="px-2 py-2">{PED_LABEL[pick.pedigreeRating]}</td>
                    <td className="px-2 py-2 text-muted-foreground">{gerekce}</td>
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
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">At</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Jokey</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Antrenör</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">KG</th>
                <th className="px-2 py-2 text-right font-medium text-muted-foreground">AGF</th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground">Takı</th>
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
                  <td className="px-2 py-2">{runner.jockey ?? "—"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{runner.trainer ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">
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
                  <td className="px-2 py-2 text-right font-mono">
                    {runner.agf != null ? `%${runner.agf.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
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
