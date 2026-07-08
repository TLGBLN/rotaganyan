import { getAllJockeyStats, getHippodromes } from "@/server/services/race.service";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SURFACES = [
  { value: "", label: "Tüm Pistler" },
  { value: "KUM", label: "Kum" },
  { value: "CIM", label: "Çim" },
  { value: "SENTETIK", label: "Sentetik" },
];

const BREEDS = [
  { value: "", label: "Tüm Irklar" },
  { value: "INGILIZ", label: "İngiliz" },
  { value: "ARAP", label: "Arap" },
];

type PageProps = { searchParams: Promise<{ hipo?: string; pist?: string; irk?: string }> };

export default async function AdminJokeyPage({ searchParams }: PageProps) {
  const { hipo, pist, irk } = await searchParams;
  const year = new Date().getFullYear();

  const [hippodromes, rows] = await Promise.all([
    getHippodromes(),
    getAllJockeyStats({ hippoSlug: hipo || undefined, surface: pist || undefined, breed: irk || undefined, year }),
  ]);

  const selectedHippo = hippodromes.find((h) => h.slug === hipo);
  const selectedSurface = SURFACES.find((s) => s.value === (pist ?? "")) ?? SURFACES[0];
  const selectedBreed = BREEDS.find((b) => b.value === (irk ?? "")) ?? BREEDS[0];

  const contextLabel = [
    selectedHippo?.name ?? "Tüm Hipodromlar",
    selectedSurface.value ? selectedSurface.label : "",
    selectedBreed.value ? selectedBreed.label : "",
  ].filter(Boolean).join(" · ");

  // Yenile URL — aynı filtrelerle sayfayı taze yükler
  const refreshParams = new URLSearchParams();
  if (hipo) refreshParams.set("hipo", hipo);
  if (pist) refreshParams.set("pist", pist);
  if (irk) refreshParams.set("irk", irk);
  const refreshUrl = `/admin/jokey${refreshParams.size ? `?${refreshParams}` : ""}`;

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Jokey İstatistikleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{year} sezonu · {contextLabel}</p>
        </div>
        <Link
          href={refreshUrl}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Yenile
        </Link>
      </div>

      {/* Filtreler */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Hipodrom</label>
          <select
            name="hipo"
            defaultValue={hipo ?? ""}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Tüm Hipodromlar</option>
            {hippodromes
              .filter((h) => h.slug !== "karma")
              .map((h) => (
                <option key={h.slug} value={h.slug}>{h.name}</option>
              ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Pist</label>
          <select
            name="pist"
            defaultValue={pist ?? ""}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {SURFACES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Irk</label>
          <select
            name="irk"
            defaultValue={irk ?? ""}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {BREEDS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors"
        >
          Filtrele
        </button>

        {(hipo || pist || irk) && (
          <Link
            href="/admin/jokey"
            className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Temizle
          </Link>
        )}
      </form>

      {/* Tablo */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium w-8">#</th>
                <th className="px-3 py-2 text-left font-medium">Jokey</th>
                <th className="px-3 py-2 text-center font-medium">Biniş</th>
                <th className="px-3 py-2 text-center font-medium">Galibiyet</th>
                <th className="px-3 py-2 text-center font-medium">Kazanma %</th>
                <th className="px-3 py-2 text-left w-40 font-medium">Oran</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Bu filtre için veri bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const color =
                    r.winPct >= 25 ? "text-hit" :
                    r.winPct >= 15 ? "text-brand" : "text-muted-foreground";
                  const barWidth = Math.min(r.winPct * 2, 100);

                  return (
                    <tr
                      key={r.jockey}
                      className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}
                    >
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{r.jockey}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.rides}</td>
                      <td className="px-3 py-2 text-center tabular-nums font-medium">{r.wins}</td>
                      <td className={cn("px-3 py-2 text-center tabular-nums font-bold", color)}>
                        %{r.winPct}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", r.winPct >= 25 ? "bg-hit" : r.winPct >= 15 ? "bg-brand" : "bg-muted-foreground/40")}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">{r.wins}/{r.rides}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {rows.length} jokey · Veri DB&apos;den anlık hesaplanır, yeni sonuçlar girilince otomatik güncellenir.
          </div>
        )}
      </div>
    </div>
  );
}
