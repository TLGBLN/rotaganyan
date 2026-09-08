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
  // 2026-09-08 kullanıcı bulgusu ("1. sıradaki atı nasıl bulucaz, tek bırakmalı mıyım
  // anlayamıyorum") — v5BankoAdayiTespit HER koşuda (banko olsun olmasın) "neden banko/
  // neden değil" gerekçesini zaten hesaplayıp bankoNote'a yazıyor, ama ekran bunu yalnız
  // isBanko=true iken gösteriyordu — "hayır" cevabı hiç görünmüyordu. Artık ham metin her
  // zaman geçiyor, aşağıda HER durumda gösteriliyor.
  bankoNote: string | null;
  topPicks: RaceAdviceCardPick[];
  // 2026-09-07 kullanıcı bulgusu ("v5 dönemi dimi? geçmiş veriler olmamalı") — eski
  // motorların (V1-V22/V2/V3/V4) Pick.score'u gerçek bir kalibre olasılık DEĞİL, bu
  // oturumda bulunan model-sağlık bug'ıyla AYNI desen. modelTabanliKapsamOnerisi yalnız
  // bu true İSE çağrılır (bkz. çağıran taraf, kupon/page.tsx — GUNCEL_MOTOR_BASLANGIC).
  guncelMotor: boolean;
} | null;

// 2026-09-07 kullanıcı talebi ("ben nokta atışı 3 at yeter ya da gerçekten 6 at yeter
// demesini istiyorum, spesifik") — `advice.oneri` (ClassTypeAdvice) bu koşunun TİPİNE
// (Şartlı/Handikap × mesafe × at sayısı) ait TARİHSEL bir ortalama, bu KOŞUYA özel değil.
// V5 motorunun her at için verdiği skor (pick.score) zaten kalibre edilmiş bir kazanma
// olasılığı (%) — bu koşunun kendi yayınlanmış olasılıklarının TOPLAMI, "ilk N at
// kazananı ne kadar kapsıyor" sorusuna bu SPESİFİK koşu için doğrudan, istatistiksel
// küçük-örneklem riski taşımayan bir cevap verir (tarihsel frekans değil, modelin kendi
// kalibre edilmiş tahmini). Eşikler (65/80) mevcut tierSeviyeKodu ile AYNI — aynı soruyu
// (yeterli kapsama nedir) iki farklı kanıt türüyle (tarihsel vs bu-koşuya-özel) ölçüyor.
function modelTabanliKapsamOnerisi(topPicks: RaceAdviceCardPick[]): { top3: number; top6: number; text: string } | null {
  const scores = [...topPicks]
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.score)
    .filter((s): s is number => s != null);
  if (scores.length < 3) return null;
  const top3 = scores.slice(0, 3).reduce((a, b) => a + b, 0);
  const top6 = scores.slice(0, 6).reduce((a, b) => a + b, 0);
  let text: string;
  if (top3 >= 65) text = `3 at yeter — bu koşuda modelin kendi olasılığına göre %${Math.round(top3)} kapsama`;
  else if (top6 >= 80) text = `6 at yeter — bu koşuda %${Math.round(top6)} kapsama`;
  else text = `6'dan fazla gerekebilir — ilk 6 bu koşuda yalnız %${Math.round(top6)} kapsıyor`;
  return { top3, top6, text };
}

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
  const kapsamOnerisi = prediction?.guncelMotor ? modelTabanliKapsamOnerisi(prediction.topPicks) : null;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
              {raceNo}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-sm font-bold">
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

          {kapsamOnerisi && (
            <div className="mt-2">
              <p className={cn("text-sm font-bold leading-tight", style.textCls)}>{kapsamOnerisi.text}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Bu koşuya özel — modelin BU ATLAR için yayınlanmış olasılıklarının toplamı (ilk 3: %{Math.round(kapsamOnerisi.top3)}, ilk 6: %{Math.round(kapsamOnerisi.top6)}), tarihsel bir ortalama değil.
              </p>
            </div>
          )}

          {advice.oneri && (
            <div className={kapsamOnerisi ? "mt-2 border-t pt-2" : "mt-2"}>
              {kapsamOnerisi ? (
                <p className="text-[11px] text-muted-foreground">
                  Karşılaştırma — bu koşu <b>tipinin</b> tarihte gerektirdiği: <span className={style.textCls}>{advice.oneri}</span>
                </p>
              ) : (
                <p className={cn("text-sm font-bold leading-tight", style.textCls)}>{advice.oneri}</p>
              )}
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

          {/* 2026-09-08 kullanıcı bulgusu ("1. sıradaki atı nasıl bulucaz, tek bırakmalı
              mıyım anlayamıyorum, sistemim bana ne diyor anlayamıyorum") — bu blok eskiden
              YALNIZ isBanko=true iken görünüyordu; "hayır, tek at değil" cevabı hiçbir
              zaman gösterilmiyordu, admin sessizlikle karşılaşıp kararsız kalıyordu.
              v5BankoAdayiTespit HER koşu için (evet/hayır fark etmeksizin) net bir gerekçe
              (bankoNote) zaten üretiyor — artık HER ZAMAN gösteriliyor, yeşil (evet) ya da
              nötr (hayır) çerçeveyle. */}
          {prediction?.bankoNote && (
            <div
              className={cn(
                "mt-2 rounded-md border px-2.5 py-2 text-xs leading-snug",
                prediction.isBanko ? "border-hit/40 bg-hit/5" : "border-muted-foreground/25 bg-muted/20"
              )}
            >
              <div className={cn("font-semibold", prediction.isBanko ? "text-hit" : "text-muted-foreground")}>
                {prediction.isBanko ? "★ Tek at yeterli (Banko) — garanti değil" : "Tek at YETERLİ DEĞİL"}
              </div>
              <p className="mt-0.5 text-muted-foreground">{prediction.bankoNote}</p>
              {/* 2026-08-31 — Opus denetimi: "Güçlü geçmiş" rozeti Ekonomik (ilk-3) payına
                  bakıyor, BANKO ise top-1 gerektiriyor — ayrı bir soru. Bu koşu tipinde
                  favori GERÇEKTE ne sıklıkla kazanmış, doğrudan burada gösteriliyor ki
                  yeşil rozet yanıltmasın. */}
              {prediction.isBanko && advice.top1Rate && advice.top1Rate.total >= 5 && (
                <span className="mt-1 block text-muted-foreground">
                  Bu sınıfta favori tarihte %{advice.top1Rate.rate.toFixed(0)} kazanmış ({advice.top1Rate.hits}/{advice.top1Rate.total})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {prediction ? (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", prediction.published ? "text-[#006D05]" : "text-brand")}>
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
