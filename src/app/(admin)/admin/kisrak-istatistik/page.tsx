import { listDamStats, getDamStatCount, type DamStatRow } from "@/server/actions/dam-stat.actions";
import DamStatForm from "@/components/admin/DamStatForm";

export const dynamic = "force-dynamic";

export default async function KisrakIstatistikPage() {
  const [count, recent] = await Promise.all([getDamStatCount(), listDamStats(50)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Kısrak İstatistik</h1>
        <p className="text-xs text-muted-foreground">
          hipodromx.com&apos;dan elle kopyalanan kısrak (dam) performans verileri — pist+mesafe kırılımlı, anne +
          anne babası birlikte. Toplam <strong>{count}</strong> kayıt.
        </p>
      </div>

      <DamStatForm />

      <div className="rounded-lg border">
        <div className="border-b bg-muted/10 px-3 py-2 text-xs font-semibold">Son Eklenenler ({recent.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Kısrak</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Kısrak Baba</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Filtre</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">At</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Start</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">1.</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">K%</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">İkr.(TL)</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">Henüz kayıt yok.</td></tr>
              ) : (
                recent.map((r: DamStatRow) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.damName}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.damSireName}</td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {r.irk} · {r.filtreYil} · {r.filtreCins} · {r.filtreSehir} · {r.filtreMesafe} · {r.filtrePist} · {r.filtreGrupListed} · {r.filtreYasGrubu}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.atSayisi}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.start}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.birinci}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">%{r.kYuzde}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.ikramiye.toLocaleString("tr-TR")}</td>
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
