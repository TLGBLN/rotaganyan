import { getAdminPredictions, getAnalizIsabetOzeti } from "@/server/services/admin.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UnpublishButton from "../UnpublishButton";
import { kazananSirasi } from "@/lib/izleme/kazanan-sirasi";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function AdminAnalizlerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const [{ items, total }, ozet] = await Promise.all([getAdminPredictions(page, 30), getAnalizIsabetOzeti(200)]);
  const yz = (a: number) => (ozet.n ? `%${((a / ozet.n) * 100).toFixed(1)}` : "—");
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Geçmiş Analizler</h1>
        <Link
          href="/admin/analizler/yeni"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Yeni Analiz
        </Link>
      </div>

      {/* 2026-11-15: "Tuttu/Tutmadı" neye göre? — artık Top1 / Top3 / Top6 AYRI ve tanımları görünür. */}
      <div className="rounded-lg border p-3 text-xs">
        <p className="mb-2 font-semibold">Son {ozet.n} sonuçlanmış, yayındaki analiz — isabet (kayıtlı model sırasına göre)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><div className="text-muted-foreground">Top1 (1. seçim kazandı)</div><div className="text-base font-bold">{yz(ozet.top1)} <span className="text-[10px] font-normal text-muted-foreground">{ozet.top1}/{ozet.n}</span></div></div>
          <div><div className="text-muted-foreground">Top3 (kazanan ilk 3 seçimde)</div><div className="text-base font-bold">{yz(ozet.top3)} <span className="text-[10px] font-normal text-muted-foreground">{ozet.top3}/{ozet.n}</span></div></div>
          <div><div className="text-muted-foreground">Top6 (kazanan ilk 6 seçimde)</div><div className="text-base font-bold">{yz(ozet.top6)} <span className="text-[10px] font-normal text-muted-foreground">{ozet.top6}/{ozet.n}</span></div></div>
          <div><div className="text-muted-foreground">Listede yok</div><div className="text-base font-bold text-miss">{yz(ozet.listedeYok)} <span className="text-[10px] font-normal text-muted-foreground">{ozet.listedeYok}/{ozet.n}</span></div></div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Tanım: <b>Top1 ✓</b> = kayıtlı 1. seçim kazandı. <b>Top3 ✓</b> = kazanan kayıtlı ilk 3 seçimden biri. Sıra, yayınlanan tahminin kayıtlı sırasıdır (terfi/garanti mekanizmaları ham olasılıktan saptırabilir). Referans (AGF&apos;siz motor, 1470 yarış, çıkış-dışı): Top1 ≈ %26, Top3 ≈ %61; ≤7 atlı sahada Top3 ≈ %74, 13+ atlıda ≈ %52 — kalabalık sahada düşük isabet beklenir.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Koşu</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
              <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Top1</th>
              <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Top3</th>
              <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Kazanan sırası</th>
              <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground md:table-cell">Seçim</th>
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
                    <div className="text-xs text-muted-foreground">
                      {format(raceDay.date, "d MMM yyyy", { locale: tr })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={pred.published ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {pred.published ? "Yayında" : "Taslak"}
                    </Badge>
                  </td>
                  {(() => {
                    const res = race.result;
                    const sira = res ? kazananSirasi(res.winnerNos, pred.picks) : null;
                    const rozet = (ok: boolean) => (
                      <Badge variant="outline" className={cn("text-xs", ok ? "border-hit text-hit" : "border-miss text-miss")}>{ok ? "Tuttu" : "Tutmadı"}</Badge>
                    );
                    return (
                      <>
                        <td className="hidden px-3 py-2 sm:table-cell">{res ? rozet(sira != null && sira <= 1) : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="hidden px-3 py-2 sm:table-cell">{res ? rozet(sira != null && sira <= 3) : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="hidden px-3 py-2 text-xs sm:table-cell">{res ? (sira != null ? `${sira}. sıra` : <span className="text-miss">Listede yok</span>) : "—"}</td>
                        <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{pred.picks.length ? `${pred.picks.length} seçim` : "—"}</td>
                      </>
                    );
                  })()}
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
            <Link href={`/admin/analizler/gecmis?sayfa=${page - 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/analizler/gecmis?sayfa=${page + 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
