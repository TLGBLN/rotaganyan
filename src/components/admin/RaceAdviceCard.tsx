import Link from "next/link";
import { ShieldCheck, ShieldAlert, Info, TrendingUp, ArrowRight, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassTypeAdvice } from "@/server/services/admin.service";
import DeleteRaceButton from "@/components/admin/DeleteRaceButton";

// 2026-09-02 kullanıcı talebi ("bu şekilde ayarlar mısın bu kısımları" — bir mockup
// gösterdi): admin/kupon'daki yoğun koşu tablosu satırının YERİNE, her koşu için bu kart
// gösteriliyor. Aynı veri (advice/effectivePred/race) — yalnız düz tablo yerine görsel
// bir kart: başlık+rozet, büyük öneri cümlesi, tek renkli ilerleme çubuğu (Ekonomik payı),
// Ekonomik/Normal/Geniş dağılımı, "1. tercih kazanma oranı" ayrı satırda, sağda analiz
// durumu + seçilen atlar + "Analize Git" butonu.

const LEVEL_STYLE: Record<ClassTypeAdvice["level"], { icon: typeof ShieldCheck; badgeCls: string; textCls: string; barCls: string; label: string }> = {
  good: { icon: ShieldCheck, badgeCls: "bg-hit/15 text-hit", textCls: "text-hit", barCls: "bg-hit", label: "Güçlü geçmiş" },
  warn: { icon: ShieldAlert, badgeCls: "bg-miss/15 text-miss", textCls: "text-miss", barCls: "bg-miss", label: "Dikkat" },
  info: { icon: Info, badgeCls: "bg-brand/15 text-brand", textCls: "text-brand", barCls: "bg-brand", label: "Bilgi" },
  none: { icon: Info, badgeCls: "bg-muted text-muted-foreground", textCls: "text-muted-foreground", barCls: "bg-muted-foreground", label: "Veri yok" },
};

export type RaceAdviceCardPick = { rank: number; no: string; score: number | null };
export type RaceAdviceCardPrediction = {
  id: string;
  published: boolean;
  isBanko: boolean;
  bankoOlasilik: string | null;
  topPicks: RaceAdviceCardPick[];
} | null;

export default function RaceAdviceCard({
  hippodromeName,
  raceId,
  raceNo,
  time,
  classType,
  conditions,
  distance,
  atSayisi,
  advice,
  prediction,
  newAnalysisHref,
  hasResult,
}: {
  hippodromeName: string;
  raceId: string;
  raceNo: number;
  time: string | null;
  classType: string;
  conditions: string | null;
  distance: number;
  atSayisi: number;
  advice: ClassTypeAdvice;
  prediction: RaceAdviceCardPrediction;
  newAnalysisHref: string;
  hasResult: boolean;
}) {
  const style = LEVEL_STYLE[advice.level];
  const LevelIcon = style.icon;
  const ekoPct = advice.tierYuzdeler ? Math.round((advice.tierYuzdeler.eko / advice.tierYuzdeler.toplam) * 100) : null;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
              {raceNo}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-bold">
                  {hippodromeName} — {raceNo}. Koşu
                </h3>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", style.badgeCls)}>
                  <LevelIcon className="h-3 w-3" />
                  {style.label}
                </span>
                {hasResult && <span className="shrink-0 text-[11px] font-medium text-hit">✓ Sonuç girildi</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {time ?? "—"} · {classType} · {distance}m · {atSayisi} At
                {conditions && <span className="italic"> · {conditions}</span>}
              </p>
            </div>
          </div>

          {advice.oneri && (
            <div className="mt-3">
              <p className={cn("text-lg font-bold leading-tight", style.textCls)}>{advice.oneri}</p>
              {ekoPct != null && advice.tierYuzdeler && (
                <>
                  <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", style.barCls)} style={{ width: `${ekoPct}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-hit" /> Ekonomik %{Math.round((advice.tierYuzdeler.eko / advice.tierYuzdeler.toplam) * 100)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-brand" /> Normal %{Math.round((advice.tierYuzdeler.nor / advice.tierYuzdeler.toplam) * 100)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Geniş %{Math.round((advice.tierYuzdeler.genis / advice.tierYuzdeler.toplam) * 100)}
                    </span>
                    <span className="text-muted-foreground/70">{advice.tierYuzdeler.toplam} benzer koşuya göre</span>
                  </div>
                </>
              )}
            </div>
          )}

          {advice.top1Rate && advice.top1Rate.total >= 3 && (
            <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                1. tercih kazanma oranı: <b>%{advice.top1Rate.rate.toFixed(0)}</b>
              </span>
              <span className="text-xs text-muted-foreground">
                ({advice.top1Rate.hits}/{advice.top1Rate.total} koşu)
              </span>
            </div>
          )}

          {prediction?.isBanko && (
            <div className="mt-2 text-xs font-semibold leading-tight text-hit">
              ★ BANKO
              {prediction.bankoOlasilik && <span className="font-normal text-muted-foreground"> (model %{prediction.bankoOlasilik} diyor, garanti değil)</span>}
              {" "}— tek at yeterli, bütçeyi diğer ayaklara kaydırın
              {/* 2026-08-31 — Opus denetimi: "Güçlü geçmiş" rozeti Ekonomik (ilk-3) payına
                  bakıyor, BANKO ise top-1 gerektiriyor — ayrı bir soru. Bu koşu tipinde
                  favori GERÇEKTE ne sıklıkla kazanmış, doğrudan burada gösteriliyor ki
                  yeşil rozet yanıltmasın. */}
              {advice.top1Rate && advice.top1Rate.total >= 5 && (
                <span className="block font-normal text-muted-foreground">
                  Bu sınıfta favori tarihte %{advice.top1Rate.rate.toFixed(0)} kazanmış ({advice.top1Rate.hits}/{advice.top1Rate.total})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {prediction ? (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", prediction.published ? "text-hit" : "text-brand")}>
              {prediction.published && <Radio className="h-3 w-3 animate-pulse" />}
              Analiz {prediction.published ? "Yayında" : "Taslak"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Analiz yok</span>
          )}

          {prediction && prediction.topPicks.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {prediction.topPicks.map((p) => (
                <span key={p.rank} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                  {p.no}
                  {p.score != null && <span className="text-muted-foreground"> (%{p.score})</span>}
                </span>
              ))}
            </div>
          )}

          <Link
            href={prediction ? `/admin/analizler/${prediction.id}` : newAnalysisHref}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {prediction ? "Analize Git" : "Analiz Ekle"}
            <ArrowRight className="h-3 w-3" />
          </Link>

          <DeleteRaceButton raceId={raceId} label={`${hippodromeName} ${raceNo}. Koşu`} />
        </div>
      </div>
    </div>
  );
}
