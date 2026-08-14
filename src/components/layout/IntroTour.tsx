"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { markIntroSeen } from "@/server/actions/intro.actions";

type Step = { selector: string; title: string; text: string };

const STEPS: Step[] = [
  { selector: '[data-tour="program"]', title: "Yarış Programı", text: "Günün tüm koşuları, at kadroları ve Rotaganyan'ın analiz sonuçları burada toplanır — hipodrom ve tarih seçerek istediğiniz güne, istediğiniz koşuya anında ulaşırsınız." },
  { selector: '[data-tour="puantablosu"]', title: "Rotaganyan Puan Tablosu", text: "Her koşudaki atlar, analiz puanına göre sıralanmış ve Ekonomik / Normal / Geniş kupon dilimleriyle etiketlenmiş halde tek tabloda karşınıza çıkar — hangi ata ne ölçüde güvenildiğini bir bakışta görürsünüz." },
  { selector: '[data-tour="altili"]', title: "Altılı Ne Verir?", text: "Rotaganyan'ın önerilerinden yola çıkarak ayak ayak kendi atlarınızı seçin, olası kombinasyonları ve kaç kupon çıkacağını burada anında hesaplayın." },
  { selector: '[data-tour="banko"]', title: "Banko Önerileri", text: "Analiz motorunun en yüksek güvenle işaretlediği banko atları, kısa gerekçeleriyle birlikte tek sayfada burada toplanır." },
  { selector: '[data-tour="bildirim"]', title: "Bildirimler", text: "Takip listenizdeki bir at yarışa çıktığında, sonuç alındığında veya önemli bir gelişme (jokey/takı değişikliği gibi) olduğunda haber buradan gelir." },
  { selector: '[data-tour="hesap"]', title: "Hesabım", text: "Kişisel panelinize, takip ettiğiniz atlara, geçmiş tahmin performansına ve üyelik ayarlarınıza buradan ulaşırsınız." },
  { selector: '[data-tour="at-detay"]', title: "At Detayı", text: "Bir atın ismine tıklayınca kariyerinin tamamı açılır: geçmiş yarışları, aldığı dereceler, soy ağacı ve sahiplik bilgileri — hepsi tek ekranda." },
  { selector: '[data-tour="yaris-stili"]', title: "Yarış Stili", text: "At isminin altındaki Kaçak, Öncü, Presçi, Takipçi veya Bekleyen rozeti, GPS verisiyle ÖLÇÜLMÜŞ gerçek yarış davranışını gösterir — tahmin değil, ölçüm. (i) simgesine dokunarak stillerin ne anlama geldiğini öğrenebilirsiniz." },
  { selector: '[data-tour="pist-mesafe-ipucu"]', title: "Pist/Mesafe İpucu", text: "Bu düğme, aynı hipodrom + pist + mesafe kombinasyonunda geçmişte hangi yarış stilinin (kaçak, geriden gelen vb.) daha sık kazandığını gösterir — sahadaki atlar bu etikete uymasa bile yarışın nasıl gelişebileceğine dair bir ipucudur. Yalnız Rotaganyan'da var." },
  { selector: '[data-tour="jokey"]', title: "Jokey", text: "Jokey adının altında o sezonki biniş sayısı ve kazanma yüzdesi görünür — deneyimli ve formda bir jokey, eşit güçteki atlar arasında farkı yaratabilir." },
  { selector: '[data-tour="antrenor"]', title: "Sahip / Antrenör", text: "Antrenörün bu sezonki güncel kazanma oranını burada görürsünüz — form döneminde olan bir ekip, beklenmedik sonuçların erken habercisi olabilir." },
  { selector: '[data-tour="galop"]', title: "Galop", text: "Atın son idman derecelerini ve kondisyon zincirini gösterir. Kırmızı ünlem (!) işareti, o idmanı yaptıran jokeyin yarışta da bineceği anlamına gelir — süreklilik/uyum açısından olumlu bir sinyaldir." },
  { selector: '[data-tour="analiz-buton"]', title: "Analizi Gör", text: "Rotaganyan'ın yapay zekâ destekli analizini — nihai sıralama, kısa gerekçeler ve Ekonomik/Normal/Geniş kupon önerileriyle birlikte — buradan açabilirsiniz." },
  { selector: '[data-tour="son800-buton"]', title: "Accurace", text: "Atların geçmiş yarışlardaki tüm Accurace (GPS/sektörel zamanlama) kayıtlarını — son 800 metredeki gerçek kapanış derecesi dahil — burada tek tek inceleyebilirsiniz." },
  { selector: '[data-tour="agf-trend"]', title: "AGF Trend", text: "Bir atın AGF'sinin gün içinde nasıl değiştiğini — yükseliyor mu, düşüyor mu — burada görürsünüz. Piyasanın ilgisi bir ata aniden kaymaya başlıyorsa, bu erken ve değerli bir sinyal olabilir." },
  { selector: '[data-tour="pedigriler-panel"]', title: "Pedigriler", text: "Atın anne, baba ve anne-baba hattının bu pist ve mesafedeki geçmiş yavru performansını burada bulursunuz — özellikle az startlı genç atlarda soydan gelen yatkınlık önemli bir ipucudur." },
  { selector: '[data-tour="h2h-panel"]', title: "H2H — Geçmiş Karşılaşmalar", text: "Bu koşudaki atların birbirleriyle daha önce aynı yarışta karşılaştığı durumları ve sonuçlarını burada görürsünüz — aynı rakiplere karşı geçmişte kim önde bitirmiş?" },
  { selector: '[data-tour="karsilastir"]', title: "Karşılaştır", text: "Sahadaki atları, aynı pist ve mesafede bu yıl aldıkları sonuçlara göre yan yana kıyaslayabileceğiniz bir tablo burada açılır." },
  { selector: '[data-tour="son-yaris-panel"]', title: "Son Yarış Detayları", text: "Her atın bir önceki yarışındaki kilosunu, takısını, jokeyini ve derecesini — bugünküyle karşılaştırmalı olarak — burada görürsünüz." },
  { selector: '[data-tour="hipodrom-ozellikleri"]', title: "Hipodrom Özellikleri", text: "Kulvarların start noktasına, viraja ve düzlüğe olan konumu gibi hipodroma özgü geometrik bilgileri burada inceleyebilirsiniz — iç/dış kulvar avantajını değerlendirmek için kullanışlıdır." },
  { selector: '[data-tour="start-sorunu"]', title: "Start Sorunu", text: "TJK'nın kendi resmi \"Geç Çıkış\" tespitine dayanır — bir at geçmişte tekrar tekrar (2 veya daha fazla) geç kalktıysa burada \"Evet\" yazar. Bu tahmin değil, TJK'nın yarış sonrası kendi kaydettiği bir veridir." },
  { selector: '[data-tour="altili-sonuclari"]', title: "Altılı Ganyan Sonuçları", text: "Geçmiş altılı ganyan sonuçlarını, dağıtılan toplam tutarları ve kazanan kombinasyonları hipodrom bazında burada bulabilirsiniz." },
  { selector: '[data-tour="isabet-bankolar"]', title: "İsabet Sağlayan Bankolar", text: "Rotaganyan'ın geçmişte verdiği banko önerilerinin gerçek isabet kaydını — hiçbirini gizlemeden, tamamını — burada şeffafça görebilirsiniz." },
  { selector: '[data-tour="isabet-kuponlar"]', title: "İsabet Sağlayan Kuponlar", text: "Ekonomik, Normal ve Geniş kuponlarımızın gerçekten tutmuş örneklerini, dağıttıkları tutarlarla birlikte burada inceleyebilirsiniz." },
];

