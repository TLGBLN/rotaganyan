import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export const dynamic = "force-dynamic";

async function getResultsWithPicks(limit = 100) {
  return db.result.findMany({
    where: { race: { prediction: { published: true } } },
    include: {
      race: {
        include: {
          raceDay: { include: { hippodrome: true } },
          prediction: {
            include: {
              picks: {
                include: { runner: { select: { no: true } } },
                orderBy: { rank: "asc" },
              },
            },
          },
        },
      },
    },
    orderBy: { enteredAt: "desc" },
    take: limit,
  });
}

type Tier = "rank1" | "rank2_3" | "rank4_6" | "miss";
type Result = Awaited<ReturnType<typeof getResultsWithPicks>>[number];

function getTier(r: Result): Tier {
  if (r.hitTop1) return "rank1";
  if (r.hitInCoupon) return "rank2_3";
  const winnerNo = r.winnerNo;
  if (winnerNo != null) {
    const picks = r.race.prediction?.picks ?? [];
    const pick = picks.find((p) => p.runner?.no === winnerNo);
    if (pick && pick.rank >= 4 && pick.rank <= 6) return "rank4_6";
  }
  return "miss";
}

const TIER = {
  rank1: { label: "1. Sıra", className: "bg-[#27ae60]/15 text-[#27ae60] border border-[#27ae60]/30" },
  rank2_3: { label: "2-3. Sıra", className: "bg-[#2980b9]/15 text-[#2980b9] border border-[#2980b9]/30" },
  rank4_6: { label: "4-6. Sıra", className: "bg-brand/15 text-brand border border-brand/30" },
  miss: { label: "Listede Yok", className: "bg-[#c0392b]/15 text-[#c0392b] border border-[#c0392b]/30" },
};

export default async function SonuclarPage() {
  const results = await getResultsWithPicks();

  const tiers = results.map(getTier);
  const total = results.length;
  const counts = {
    rank1: tiers.filter((t) => t === "rank1").length,
    rank2_3: tiers.filter((t) => t === "rank2_3").length,
    rank4_6: tiers.filter((t) => t === "rank4_6").length,
    miss: tiers.filter((t) => t === "miss").length,
  };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const ganyanHits = results.filter((r, i) => tiers[i] === "rank1" && r.ganyan != null);
  const avgGanyan =
    ganyanHits.length > 0
      ? (ganyanHits.reduce((s, r) => s + r.ganyan!, 0) / ganyanHits.length).toFixed(2)
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Sonuç Analizi</h1>

      {/* Özet istatistikler */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["rank1", "rank2_3", "rank4_6", "miss"] as Tier[]).map((tier) => (
          <div key={tier} className="rounded-lg border p-4 space-y-1">
            <div className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TIER[tier].className}`}>
              {TIER[tier].label}
            </div>
            <div className="text-2xl font-bold">{counts[tier]}</div>
            <div className="text-xs text-muted-foreground">%{pct(counts[tier])} · {counts[tier]}/{total}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Toplam: <strong className="text-foreground">{total}</strong> analiz edilmiş koşu
        </span>
        {avgGanyan && (
          <span>
            Ort. ganyan (1. sıra isabetle): <strong className="text-foreground">{avgGanyan}</strong>
          </span>
        )}
        <span>
          Kuponda isabet (1-3. sıra):{" "}
          <strong className="text-foreground">
            {counts.rank1 + counts.rank2_3} (%{pct(counts.rank1 + counts.rank2_3)})
          </strong>
        </span>
      </div>

      {/* Sonuç tablosu */}
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Henüz sonuç girilmemiş.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Koşu</th>
                <th className="px-3 py-2 text-left">Kazanan</th>
                <th className="px-3 py-2 text-left">Sıra</th>
                <th className="px-3 py-2 text-left">Ganyan</th>
                <th className="px-3 py-2 text-left">Değerlendirme</th>
                <th className="px-3 py-2 text-left">Hata</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const tier = tiers[i];
                const picks = r.race.prediction?.picks ?? [];
                const winnerPick = picks.find((p) => p.runner?.no === r.winnerNo);
                const topScoredPick = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                const topScoredIsWinner = topScoredPick?.runner?.no === r.winnerNo;

                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {format(r.race.raceDay.date, "d MMM yy", { locale: tr })}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-medium">{r.race.raceDay.hippodrome.name}</span>
                      <span className="text-muted-foreground"> · {r.race.raceNo}. Koşu</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.winnerNo != null ? (
                        <span className="font-mono text-xs">
                          #{r.winnerNo}
                          {r.cikan ? <span className="ml-1 font-sans text-muted-foreground">{r.cikan}</span> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {winnerPick != null ? (
                        <span className="font-semibold">{winnerPick.rank}. sıra</span>
                      ) : r.winnerNo != null ? (
                        <span className="text-muted-foreground text-xs">listede yok</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.ganyan != null ? (
                        <span className={r.ganyan < 5 ? "text-foreground" : r.ganyan < 15 ? "text-brand" : "text-[#c0392b]"}>
                          {r.ganyan.toFixed(2)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIER[tier].className}`}>
                          {TIER[tier].label}
                        </span>
                        {topScoredIsWinner && (
                          <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 border border-yellow-500/30">
                            En yüksek puan kazandı
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.errorTag ? (
                        <span className="text-[#c0392b]">{r.errorTag}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
