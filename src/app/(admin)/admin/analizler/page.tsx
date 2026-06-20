import { getAdminPredictions } from "@/server/services/admin.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UnpublishButton from "./UnpublishButton";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function AdminAnalizlerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const { items, total } = await getAdminPredictions(page, 30);
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Analizler</h1>
        <Link
          href="/admin/analizler/yeni"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Yeni Analiz
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Koşu</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Sonuç</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((pred, i) => {
              const race = pred.race;
              const raceDay = race.raceDay;
              return (
                <tr
                  key={pred.id}
                  className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/analizler/${pred.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {raceDay.hippodrome.name} {race.raceNo}. Koşu
                    </Link>
                    {pred.isBanko && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] text-brand">
                        ★ Banko
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {format(raceDay.date, "d MMM yyyy", { locale: tr })}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={pred.published ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {pred.published ? "Yayında" : "Taslak"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {race.result ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          race.result.hitTop1 ? "border-hit text-hit" : "border-miss text-miss"
                        )}
                      >
                        {race.result.hitTop1 ? "Tuttu" : "Tutmadı"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/analizler/${pred.id}`}
                        className="text-xs text-brand hover:underline"
                      >
                        Düzenle
                      </Link>
                      {pred.published && <UnpublishButton id={pred.id} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/admin/analizler?sayfa=${page - 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/analizler?sayfa=${page + 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
