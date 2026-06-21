import { getAllResults } from "@/server/services/admin.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SonuclarPage() {
  const allResults = await getAllResults();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Sonuçlar</h1>

      <div className="pt-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tüm Sonuçlar
        </h2>
        {allResults.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Henüz sonuç girilmemiş.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {allResults.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {r.race.raceDay.hippodrome.name} — {r.race.raceNo}. Koşu
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(r.race.raceDay.date, "d MMMM yyyy", { locale: tr })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      Kazanan: {r.winnerNo ?? "—"}
                      {r.ganyan != null && ` · Gny ${r.ganyan.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge
                        variant="outline"
                        className={r.hitTop1 || r.hitInCoupon ? "border-hit text-hit" : "border-miss text-miss"}
                      >
                        {r.hitTop1 ? "Tuttu" : r.hitInCoupon ? "Tuttu (İlk 3)" : "Tutmadı"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