function isVisible(el: Element | null): el is HTMLElement {
  return !!el && el instanceof HTMLElement && el.offsetParent !== null;
}

export default function IntroTour() {
  const [visibleSteps, setVisibleSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [closing, setClosing] = useState(false);

  // v2026-07-31 — kullanıcı bulgusu: "tanıtım yukarıdakilerden sonra bitiyor, bazı
  // kısımlara girmiyor". Sayfanın bazı bölümleri (Suspense ile akan alt kısımlar, veya
  // yavaş/ağır bir sayfada geç hydrate olan client bileşenler — ör. veri panelleri
  // araç çubuğu) tur ilk açıldığında henüz DOM'da olmayabilir. Sabit birkaç saniyelik
  // bir deneme penceresi yavaş sayfalarda yetersiz kalıyordu — bu yüzden artık SÜRE
  // SINIRI YOK: tur açık kaldığı sürece (kullanıcı bitirene/geçene kadar) arka planda
  // periyodik tarama devam eder, geç gelen her bölüm tur bitmeden mutlaka yakalanır.
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const scan = () => {
      const found = STEPS.filter((s) => isVisible(document.querySelector(s.selector)));
      setVisibleSteps((prev) => (found.length > (prev?.length ?? 0) ? found : prev ?? found));
      if (found.length >= STEPS.length && scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
    scan();
    scanTimerRef.current = setInterval(scan, 500);
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, []);

  const updateRect = useCallback(() => {
    if (!visibleSteps || !visibleSteps[index]) return;
    const el = document.querySelector(visibleSteps[index].selector);
    setRect(isVisible(el) ? el.getBoundingClientRect() : null);
  }, [visibleSteps, index]);

  // Adım değişince hedef ekran dışındaysa yumuşakça ortaya kaydır — sonrasında zaten
  // aktif scroll dinleyicisi spotlight'ı kayma sırasında canlı güncelliyor (animasyonlu his).
  useEffect(() => {
    if (!visibleSteps || !visibleSteps[index]) return;
    const el = document.querySelector(visibleSteps[index].selector);
    if (isVisible(el)) {
      const r = el.getBoundingClientRect();
      const fitsViewport = r.top >= 72 && r.bottom <= window.innerHeight - 24;
      if (!fitsViewport) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    updateRect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, visibleSteps]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  const isLast = !!visibleSteps && index === visibleSteps.length - 1;

  const finish = useCallback(() => {
    // Arka plan taramasını hemen durdur — aksi halde tur kapandıktan SONRA yeni bir
    // bölüm bulunursa setVisibleSteps(null) etkisiz kalır, tur istenmeden yeniden açılır.
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setClosing(true);
    setTimeout(() => {
      setVisibleSteps(null);
      markIntroSeen().catch(() => {});
    }, 150);
  }, []);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }, [isLast, finish]);

  useEffect(() => {
    if (!visibleSteps || visibleSteps.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleSteps, finish, next]);

  if (!visibleSteps || visibleSteps.length === 0 || !rect) return null;

  const step = visibleSteps[index];
  const pad = 6;
  const spot = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const spaceBelow = window.innerHeight - (spot.top + spot.height);
  const showBelow = spaceBelow > 160;
  const tooltipTop = showBelow ? spot.top + spot.height + 14 : Math.max(12, spot.top - 12);
  const tooltipLeft = Math.min(Math.max(12, spot.left), window.innerWidth - 300);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] animate-in fade-in duration-300",
        closing && "animate-out fade-out duration-150"
      )}
    >
      {/* Karartma + spotlight (box-shadow ile kesilmiş görünüm), yumuşak geçişli */}
      <div
        className="absolute rounded-lg ease-out motion-safe:transition-all motion-safe:duration-500"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 9999px rgba(8,8,12,0.72), 0 0 0 1px rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      />
      {/* Spotlight kenarında hafif nabız halkası — hareket azaltma tercihinde kapalı */}
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-brand/70 motion-safe:animate-pulse motion-safe:transition-all motion-safe:duration-500"
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
      />

      {/* Tıklamayı engelleyen tam ekran katman (spotlight alanı hariç) */}
      <div className="absolute inset-0" onClick={finish} />

      {/* Tooltip kartı */}
      <div
        key={index}
        className="absolute w-[290px] animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-safe:transition-[top,left] motion-safe:duration-500"
        style={{ top: tooltipTop, left: tooltipLeft, transform: showBelow ? undefined : "translateY(-100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl border bg-background/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1">
              {visibleSteps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === index ? "w-4 bg-brand" : "w-1.5 bg-muted-foreground/25"
                  )}
                />
              ))}
            </div>
            <button
              onClick={finish}
              aria-label="Turu kapat"
              className="rounded-full p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-1 text-sm font-bold">{step.title}</div>
          <p className="mb-3.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>

          <div className="flex items-center justify-between">
            <button onClick={finish} className="text-[11px] text-muted-foreground hover:underline">
              Geç
            </button>
            <div className="flex items-center gap-1.5">
              {index > 0 && (
                <button
                  onClick={() => setIndex((i) => i - 1)}
                  aria-label="Geri"
                  className="flex h-6 w-6 items-center justify-center rounded-md border hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-0.5 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground hover:bg-brand/90"
              >
                {isLast ? "Bitir" : "İleri"}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
