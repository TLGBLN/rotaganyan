"use client";

import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";
import { finishPos } from "@/lib/race-result";
import { kararOku, puanYuzdesiMetni, piyasaFarkiPuani } from "@/lib/methodology/muhakeme-format";
import { ekuriRengi } from "@/lib/ekuri-colors";
import { siraliPickSatirlari } from "@/lib/methodology/pick-display-order";

type Race = ProgramRaceDay["races"][number];
type Pick = NonNullable<Race["prediction"]>["picks"][number];

// 2026-09-14 — Rotaganyan Sıralama Tablosu "karar katmanı": PuanTablosu.tsx'in çoklu-koşu
// yan-yana tablo yapısını KOPYALAMAZ (bu bileşen TEK koşu, tam genişlik satırlar gösterir —
// mockup'taki gibi), ama eküri-birleştirme/sıralama/puan-metni mantığı AYNI paylaşılan
// yardımcılardan gelir (siraliPickSatirlari, puanYuzdesiMetni, kararOku, ekuriRengi,
// finishPos) — PuanTablosu.tsx'teki buildPickRows ile birebir aynı birleştirme kuralı.
function buildRows(picks: Pick[]): Pick[][] {
  const renderedNos = new Set<number>();
  const rows: Pick[][] = [];
  for (const p of picks) {
    const no = p.runner?.no;
    if (no != null && renderedNos.has(no)) continue;
    const grp = p.runner?.ekuriGroup;
    const partner = grp != null
      ? picks.find((q) => q !== p && q.runner?.no != null && !renderedNos.has(q.runner.no) && q.runner?.ekuriGroup === grp)
      : undefined;
    if (no != null) renderedNos.add(no);
    if (partner?.runner?.no != null) {
      renderedNos.add(partner.runner.no);
      rows.push([p, partner]);
    } else {
      rows.push([p]);
    }
  }
  return siraliPickSatirlari(rows);
}

function rankColor(rank: number): string {
  if (rank <= 3) return "text-hit";
  if (rank <= 6) return "text-brand";
  return "text-muted-foreground";
}

export default function SiralamaListesi({ race, agfByNo }: { race: Race; agfByNo: Map<number, number | null> }) {
  const picks = race.prediction?.picks ?? [];
  if (picks.length === 0) return null;
  const rows = buildRows(picks);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* 2026-09-14 kullanıcı bulgusu: sayfanın kendi H1'i zaten "Rotaganyan Sıralama
          Tablosu" diyor (bkz. page.tsx) — bu kart AYNI başlığı tekrarlıyordu, mobilde
          gereksiz tekrar/yer kaybıydı. Artık yalnız sütun lejantı kalıyor. */}
      <div className="flex items-center justify-end border-b px-4 py-2 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">Model % · AGF % · Fark</span>
        <span className="sm:hidden">Model · Fark</span>
      </div>

      {/* 2026-09-14 kullanıcı bulgusu (mobil): sabit 5 sütun (#/At/Model/AGF/Fark) dar
          ekranda isim sütununu sıkıştırıp satırları çirkin kırıyordu. <640px'te AGF/Fark
          ayrı sütun olmaktan çıkıp at adının altına tek satır özet olarak taşınıyor —
          640px+'ta eski 5 sütunlu tablo aynen kalıyor. */}
      <div className="hidden sm:grid grid-cols-[28px_1fr_64px_64px_70px] gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>#</span>
        <span>At</span>
        <span className="text-center">Model</span>
        <span className="text-center">AGF</span>
        <span className="text-center">Fark</span>
      </div>

      <div className="divide-y">
        {rows.map((rowPicks, rowIdx) => {
          // 2026-09-14 kullanıcı talebi: 1. sıradaki at zaten üstteki karar-hero'sunda
          // büyük yazılı gösteriliyor — burada TEKRAR yazılmasın, liste 2.'den başlasın.
          // rowIdx hâlâ TAM listedeki konumu taşıdığı için displayRank (2,3,4,...)
          // yeniden numaralandırılmadan doğru kalır.
          if (rowIdx === 0) return null;
          const displayRank = rowIdx + 1;
          const primary = rowPicks[0];
          const modelMetin = puanYuzdesiMetni(primary.score, primary.scoreExact);
          const modelSayi = primary.scoreExact ?? primary.score;
          const agf = primary.runner?.no != null ? agfByNo.get(primary.runner.no) ?? null : null;
          const fark = modelSayi != null ? piyasaFarkiPuani(modelSayi, agf) : null;
          const isWinner = rowPicks.some(
            (p) => p.runner?.no != null && (race.result?.winnerNos ?? []).includes(p.runner.no)
          );
          const textColor = isWinner ? "text-winner" : rankColor(displayRank);

          const farkMetin = fark != null ? `${fark >= 0 ? "+" : ""}${fark.toFixed(1)}` : "—";
          const farkRenk = fark == null ? "text-muted-foreground" : fark >= 0 ? "text-hit" : "text-miss";

          return (
            <div
              key={rowIdx}
              className={cn(
                "grid grid-cols-[24px_1fr_50px] items-center gap-2 px-4 py-2.5 sm:grid-cols-[28px_1fr_64px_64px_70px]",
                displayRank === 1 && "bg-brand/10"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  displayRank === 1 ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {displayRank}
              </span>

              <div className="min-w-0">
                <div className={cn("flex items-center gap-1.5 truncate text-sm font-semibold", textColor)}>
                  {rowPicks.map((pick, pi) => (
                    <span key={pick.runner?.no ?? pi} className="flex items-center gap-1 min-w-0">
                      {pi > 0 && <span className="text-muted-foreground">/</span>}
                      <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[10px] font-bold">
                        {pick.runner?.no ?? "—"}
                      </span>
                      <span className={cn("truncate", pick.runner?.scratched && "line-through opacity-50")}>
                        {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel ?? "—"}
                      </span>
                      {rowPicks.length === 1 && !pick.runner?.scratched && pick.runner?.ekuriGroup != null && (
                        <span title={`Eküri grubu ${pick.runner.ekuriGroup}`} className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", ekuriRengi(pick.runner.ekuriGroup).badge)} />
                      )}
                      {pick.runner?.scratched && <span className="shrink-0 text-[10px] font-semibold text-red-400">Koşmaz</span>}
                      {(() => {
                        const pos = finishPos(race.result?.actualOrder, pick.runner?.no, race.result?.winnerNos);
                        return pos != null ? (
                          <span className={cn("shrink-0 text-[10px] font-semibold", pos === 1 ? "text-winner" : "text-muted-foreground")}>
                            ({pos}.)
                          </span>
                        ) : null;
                      })()}
                    </span>
                  ))}
                </div>
                {/* <640px: AGF/Fark ayrı sütun değil, isim altında tek satır özet — bkz.
                    yukarıdaki sütun-lejantı yorumu. */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
                  {agf != null && <span>AGF %{agf.toFixed(1)}</span>}
                  <span className={cn("font-semibold", farkRenk)}>{farkMetin !== "—" ? `Fark ${farkMetin}` : null}</span>
                </div>
                {kararOku(primary.details) && (
                  <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{kararOku(primary.details)}</div>
                )}
              </div>

              <span className="text-center text-sm font-bold tabular-nums">
                {modelMetin != null ? `%${modelMetin}` : "—"}
              </span>
              <span className="hidden text-center text-sm tabular-nums text-muted-foreground sm:inline">
                {agf != null ? `%${agf.toFixed(1)}` : "—"}
              </span>
              <span className={cn("hidden text-center text-sm font-semibold tabular-nums sm:inline", farkRenk)}>
                {farkMetin}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
