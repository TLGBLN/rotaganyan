import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import RefreshButton from "@/components/admin/RefreshButton";
import JokeyStatImport from "@/components/admin/JokeyStatImport";
import JokeySyncButton from "@/components/admin/JokeySyncButton";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ hipo?: string; pist?: string; irk?: string; sort?: string; q?: string }> };

export default async function AdminJokeyPage({ searchParams }: PageProps) {
  const { hipo, pist, irk, sort = "wins", q } = await searchParams;

  const where = {
    year: 2026,
    ...(hipo ? { hippoSlug: hipo } : {}),
    ...(pist ? { surface: pist } : {}),
    ...(irk ? { breed: irk } : {}),
    ...(q ? { jockey: { contains: q, mode: "insensitive" as const } } : {}),
  };

  // Jokey başına toplu istatistik
  const grouped = await db.jockeyStatSync.groupBy({
    by: ["jockey"],
    where,
    _sum: { rides: true, wins: true, tableCount: true },
    _avg: { performanceScore: true },
    orderBy: sort === "score"
      ? { _avg: { performanceScore: "desc" } }
      : sort === "rides"
      ? { _sum: { rides: "desc" } }
      : { _sum: { wins: "desc" } },
  });

  const rows = grouped.map((g) => {
    const rides = g._sum.rides ?? 0;
    const wins = g._sum.wins ?? 0;
    const tableCount = g._sum.tableCount ?? 0;
    return {
      jockey: g.jockey,
      rides,
      wins,
      tableCount,
      winRate: rides > 0 ? wins / rides : 0,
      tableRate: rides > 0 ? tableCount / rides : 0,
      performanceScore: g._avg.performanceScore,
    };
  });

  // Mevcut veri setleri (filtre seçenekleri için)
  const datasets = await db.jockeyStatSync.groupBy({
    by: ["hippoSlug", "breed", "surface", "year"],
    _count: { jockey: true },
    orderBy: [{ year: "desc" }, { hippoSlug: "asc" }],
  });

  const hippos = [...new Set(datasets.map((d) => d.hippoSlug))].sort();
  const surfaces = [...new Set(datasets.map((d) => d.surface).filter(Boolean))].sort();
  const breeds = [...new Set(datasets.map((d) => d.breed).filter(Boolean))].sort();

  // Bağlam etiketi
  const ctxParts: string[] = [];
  if (hipo) ctxParts.push(hipo);
  else ctxParts.push("Tüm hipodromlar");
  if (pist) ctxParts.push({ CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" }[pist] ?? pist);
  if (irk) ctxParts.push(irk === "INGILIZ" ? "İngiliz" : irk === "ARAP" ? "Arap" : irk);
  const contextLabel = ctxParts.join(" · ") + " · 2026";

  const isFiltered = !!(hipo || pist || irk || q);

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Jokey İstatistikleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contextLabel} · {rows.length} jokey
          </p>
        </div>
        <RefreshButton className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
      </div>

      {/* Filtreler — tam genişlik */}
      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Jokey Ara</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="İsim..."
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand min-w-[130px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Hipodrom</label>
          <select name="hipo" defaultValue={hipo ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[110px]">
            <option value="">Tümü</option>
            {hippos.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Pist</label>
          <select name="pist" defaultValue={pist ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[90px]">
            <option value="">Tümü</option>
            {surfaces.map((s) => <option key={s ?? ""} value={s ?? ""}>{s === "CIM" ? "Çim" : s === "KUM" ? "Kum" : s === "SENTETIK" ? "Sentetik" : s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Irk</label>
          <select name="irk" defaultValue={irk ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[90px]">
            <option value="">Tümü</option>
            {breeds.map((b) => <option key={b ?? ""} value={b ?? ""}>{b === "INGILIZ" ? "İngiliz" : b === "ARAP" ? "Arap" : b}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Sırala</label>
          <select name="sort" defaultValue={sort} className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none min-w-[100px]">
            <option value="wins">Galibiyet</option>
            <option value="rides">Biniş sayısı</option>
            <option value="score">Performans</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
          Filtrele
        </button>
        {isFiltered && (
          <Link href="/admin/jokey" className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Temizle
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sol: Import + yönetim */}
        <div className="space-y-4">
          <JokeyStatImport />
          <JokeySyncButton />


          {datasets.length > 0 && (
            <div className="rounded-xl border p-3 space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Yüklü Setler</h3>
              {datasets.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="font-medium capitalize">
                    {d.hippoSlug}
                    {d.surface ? ` · ${d.surface === "CIM" ? "Çim" : d.surface === "KUM" ? "Kum" : "Snt"}` : ""}
                    {d.breed ? ` · ${d.breed === "INGILIZ" ? "İng" : "Arap"}` : ""}
                  </span>
                  <span className="text-muted-foreground">{d._count.jockey}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ: Ana tablo */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border overflow-hidden">
            {rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {datasets.length === 0
                  ? "Henüz veri yüklenmedi — sol taraftan JSON dosyası ekleyin."
                  : "Bu filtre kombinasyonu için veri bulunamadı."}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium">Jokey</th>
                        <th className="px-3 py-2 text-center font-medium">Biniş</th>
                        <th className="px-3 py-2 text-center font-medium">1.</th>
                        <th className="px-3 py-2 text-center font-medium">K%</th>
                        <th className="px-3 py-2 text-center font-medium">Tb%</th>
                        <th className="px-3 py-2 text-center font-medium">Skor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const winPct = Math.round(r.winRate * 100);
                        const tabPct = Math.round(r.tableRate * 100);
                        const color = winPct >= 25 ? "text-hit" : winPct >= 15 ? "text-brand" : "text-muted-foreground";
                        return (
                          <tr key={r.jockey} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2 font-semibold">{r.jockey}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.rides}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium">{r.wins}</td>
                            <td className={cn("px-3 py-2 text-center tabular-nums font-bold", color)}>%{winPct}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">%{tabPct}</td>
                            <td className="px-3 py-2 text-center tabular-nums font-medium text-brand">
                              {r.performanceScore != null ? r.performanceScore.toFixed(1) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                  {rows.length} jokey · {isFiltered ? contextLabel : "Tüm setler toplandı"} · K% = kazanma oranı · Tb% = ilk 5 oranı · Skor = performans puanı
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
