import Link from "next/link";
import { ShieldCheck, ShieldAlert, Info, TrendingUp, ArrowRight, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { classTypeGroup, type ClassTypeAdvice } from "@/server/services/admin.service";
import DeleteRaceButton from "@/components/admin/DeleteRaceButton";
import { KAPSAM_ESIK_ILK3, KAPSAM_ESIK_ILK6 } from "@/lib/methodology/kapsam-esikleri";
import { puanYuzdesiMetni } from "@/lib/methodology/muhakeme-format";

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

// 2026-09-16 — Anormal Pist Modu v1 admin rozeti (bkz. anormal-pist-risk.ts). ÇOK_HASSAS
// veya YETERSİZ varsa kırmızı (riskli operasyonel sonuç — banko/kupon kısıtlandı), HASSAS/
// SINIRLI ise amber (yalnız gözlem), yoksa hiç gösterilmiyor.
const PIST_DUYARLILIK_LABEL: Record<string, string> = { STABIL: "Stabil", HASSAS: "Hassas", COK_HASSAS: "Çok Hassas" };
const GECMIS_RISK_LABEL: Record<string, string> = { YETERLI: "Yeterli", SINIRLI: "Sınırlı", YETERSIZ: "Yetersiz" };

export type RaceAdviceCardPick = { rank: number; no: string; score: number | null; scoreExact?: number | null };
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
  // 2026-09-16 — Anormal Pist Modu v1 (bkz. anormal-pist-risk.ts). Admin bu 4 alanla
  // KATSAYI/z-score/senaryo detayını değil, yalnız NİHAİ sınıflandırmayı görür — asıl
  // ham senaryo verisi V5AnalysisPanel'in kendi (daha ayrıntılı) rozetinde.
  pistAnormalMi: boolean;
  pistDuyarliligi: string | null;
  gecmisRiskSeviyesi: string | null;
  pistUyariMesaji: string | null;
  // 2026-09-17 — Race Context Invalidation (bkz. race-context-invalidation.ts). "STALE"
  // ise bu analiz YAYINLANMIŞ görünse bile artık GEÇERSİZ bir yarış bağlamı için üretilmiş
  // demektir (pist/mesafe/sınıf/at listesi değişti) — canlıda zaten gösterilmiyor (bkz.
  // pick-display-order.ts analizCanliMi), ama admin bunu BURADA görüp yeniden analiz etmeli.
  status: string;
  staleReason: string | null;
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
// 2026-09-08 kullanıcı bulgusu ("sitem bana bir işaret göstermeli, sitemi anlayamıyorum")
// — kapsamOnerisi/advice.oneri/isBanko üç ayrı paragrafta duruyordu, admin hepsini okuyup
// zihninde birleştirmek zorunda kalıyordu. Bu fonksiyon üçünü TEK bir büyük, renkli, ikonlu
// rozete indiriyor — kartın en üstünde, hiç metin okumadan tek bakışta "kaç at oynamalıyım"
// sorusunun cevabı. Öncelik sırası: banko (en güvenilir, mekanizması en katı) > bu koşuya
// özel kapsam (score toplamı) > yalnız koşu-tipi tarihsel oranı (analiz henüz yoksa).
function tekAtVerdisi(
  isBanko: boolean,
  kapsamOnerisi: { top3: number; top6: number } | null,
  advice: ClassTypeAdvice
): { label: string; cls: string } | null {
  if (isBanko) return { label: "🎯 TEK AT YETER", cls: "bg-hit text-white" };
  if (kapsamOnerisi) {
    if (kapsamOnerisi.top3 >= KAPSAM_ESIK_ILK3) return { label: "3 AT", cls: "bg-brand text-white" };
    if (kapsamOnerisi.top6 >= KAPSAM_ESIK_ILK6) return { label: "6 AT", cls: "bg-amber-500 text-white" };
    return { label: "GENİŞ OYNA", cls: "bg-red-500 text-white" };
  }
  // Henüz analiz yok (ya da eski motor) — yalnız koşu TİPİNİN tarihsel eğilimi varsa onu
  // göster. 2026-09-08 düzeltmesi: bu artık `advice.tierYuzdeler`den KENDİ eko/ilk6'sını
  // yeniden hesaplamıyor — `tierYuzdeler` yalnız sınıf-tipi dağılımını taşır, ama asıl
  // metin (`advice.oneri`) at-sayısı override'ını da içerebilir (bkz. admin.service.ts —
  // efektifTierSeviye). İkisi ayrı kaynaktan hesaplanınca rozet "6 AT" derken metin "6 ve
  // fazası (%77)" diyebiliyordu — aynı `tierSeviyeKodu` kullanılarak birleştirildi.
  if (advice.tierSeviyeKodu != null) {
    switch (advice.tierSeviyeKodu) {
      case 0: return { label: "3 AT (tarihsel)", cls: "bg-brand/70 text-white" };
      case 1: return { label: "6 AT (tarihsel)", cls: "bg-amber-500/70 text-white" };
      case 2: return { label: "6+ AT (tarihsel)", cls: "bg-orange-600/70 text-white" };
      case 3: return { label: "GENİŞ (tarihsel)", cls: "bg-red-500/70 text-white" };
    }
  }
  return null;
}

// 2026-09-09 kullanıcı talebi ("Kupon Pusulası" rehberine göre kupon sayfası dizayn
// edilmeli) — bir ad-hoc kalibrasyon taraması (V5 dönemi, ~397 yayınlanmış tahmin) Handikap
// koşularında model %40-60 dediğinde GERÇEK kazanma oranının beklenenden düşük çıktığını
// gösterdi (%40-50: gerçek %20.0, %50-60: gerçek %20.0 — komşu %30-40 diliminin (%32.4)
// bile altında). Örneklem ÇOK KÜÇÜK (n=10 ve n=5) — TIER_GUVEN_ESIGI=20'nin altında,
// admin.service.ts'in kendi "küçük örneklemde kesin hüküm verme" ilkesiyle aynı gerekçeyle
// rozet/skor OTOMATİK DEĞİŞTİRİLMİYOR, yalnız bilgilendirici bir ihtiyat notu gösteriliyor.
function handikapOrtaBantUyarisi(classType: string, topPicks: RaceAdviceCardPick[]): boolean {
  if (classTypeGroup(classType) !== "Handikap Koşular") return false;
  return topPicks.some((p) => p.score != null && p.score >= 40 && p.score < 60);
}

// Kupon Pusulası Adım 4 ("eşit saha uyarısı") — ilk 3 at birbirine çok yakın puandaysa
// (ör. %20/%20/%20) rozet "6 AT" dese bile saha gerçekten belirsiz demektir, sürprize açık.
// Zaten banko ise (isBanko=true) bu uyarı anlamsız — çağıran taraf onu filtreliyor.
function esitSahaUyarisi(topPicks: RaceAdviceCardPick[]): boolean {
  const scores = [...topPicks]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .map((p) => p.score)
    .filter((s): s is number => s != null);
  if (scores.length < 3) return false;
  return scores[0] - scores[2] <= 7;
}

function modelTabanliKapsamOnerisi(topPicks: RaceAdviceCardPick[]): { top3: number; top6: number; text: string } | null {
  const scores = [...topPicks]
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.score)
    .filter((s): s is number => s != null);
  if (scores.length < 3) return null;
  const top3 = scores.slice(0, 3).reduce((a, b) => a + b, 0);
  const top6 = scores.slice(0, 6).reduce((a, b) => a + b, 0);
  let text: string;
  if (top3 >= KAPSAM_ESIK_ILK3) text = `3 at yeter — bu koşuda modelin kendi olasılığına göre %${Math.round(top3)} kapsama`;
  else if (top6 >= KAPSAM_ESIK_ILK6) text = `6 at yeter — bu koşuda %${Math.round(top6)} kapsama`;
  else text = `6'dan fazla gerekebilir — ilk 6 bu koşuda yalnız %${Math.round(top6)} kapsıyor`;
  return { top3, top6, text };
}

