import { listSireStats, getSireStatCount, type SireStatRow } from "@/server/actions/sire-stat.actions";
import SireStatForm from "@/components/admin/SireStatForm";

export const dynamic = "force-dynamic";

export default async function AygirIstatistikPage() {
  const [count, recent] = await Promise.all([getSireStatCount(), listSireStats(50)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Aygır İstatistik</h1>
        <p className="text-xs text-muted-foreground">
          hipodromx.com&apos;dan elle kopyalanan aygır (sire) performans verileri — pist+mesafe kırılımlı. Toplam{" "}
          <strong>{count}</strong> kayıt.
        </p>
      </div>

      <SireStatForm />

      <div className="rounded-lg border">
        <div className="border-b bg-muted/10 px-3 py-2 text-xs font-semibold">Son Eklenenler ({recent.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Aygır</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Filtre</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Start</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">1.</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">K%</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">İkr.(TL)</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">AEI</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Henüz kayıt yok.</td></tr>
              ) : (
                recent.map((r: SireStatRow) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.sireName}</td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {r.irk} · {r.filtreYil} · {r.filtreCins} · {r.filtreSehir} · {r.filtreMesafe} · {r.filtrePist} · {r.filtreGrupListed} · {r.filtreYasGrubu}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.start}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.birinci}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">%{r.kYuzde}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.ikramiye.toLocaleString("tr-TR")}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.aei}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
