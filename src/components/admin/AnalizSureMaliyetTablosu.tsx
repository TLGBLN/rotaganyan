import type { AnalysisRunSummary } from "@/lib/claude-cost";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

function formatSure(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  const dk = Math.floor(totalSec / 60);
  const sn = totalSec % 60;
  return dk > 0 ? `${dk}dk ${sn}sn` : `${sn}sn`;
}

function formatCent(usd: number): string {
  return `${(usd * 100).toFixed(1)}¢`;
}

export default function AnalizSureMaliyetTablosu({ runs }: { runs: AnalysisRunSummary[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Analiz Süre &amp; Maliyet Kaydı
        </h3>
        <p className="text-xs text-muted-foreground">Henüz kayıt yok.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Analiz Süre &amp; Maliyet Kaydı — Son {runs.length}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Koşu</th>
              <th className="px-2 py-1.5 text-right font-medium">Faz2</th>
              <th className="px-2 py-1.5 text-right font-medium">Faz3</th>
              <th className="px-2 py-1.5 text-right font-medium">Toplam Süre</th>
              <th className="px-2 py-1.5 text-right font-medium">Maliyet</th>
              <th className="px-2 py-1.5 text-right font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.raceId} className="border-b last:border-0">
                <td className="px-2 py-1.5">{r.raceLabel}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatSure(r.faz2DurationMs)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatSure(r.faz3DurationMs)}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatSure(r.totalDurationMs)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatCent(r.costUsd)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {format(new Date(r.createdAt), "d MMM HH:mm", { locale: tr })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        Süre, Claude API isteğinin gönderilmesinden yanıtın alınmasına kadar geçen zamandır. Bu tablo devreye girmeden önceki analizlerde süre bilgisi yok (—).
      </p>
    </div>
  );
}