// Kartta doğrudan gösterilen, EŞİĞİ AÇIKÇA yazan kısa metin — tekAtVerdisi'nin hangi
// koşulu kullandığını (65/80) admin ezbere bilmeden okuyabilsin diye. Mobilde de tek
// satır (gerekirse doğal sarar) — kartın kendi flex-col yapısı taşmayı zaten engelliyor.
function kapsamEsikMetni(k: { top3: number; top6: number }): string {
  const top3 = Math.round(k.top3);
  const top6 = Math.round(k.top6);
  if (k.top3 >= KAPSAM_ESIK_ILK3) return `İlk 3: %${top3} ✓ (eşik ≥%${KAPSAM_ESIK_ILK3})`;
  if (k.top6 >= KAPSAM_ESIK_ILK6) return `İlk 3: %${top3} (eşik ≥%${KAPSAM_ESIK_ILK3}, yetersiz) → İlk 6: %${top6} ✓ (eşik ≥%${KAPSAM_ESIK_ILK6})`;
  return `İlk 6: %${top6} (eşik ≥%${KAPSAM_ESIK_ILK6}, yetersiz)`;
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
  const verdi = tekAtVerdisi(prediction?.isBanko ?? false, kapsamOnerisi, advice);
  const handikapUyari = prediction ? handikapOrtaBantUyarisi(classType, prediction.topPicks) : false;
  const esitSaha = prediction && !prediction.isBanko ? esitSahaUyarisi(prediction.topPicks) : false;

  // Handikap/eşit-saha uyarıları artık tek bir kutuda birleşiyor — iki ayrı kutu, iki ayrı
  // tam cümle yerine kısa madde satırları (2026-09-09 kullanıcı bulgusu: "çok bilgi var
  // kirlilik yapıyor").
  const uyarilar: string[] = [];
  if (handikapUyari) uyarilar.push("⚠️ Handikap %40-60 bandı — geçmişte fazla iddialı çıktı, bir kademe geniş say.");
  if (esitSaha) uyarilar.push("⚖️ Eşit saha — ilk 3 at yakın puanda, net favori yok.");

  return (
    <div className={cn("rounded-xl border p-3", prediction?.status === "STALE" && "border-red-500/50")}>
      {/* 2026-09-17 — Race Context Invalidation (bkz. race-context-invalidation.ts). En
          üstte, her şeyden önce: bu koşunun YAYINLANMIŞ analizi artık GEÇERSİZ bir yarış
          bağlamı için üretilmiş (pist/mesafe/sınıf/at listesi değişti) — public'te zaten
          gösterilmiyor (analizCanliMi), ama admin bunu görüp yeniden analiz etmeden bu
          kartın geri kalanına (banko/kupon önerisi) GÜVENMEMELİ. */}
      {prediction?.status === "STALE" && (
        <div className="mb-2.5 rounded-md border border-red-500/50 bg-red-500/10 px-2.5 py-2 text-xs text-red-600 dark:text-red-400">
          <div className="font-bold">🛑 ANALİZ BAYAT — yarış bağlamı değişti, yeniden analiz gerekli</div>
          {prediction.staleReason && <p className="mt-0.5">{prediction.staleReason}</p>}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
              {raceNo}
            </div>
            {/* 2026-09-08 kullanıcı bulgusu ("sitem bana bir işaret göstermeli") — tek,
                büyük, renkli, ikonlu rozet: aşağıdaki paragrafları hiç okumadan "kaç at
                oynamalıyım" sorusunun cevabı tek bakışta burada. */}
            {verdi && (
              <span className={cn("shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-extrabold shadow-sm", verdi.cls)}>
                {verdi.label}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold">
                {hippodromeName} — {raceNo}. Koşu
              </h3>
              <p className="text-xs text-muted-foreground">
                {time ?? "—"} · {classType} · {distance}m · {atSayisi} At
                {conditions && <span className="italic"> · {conditions}</span>}
              </p>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", style.badgeCls)}>
              <LevelIcon className="h-3 w-3" />
              {style.label}
            </span>
            {hasResult && <span className="shrink-0 text-[11px] font-medium text-hit">✓ Sonuç girildi</span>}
            {prediction && prediction.topPicks.length > 0 &&
              prediction.topPicks.slice(0, 6).map((p) => (
                <span key={p.rank} className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  #{p.no}
                  {puanYuzdesiMetni(p.score, p.scoreExact) != null && ` %${puanYuzdesiMetni(p.score, p.scoreExact)}`}
                </span>
              ))}
          </div>

          {/* Canlı (bu koşuya özel) ve tarihsel (koşu tipine özel) kapsam bilgisi TEK
              satırda — eskiden iki ayrı paragraf + açıklama cümlesiydi. */}
          {(kapsamOnerisi || advice.oneri) && (
            <p className="mt-2 text-xs leading-snug">
              {kapsamOnerisi && (
                <span
                  className={cn("font-semibold", style.textCls)}
                  title="Bu koşuya özel — modelin BU ATLAR için yayınlanmış olasılıklarının toplamı, tarihsel bir ortalama değil."
                >
                  {kapsamEsikMetni(kapsamOnerisi)}
                </span>
              )}
              {kapsamOnerisi && advice.oneri && <span className="text-muted-foreground"> · </span>}
              {advice.oneri && (
                <span className="text-muted-foreground">
                  {kapsamOnerisi && "Tarihsel: "}
                  <span className={kapsamOnerisi ? "" : cn("font-semibold", style.textCls)}>{advice.oneri}</span>
                </span>
              )}
            </p>
          )}

          {/* Ekonomik/Normal/Geniş dağılım çubuğu — yalnız CANLI bir analiz yokken (yani
              tarihsel oran TEK kanıt kaynağıyken) gösteriliyor, aksi halde yukarıdaki tek
              satır zaten yeterli, çubuk gereksiz kalabalık yapardı. */}
          {!kapsamOnerisi && ekoPct != null && advice.tierYuzdeler && (
            <>
              <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", style.barCls)} style={{ width: `${ekoPct}%` }} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>Eko %{Math.round((advice.tierYuzdeler.eko / advice.tierYuzdeler.toplam) * 100)}</span>
                <span>Nor %{Math.round((advice.tierYuzdeler.nor / advice.tierYuzdeler.toplam) * 100)}</span>
                <span>Geniş %{Math.round((advice.tierYuzdeler.genis / advice.tierYuzdeler.toplam) * 100)}</span>
                <span className="text-muted-foreground/70">({advice.tierYuzdeler.toplam} koşu)</span>
              </div>
            </>
          )}

          {uyarilar.length > 0 && (
            <div className="mt-2 space-y-0.5 rounded-md border border-miss/40 bg-miss/5 px-2.5 py-1.5 text-[11px] leading-snug text-miss">
              {uyarilar.map((u) => <div key={u}>{u}</div>)}
            </div>
          )}

          {prediction?.pistAnormalMi && (
            <div
              className={cn(
                "mt-2 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug",
                prediction.pistDuyarliligi === "COK_HASSAS" || prediction.gecmisRiskSeviyesi === "YETERSIZ"
                  ? "border-miss/40 bg-miss/5 text-miss"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
              )}
            >
              <div className="font-semibold">
                ⚠ Anormal Pist — Dayanıklılık: {(prediction.pistDuyarliligi && PIST_DUYARLILIK_LABEL[prediction.pistDuyarliligi]) ?? "—"}
                {prediction.gecmisRiskSeviyesi && ` · Geçmiş Riski: ${GECMIS_RISK_LABEL[prediction.gecmisRiskSeviyesi] ?? prediction.gecmisRiskSeviyesi}`}
              </div>
              <p className="mt-0.5 opacity-90">{prediction.pistUyariMesaji || "Normal davranılıyor — model bu pist koşulundan etkilenmedi, favori adayların geçmiş verisi de yeterli."}</p>
            </div>
          )}

          {advice.top1Rate && advice.top1Rate.total >= 3 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              1. tercih kazanma oranı: <b className="text-foreground">%{advice.top1Rate.rate.toFixed(0)}</b> ({advice.top1Rate.hits}/{advice.top1Rate.total})
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
                "mt-2 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug",
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

        <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
          {prediction ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                prediction.status === "STALE" ? "text-red-600 dark:text-red-400" : prediction.published ? "text-[#006D05]" : "text-brand"
              )}
            >
              {prediction.published && prediction.status !== "STALE" && <Radio className="h-3 w-3 animate-pulse" />}
              {/* 2026-09-17 — Race Context Invalidation: `published` fiziksel olarak hâlâ
                  true kalabilir (geçmiş kaydı bozulmasın diye dokunulmuyor), ama admin'e
                  ASLA "Yayında" görünmemeli — canlıda zaten gösterilmiyor. */}
              Analiz {prediction.status === "STALE" ? "BAYAT (geçersiz)" : prediction.published ? "Yayında" : "Taslak"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Analiz yok</span>
          )}

          <div className="flex items-center gap-2">
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
    </div>
  );
}
