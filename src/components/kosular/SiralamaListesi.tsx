"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";
import { finishPos } from "@/lib/race-result";
import { kararOku, puanYuzdesiMetni } from "@/lib/methodology/muhakeme-format";
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

// 2026-09-14 — "Son 5 Yarış" rozetleri: ProgramView.tsx'teki formBoxClass/formBoxClassByPos
// ile AYNI kaynaktan (TJK pist renkleri, bkz. proje hafızası) — o dosyanın büyüklüğü
// yüzünden (SURFACE_TAB_BG'de olduğu gibi) burada da küçük bir kopya olarak tutuluyor.
// Bu veri TJK'nın kamuya açık geçmiş sonuçları — modelin iç mantığını ifşa etmiyor
// (bkz. feedback_mutfagi_acma_ilkesi), bu yüzden herkese açık gösterilebilir.
function formBoxClassByPos(pos: string): string {
  if (pos === "1") return "bg-[#27ae60] text-white";
  if (pos === "2") return "bg-[#2980b9] text-white";
  if (pos === "3") return "bg-[#f39c12] text-white";
  if (pos === "0") return "bg-[#7f8c8d] text-white";
  const n = parseInt(pos, 10);
  if (n >= 4 && n <= 6) return "bg-[#e74c3c] text-white";
  return "bg-[#922b21] text-white";
}
function formBoxClass(pos: string, surface: string): string {
  if (pos === "K") return "bg-[#7f8c8d] text-white";
  if (surface === "C") return "bg-[#009900] text-white";
  if (surface === "S") return "bg-[#D39B1E] text-white";
  if (surface === "K") return "bg-[#996633] text-white";
  return formBoxClassByPos(pos);
}

export type FormInfo = { recentForm: string | null; recentFormSurfaces: string | null };

// export edildi: karar-hero'su (SiralamaKarti.tsx) da 1. sıradaki at için AYNI
// rozeti kullanıyor — kopyalamak yerine tek kaynak.
export function Son5Yaris({ form, adet }: { form: FormInfo | undefined; adet: number }) {
  const formChars = (form?.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-adet);
  const surfaces = (form?.recentFormSurfaces ?? "").split("");
  if (formChars.length === 0) return null;
  return (
    <div className="flex gap-0.5">
      {formChars.map((c, i) => (
        <span key={i} className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold", formBoxClass(c, surfaces[i]?.trim() ?? ""))}>
          {c}
        </span>
      ))}
    </div>
  );
}

/** FORM sütunu — Son5Yaris'in AYNI verisinden (yeniden veri çekilmedi), tek bakışta
 *  eğilim görmek için küçük bir çubuk grafik: 1.lik en uzun çubuk, geriye gidince kısalır. */
