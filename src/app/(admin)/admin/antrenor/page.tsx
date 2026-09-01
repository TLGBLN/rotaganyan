import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import RefreshButton from "@/components/admin/RefreshButton";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sort?: string; q?: string }> };

/**
 * 2026-09-01 kullanıcı talebi — jokey sayfasıyla (/admin/jokey) AYNI amaç ama TrainerStatSync
 * jokeyden DAHA BASİT bir şema (yalnız trainer/year/rides/wins/winRate — hipodrom/pist/ırk
 * kırılımı YOK, TJK'nın AntrenorIstatistikleri sayfası da bu düzeyde bir toplu özet veriyor).
 * Senkronizasyon zaten günlük cron'la (syncTrainerStatsFromTjk, /api/cron/sync-trainer-stats)
 * otomatik — burada ayrı bir manuel "şimdi çek" butonu YOK, yalnız salt-okunur görüntüleme.
 */
export default async function AdminAntrenorPage({ searchParams }: PageProps) {
  const { sort = "wins", q } = await searchParams;
  const year = new Date().getFullYear();

  const rows = await db.trainerStatSync.findMany({
    where: {
      year,
      ...(q ? { trainer: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: sort === "rides" ? { rides: "desc" } : sort === "winRate" ? { winRate: "desc" } : { wins: "desc" },
  });

  const isFiltered = !!q;
  const sonGuncelleme = rows.reduce<Date | null>((en, r) => (!en || r.updatedAt > en ? r.updatedAt : en), null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Antrenör İstatistikleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {year} · {rows.length} antrenör · Kaynak:{" "}
            <a href="https://www.tjk.org/TR/YarisSever/Query/Page/AntrenorIstatistikleri" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              TJK AntrenorIstatistikleri
            </a>{" "}
            (günlük cron ile otomatik senkronize — bkz. syncTrainerStatsFromTjk)
            {sonGuncelleme && <> · son güncelleme {sonGuncelleme.toLocaleString("tr-TR")}</>}
          </p>
        </div>
        <RefreshButton className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Antrenör Ara</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="İsim..."
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand min-w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Sırala</label>
          <select name="sort" defaultValue={sort} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[100px]">
            <option value="wins">Galibiyet</option>
            <option value="rides">Biniş sayısı</option>
            <option value="winRate">Kazanma oranı</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
          Filtrele
        </button>
        {isFiltered && (
          <Link href="/admin/antrenor" className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Temizle
          </Link>
        )}
      </form>

      <div className="rounded-lg border overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Bu filtre için veri bulunamadı — henüz senkronize edilmemiş olabilir (günlük cron bekleniyor).
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium">Antrenör</th>
                    <th className="px-3 py-2 text-center font-medium">Biniş</th>
                    <th className="px-3 py-2 text-center font-medium">1.</th>
                    <th className="px-3 py-2 text-center font-medium">K%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const winPct = Math.round(r.winRate * 100);
                    const color = winPct >= 25 ? "text-hit" : winPct >= 15 ? "text-brand" : "text-muted-foreground";
                    return (
                      <tr key={r.id} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold">{r.trainer}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.rides}</td>
                        <td className="px-3 py-2 text-center tabular-nums font-medium">{r.wins}</td>
                        <td className={cn("px-3 py-2 text-center tabular-nums font-bold", color)}>%{winPct}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
              {rows.length} antrenör · K% = kazanma oranı. Program sayfalarındaki kısaltılmış isimler
              (ör. &quot;A.YILMAZ&quot;) analiz motorunda soyadı/baş harf eşleştirmesiyle (getTrainerStats)
              buradaki tam isimlerle otomatik eşleştirilir.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
