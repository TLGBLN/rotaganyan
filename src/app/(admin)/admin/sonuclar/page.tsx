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

      {/* Sonuç listesi */}
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Henüz sonuç girilmemiş.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {results.map((r, i) => {
            const tier = tiers[i];
            const picks = r.race.prediction?.picks ?? [];
            const winnerPick = picks.find((p) => p.runner?.no === r.winnerNo);
            const topScoredPick = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
            const topScoredIsWinner = topScoredPick?.runner?.no === r.winnerNo;

            return (
              <div key={r.id} className="px-3 py-2.5 hover:bg-muted/20 transition-colors">
                {/* Satır 1: Tarih + Koşu + Değerlendirme */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(r.race.raceDay.date, "d MMM yy", { locale: tr })}
                    </span>
                    <span className="font-medium text-sm whitespace-nowrap">
                      {r.race.raceDay.hippodrome.name}
                      <span className="text-muted-foreground font-normal"> · {r.race.raceNo}. Koşu</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIER[tier].className}`}>
                      {TIER[tier].label}
                    </span>
                    {topScoredIsWinner && (
                      <span className="hidden sm:inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 border border-yellow-500/30">
                        En yüksek puan
                      </span>
                    )}
                  </div>
                </div>
                {/* Satır 2: Kazanan + Sıra + Ganyan */}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {r.winnerNo != null && (
                    <span>
                      Kazanan: <span className="font-mono font-bold text-foreground">#{r.winnerNo}</span>
                      {r.cikan && <span className="ml-1">{r.cikan}</span>}
                    </span>
                  )}
                  {winnerPick != null ? (
                    <span>Sıra: <span className="font-semibold text-foreground">{winnerPick.rank}.</span></span>
                  ) : r.winnerNo != null ? (
                    <span className="text-[#c0392b]">listede yok</span>
                  ) : null}
                  {r.ganyan != null && (
                    <span>
                      Ganyan:{" "}
                      <span className={`font-semibold ${r.ganyan < 5 ? "text-foreground" : r.ganyan < 15 ? "text-brand" : "text-[#c0392b]"}`}>
                        {r.ganyan.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {r.errorTag && <span className="text-[#c0392b]">{r.errorTag}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
