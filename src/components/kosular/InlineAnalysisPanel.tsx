import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";
import type { PedigreeRating } from "@prisma/client";

type Picks = NonNullable<ProgramRaceDay["races"][number]["prediction"]>["picks"];

type Props = {
  picks: Picks;
  winnerNo: number | null | undefined;
  isLoggedIn: boolean;
  href: string;
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

export default function InlineAnalysisPanel({ picks, winnerNo, isLoggedIn, href }: Props) {
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
              const isWinner = winnerNo != null && pick.runner?.no === winnerNo;
              return (
                <tr
                  key={pick.id}
                  className={cn(
                    "border-b last:border-0",
                    i % 2 === 1 && "race-row-even",
                    isWinner && "bg-yellow-400/15"
                  )}
                >
                  <td className="px-2 py-2 font-semibold">{pick.rank}</td>
                  <td className="px-2 py-2 font-mono">{pick.runner?.no ?? "—"}</td>
                  <td className="px-2 py-2 font-medium">
                    <span className={isWinner ? "font-bold text-yellow-600 dark:text-yellow-400" : ""}>
                      {pick.runner?.name ?? pick.runnerLabel}
                    </span>
                    {isWinner && <span className="ml-1">🏆</span>}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{a}</td>
                  <td className="px-2 py-2 text-right font-mono">{b}</td>
                  <td className="px-2 py-2 text-right font-mono">{c}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-brand">{pick.score ?? "—"}</td>
                  <td className="px-2 py-2">{PED_LABEL[pick.pedigreeRating]}</td>
                  <td className="px-2 py-2 text-muted-foreground">{gerekce}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Link href={href} className="text-xs text-brand hover:underline">
          Tam sayfada gör →
        </Link>
      </div>
    </div>
  );
}
