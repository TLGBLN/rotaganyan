import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { getActivePredictions } from "@/server/services/race.service";

export const dynamic = "force-dynamic";

export default async function TahminOnerileriPage() {
  const [items, session] = await Promise.all([getActivePredictions(), auth()]);
  const isLoggedIn = !!session?.user;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tahmin Önerileri</h1>
        <span className="text-sm text-muted-foreground">{items.length} öneri</span>
      </div>

      {!isLoggedIn ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Lock className="h-6 w-6" />
          <p>
            {items.length > 0
              ? `Şu an ${items.length} aktif tahmin önerisi var.`
              : "Aktif tahmin önerilerini görmek için giriş yapmalısınız."}
            <br />
            Görmek için giriş yapmalısınız.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/giris">Giriş Yap</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/kayit">Kayıt Ol</Link>
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Şu an için sonuçlanmamış aktif öneri yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Koşu</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">1. Seçim</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kupon Önerisi</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Yazar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pred, i) => {
                const race = pred.race;
                const raceDay = race.raceDay;
                const pick1 = pred.picks[0];
                const href = `/kosular/${format(raceDay.date, "yyyy-MM-dd")}/${raceDay.hippodrome.slug}/${race.raceNo}`;

                return (
                  <tr
                    key={pred.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      i % 2 === 1 && "race-row-even"
                    )}
                  >
                    <td className="px-3 py-2">
                      <Link href={href} className="font-semibold text-brand hover:underline">
                        {raceDay.hippodrome.name} {race.raceNo}. Koşu
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          {race.classType}
                        </Badge>
                        {pred.isBanko && (
                          <Badge variant="outline" className="ml-1 mt-0.5 text-[10px] text-brand">
                            ★ Banko
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(raceDay.date, "d MMM yyyy", { locale: tr })}
                      {pred.publishedAt && (
                        <div className="text-[10px]">
                          Yayım: {format(new Date(pred.publishedAt), "d MMM HH:mm", { locale: tr })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {pick1?.runner ? (
                        <span className="font-medium">
                          #{pick1.runner.no} {pick1.runner.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {pred.couponNarrow || pred.couponNormal || pred.couponWide ? (
                        <div className="space-y-0.5">
                          {pred.couponNarrow && <div>Dar: {pred.couponNarrow}</div>}
                          {pred.couponNormal && <div>Normal: {pred.couponNormal}</div>}
                          {pred.couponWide && <div>Geniş: {pred.couponWide}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      ROTAGANYAN Admin
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