function FormSparkline({ form }: { form: FormInfo | undefined }) {
  const chars = (form?.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-5);
  if (chars.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex h-5 items-end gap-0.5">
      {chars.map((c, i) => {
        const pos = c === "K" ? 9 : parseInt(c, 10);
        const h = c === "K" ? 15 : Math.max(15, 100 - (pos - 1) * 14);
        return <span key={i} className={cn("w-1 rounded-sm", pos === 1 ? "bg-winner" : "bg-brand/60")} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

export default function SiralamaListesi({
  race,
  formByNo,
  agfByNo,
}: {
  race: Race;
  formByNo: Map<number, FormInfo>;
  agfByNo: Map<number, number | null>;
}) {
  const picks = race.prediction?.picks ?? [];
  if (picks.length === 0) return null;
  const rows = buildRows(picks);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* 2026-09-14 kullanıcı bulguları: sayfanın kendi H1'i zaten "Rotaganyan Sıralama
          Tablosu" diyor (bkz. page.tsx) — bu kart AYNI başlığı tekrarlıyordu, kaldırıldı.
          AGF/Fark sütunları da kullanıcı talebiyle kaldırıldı. Ayrıca boş "Model %" lejant
          şeridi de (sm+'ta zaten sütun başlığı var, mobilde gereksiz boşluktu) kaldırıldı. */}

      {/* 2026-09-14 kullanıcı bulgusu: jokey/antrenör ve Son 5 Yarış isim altında ALT
          ALTA duruyordu, geniş masaüstü ekranda çok boş yatay alan bırakıyordu. sm+'ta
          artık kendi sütunları var (yan yana), dar mobilde eskisi gibi isim altında kalır. */}
      <div className="hidden sm:grid grid-cols-[28px_1fr_160px_60px_120px_50px_100px] gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>#</span>
        <span>At</span>
        <span>Jokey / Antrenör</span>
        <span className="text-center">AGF</span>
        <span>Son 5 Koşu</span>
        <span className="text-center">Form</span>
        <span className="text-center">Model</span>
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
          const isWinner = rowPicks.some(
            (p) => p.runner?.no != null && (race.result?.winnerNos ?? []).includes(p.runner.no)
          );
          const textColor = isWinner ? "text-winner" : rankColor(displayRank);

          const jokeyAntrenor = [primary.runner?.jockey, primary.runner?.trainer].filter(Boolean).join(" · ");
          const agf = primary.runner?.no != null ? agfByNo.get(primary.runner.no) : null;
          const modelPct = Math.max(0, Math.min(100, primary.scoreExact ?? primary.score ?? 0));

          return (
            <div
              key={rowIdx}
              className={cn(
                "grid grid-cols-[24px_1fr_50px] items-center gap-2 px-3 py-1.5 sm:grid-cols-[28px_1fr_160px_60px_120px_50px_100px] sm:px-4 sm:py-2.5",
                // 2026-10-19 kullanıcı talebi: "kazanan atlar daha belirginleştirilsin" —
                // sıralama rozeti yerine GERÇEK sonuç (isWinner) satırı vurgular.
                isWinner && "bg-winner/10"
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
                  {/* Gerçek kazanan — kullanıcı talebi: "kazanan atlar daha
                      belirginleştirilsin" (AGF/rakip rozetleri yerine). */}
                  {isWinner && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-winner px-2 py-0.5 text-[10px] font-bold text-background">
                      <Trophy className="h-3 w-3" /> Kazanan
                    </span>
                  )}
                </div>
                {/* Jokey/Antrenör + Son 5 Yarış: sm+'ta kendi sütunlarına taşındığı için
                    burada yalnız mobilde (<640px) isim altında, TEK satırda (yan yana,
                    gerekirse sarılarak) gösteriliyor — iki ayrı satır dar ekranda satırları
                    gereksiz uzatıyordu. TJK'nın kamuya açık ham verisi, bkz.
                    feedback_mutfagi_acma_ilkesi. */}
                {(jokeyAntrenor || formByNo.get(primary.runner?.no ?? -1)?.recentForm) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                    {jokeyAntrenor && <span className="truncate text-[11px] text-muted-foreground">{jokeyAntrenor}</span>}
                    <Son5Yaris form={formByNo.get(primary.runner?.no ?? -1)} adet={5} />
                  </div>
                )}
                {kararOku(primary.details) && (
                  <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{kararOku(primary.details)}</div>
                )}
              </div>

              {/* sm+: Jokey/Antrenör kendi sütununda */}
              <span className="hidden truncate text-xs text-muted-foreground sm:block">{jokeyAntrenor || "—"}</span>
              {/* sm+: AGF kendi sütununda — ham yüzde (TJK'nın kamuya açık verisi,
                  bkz. feedback_mutfagi_acma_ilkesi); SIRA rozeti değil, herkese açık. */}
              <span className="hidden text-center text-xs font-semibold tabular-nums text-muted-foreground sm:block">
                {agf != null ? `%${agf.toFixed(1)}` : "—"}
              </span>
              {/* sm+: Son 5 Koşu kendi sütununda */}
              <span className="hidden sm:block">
                <Son5Yaris form={formByNo.get(primary.runner?.no ?? -1)} adet={5} />
              </span>
              {/* sm+: Form (küçük eğilim çubuğu) kendi sütununda */}
              <span className="hidden justify-center sm:flex">
                <FormSparkline form={formByNo.get(primary.runner?.no ?? -1)} />
              </span>

              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold tabular-nums">
                  {modelMetin != null ? `%${modelMetin}` : "—"}
                </span>
                <div className="hidden h-1 w-full max-w-16 overflow-hidden rounded-full bg-muted sm:block">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${modelPct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
