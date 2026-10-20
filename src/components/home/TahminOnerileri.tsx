"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { KuponOnerisi, KuponStatus } from "@/server/services/race.service";
import type { AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";
import { findIkramiyeForHippodrome } from "@/lib/altili-match";
import { cn } from "@/lib/utils";

type Kupon = NonNullable<KuponOnerisi>;

const STATUS_CLASS: Record<KuponStatus, string> = {
  hit: "bg-hit/15 text-hit",
  miss: "bg-miss/15 text-miss",
  pending: "bg-muted text-muted-foreground",
};

const TAB_CLASS = "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors shrink-0";
const TAB_ACTIVE = "bg-brand text-brand-foreground";
const TAB_INACTIVE = "bg-foreground/5 text-muted-foreground border hover:bg-muted";

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 3h-2a5 5 0 0 0-5 5v3H6v4h2v6h4v-6h2.5l.5-4H12V8a1 1 0 0 1 1-1h2z" />
    </svg>
  );
}

// 2026-09-01 kullanıcı talebi — WhatsApp gibi platformlara TEK bir genel paylaş
// ikonuyla (uçak/gönder simgesi) direkt görsel gönderilebilsin, admin'e özel
// Instagram/X ikonlarının yanına, TÜM kullanıcılara açık.
function ShareLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

// 2026-09-14 — export edildi: Rotaganyan Sıralama Tablosu'nun (SiralamaKarti.tsx)
// sidebar'ındaki Kupon Önerisi widget'ı bu render mantığını AYNEN yeniden kullanıyor
// (tier sekmeleri + ayak ızgarası + tutar) — kopyalama yerine tek kaynak.
export function KuponBlock({ data, ikramiye, isAdmin, cityLabel }: { data: Kupon; ikramiye: string | null; isAdmin: boolean; cityLabel?: string }) {
  const t = useTranslations("home.tahminOnerileri");
  const STATUS_LABEL: Record<KuponStatus, string> = { hit: t("hit"), miss: t("miss"), pending: t("pending") };
  // 2026-09-01 kullanıcı kararı ("yatsa da 20dk kalsın") sonrası DÜZELTİLDİ: "miss"
  // varyantları burada TEKRAR filtrelemek getKuponOnerileri'nin (race.service.ts) 20dk
  // görünür-kalma kuralını EZİYORDU — sunucu zaten doğru filtrelenmiş veriyi gönderiyor,
  // burada yalnız "filled" (admin gerçekten at girmiş mi) kontrolü yeterli.
  const visibleVariants = data.variants.filter((v) => v.filled);
  const [activeKey, setActiveKey] = useState(visibleVariants[0]?.key);
  if (visibleVariants.length === 0) return null;

  const active = visibleVariants.find((v) => v.key === activeKey) ?? visibleVariants[0];

  // v6.68 — kullanıcı talebi 2026-08-09: "kupon tahminlerinde de paylaş butonları
  // olmalıydı" — /program'daki sonuç posteriyle AYNI kural: link paylaşılmaz (Twitter
  // intent URL'i bir KART olarak unfurl ediyordu), görsel Web Share API ile DOSYA
  // olarak paylaşılır. Sonuç posterinden farklı olarak tek bir görsel formatı hem
  // Instagram hem X için kullanılıyor (ayrı Story boyutu yok), o yüzden platform
  // parametresi almıyor — Web Share API zaten paylaşım hedefine göre uygun uygulamayı sunuyor.
  // v6.107 — kullanıcı bulgusu 2026-08-11: senkron-aç-sonra-yönlendir denemesi bazı
  // tarayıcılarda (Safari başta) "about:blank" olarak sabit kalıyordu — gecikmeli
  // .location ataması da popup engeliyle AYNI kısıtlamaya takılabiliyor. Güvenilir
  // tek yol: X'i açan linki GERÇEK bir kullanıcı tıklamasına bağlamak — toast'un
  // action butonu tam bunu sağlıyor, kendi tıklaması olduğu için engellenmiyor.
  async function handleShare(platform?: "instagram" | "x") {
    const imageUrl = `${window.location.origin}/api/og/kupon/${data.id}?variant=${active.key}`;
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Görsel oluşturulamadı (HTTP ${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], "rotaganyan-kupon.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Rotaganyan" });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "rotaganyan-kupon.png";
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(t("gorselIndirildi"), platform === "x"
        ? { action: { label: "X'i Aç", onClick: () => window.open("https://x.com/rotaganyantr", "_blank", "noopener,noreferrer") } }
        : undefined);
    } catch (e) {
      // v6.108 — kullanıcı bulgusu 2026-08-11: navigator.share() kullanıcı paylaşım
      // menüsünü kapatınca (bir uygulama SEÇMEDEN) "AbortError" fırlatır — gerçek
      // bir hata değil, yanlış alarm veriyordu.
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(t("paylasimBasarisiz"));
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{cityLabel ?? data.hippodromeName}</span>
        <div className="flex items-center gap-1.5">
        {isAdmin && (
          <>
            {/* 2026-09-01 kullanıcı kararı: paylaşım ikonlarının HEPSİ (genel Paylaş dahil)
                yalnız admin'e görünür — normal kullanıcılara açılmadı. */}
            <button
              type="button"
              onClick={() => handleShare()}
              title={t("paylas")}
              aria-label={t("paylas")}
              className="inline-flex items-center rounded-md border border-brand/40 bg-brand/10 p-1.5 text-brand hover:bg-brand/20 transition-colors"
            >
              <ShareLogo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleShare("instagram")}
              title={t("instagramdaPaylas")}
              aria-label={t("instagramdaPaylas")}
              className="inline-flex items-center rounded-md border border-muted-foreground/25 p-1.5 hover:bg-muted transition-colors"
            >
              <InstagramLogo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleShare("x")}
              title={t("xtePaylas")}
              aria-label={t("xtePaylas")}
              className="inline-flex items-center rounded-md border border-muted-foreground/25 p-1.5 hover:bg-muted transition-colors"
            >
              <XLogo className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleShare()}
              title={t("facebooktaPaylas")}
              aria-label={t("facebooktaPaylas")}
              className="inline-flex items-center rounded-md border border-muted-foreground/25 p-1.5 hover:bg-muted transition-colors"
            >
              <FacebookLogo className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        </div>
      </div>

      {/* Tek kupon şablonu — Ekonomik/Normal/Geniş, /program'daki panel butonları gibi tıklanınca değişir */}
      <div className="[container-type:inline-size]">
      <div className="isolate relative flex flex-col overflow-hidden rounded-lg border bg-card">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
          <img src="/rotaganyan-filigran-logo.png" alt="" className="absolute left-[18cqw] top-[10cqw] w-[64cqw] h-auto opacity-[0.08]" />
        </div>
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
          {/* v6.113 — kullanıcı talebi 2026-08-13: seçilecek tek kademe varsa (7'li Ganyan'da
              yalnız "Geniş" doluyor) sekme göstermenin anlamı yok — aralarında gezinilecek
              başka bir kademe olmadığı için etiket kafa karıştırıyordu, tamamen gizlendi. */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {visibleVariants.length > 1 && visibleVariants.map((variant) => (
              <button
                key={variant.key}
                type="button"
                onClick={() => setActiveKey(variant.key)}
                className={cn(TAB_CLASS, variant.key === active.key ? TAB_ACTIVE : TAB_INACTIVE)}
              >
                {variant.label}
              </button>
            ))}
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASS[active.status])}>
            {STATUS_LABEL[active.status]}
          </span>
        </div>

        {/* Ayak ızgarası */}
        <div className="flex-1 overflow-x-auto">
          <div
            className="grid divide-x"
            style={{ gridTemplateColumns: `repeat(${active.legs.length}, minmax(48px, 1fr))` }}
          >
            {active.legs.map((leg) => {
              // v6.35: eküri (coupled entry) yoluyla dolaylı kazanan bir no varsa bu ayak
              // "kaçtı" sayılmaz — legWon (race.service.ts) ile AYNI mantık burada da uygulanır.
              const wonDirectlyOrByEkuri = leg.nos.some((n) => leg.winnerNos.includes(n) || n in leg.ekuriWinnerByNo);
              const missed = leg.resulted && !wonDirectlyOrByEkuri;
              return (
                <div key={leg.raceNo} className="px-1.5 py-3 text-center">
                  <div className="mb-2 text-[10px] font-medium text-muted-foreground">
                    {leg.raceNo}. {t("kosuSuffix")}
                  </div>
                  <div className="space-y-1.5 text-sm font-semibold">
                    {leg.nos.map((no) => {
                      const ekuriWinnerNo = leg.ekuriWinnerByNo[no];
                      const ekuriPartnerNo = leg.ekuriPartnerByNo[no];
                      return (
                        <div key={no}>
                          {leg.winnerNos.includes(no) ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                              {no}
                            </span>
                          ) : ekuriWinnerNo != null ? (
                            // 2026-09-01 kullanıcı talebi: "4 ve 5 eküri, 5 geldi → 4-5 yaz"
                            // — eski "(N eküri)" ek açıklaması yerine seçilen-kazanan
                            // numarası tire ile TEK yeşil rozette gösteriliyor.
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-hit px-1.5 text-white text-xs font-bold">
                              {no}-{ekuriWinnerNo}
                            </span>
                          ) : ekuriPartnerNo != null ? (
                            // 2026-09-01 kullanıcı talebi: sonuç gelmeden ÖNCE de, kupon
                            // yayınlandığı anda eküri ortağı otomatik "no-ortak" olarak
                            // görünsün (henüz kazanmadığı için nötr renk).
                            <span className={cn("font-semibold", missed && "text-muted-foreground line-through")}>
                              {no}-{ekuriPartnerNo}
                            </span>
                          ) : (
                            <span className={missed ? "text-muted-foreground line-through" : undefined}>{no}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {missed && (
                    <div className="mt-1.5 text-[10px] font-medium text-miss">{t("kazanan")}: {leg.winnerNos.join(", ")}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kupon tutarı */}
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground">{t("kuponTutari")}</div>
          <div className="text-lg font-bold">
            {active.amount.toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            ₺
          </div>
          {ikramiye && <div className="mt-1.5 text-xs font-medium text-hit">{ikramiye}</div>}
        </div>
      </div>
      </div>
    </div>
  );
}

// 2026-09-01 kullanıcı talebi — aynı şehrin birden fazla altılısı (1. Altılı/2. Altılı)
// varsa, ikisini ayrı kartlar olarak yan yana/alt alta göstermek yerine TEK kartın
// üstünde bir segment seçiciyle (referans: "İsmet Demir" tarzı tahminci sayfaları)
// değiştirilebilir hale getirildi — hippodromeName "Şehir — N. Altılı" formatını
// zaten taşıyor (bkz. KuponForm.tsx slotLabel), burada ayrıştırılıyor.
function KuponGroup({ kuponlar, altiliResults, isAdmin }: { kuponlar: Kupon[]; altiliResults: AltiliCityResult[]; isAdmin: boolean }) {
  const [secili, setSecili] = useState(0);
  const parcala = (ad: string) => {
    const [sehir, slot] = ad.split(" — ");
    return { sehir, slot: slot ?? null };
  };
  const cityLabel = parcala(kuponlar[0].hippodromeName).sehir;
  const aktif = kuponlar[secili];

  return (
    <div>
      {kuponlar.length > 1 && (
        <div className="mb-2 flex items-center gap-1.5">
          {kuponlar.map((k, i) => {
            const { slot } = parcala(k.hippodromeName);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSecili(i)}
                className={cn(
                  // 2026-09-01 kullanıcı talebi: tam kapsül (rounded-full) değil, orta
                  // yuvarlaklıkta köşeli dikdörtgen ("köşeler sivriye yakın ama oval").
                  "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                  i === secili ? "bg-brand text-brand-foreground" : "bg-foreground/5 text-muted-foreground border hover:bg-muted"
                )}
              >
                {slot ?? `${i + 1}. Altılı`}
              </button>
            );
          })}
        </div>
      )}
      <KuponBlock
        data={aktif}
        cityLabel={cityLabel}
        ikramiye={findIkramiyeForHippodrome(aktif.hippodromeName, altiliResults) ?? aktif.ikramiye}
        isAdmin={isAdmin}
      />
    </div>
  );
}

type Props = { data: KuponOnerisi[]; altiliResults?: AltiliCityResult[]; isLoggedIn?: boolean; isAdmin?: boolean };

export default function TahminOnerileri({ data, altiliResults = [], isLoggedIn = false, isAdmin = false }: Props) {
  const t = useTranslations("home.tahminOnerileri");
  const items = data.filter((k): k is Kupon => k !== null);
  if (items.length === 0) return null;

  // Aynı şehrin (hippodromeName'in " — " öncesi kısmı) 1./2. Altılı'sını TEK gruba
  // topla — getKuponOnerileri zaten şehre göre sıralı döndüğü için art arda gelirler.
  const gruplar: Kupon[][] = [];
  for (const kupon of items) {
    const sehir = kupon.hippodromeName.split(" — ")[0];
    const sonGrup = gruplar[gruplar.length - 1];
    if (sonGrup && sonGrup[0].hippodromeName.split(" — ")[0] === sehir) sonGrup.push(kupon);
    else gruplar.push([kupon]);
  }

  if (!isLoggedIn) {
    return (
      <section className="border-t px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-lg font-semibold">{t("title")}</h2>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            <span className="text-2xl">🔒</span>
            <p className="font-medium">{t("girisGerekli")}</p>
            <div className="flex gap-2">
              <a href="/giris" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90">
                {t("girisYap")}
              </a>
              <a href="/kayit" className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted">
                {t("kayitOl")}
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 2026-08-16 kullanıcı bulgusu: "7'li Ganyan" gibi TJK'nın AltiliSonuc
              sayfasının kapsamadığı bahis türlerinde canlı eşleşme sessizce null
              dönüyordu — admin'in elle girdiği kupon.ikramiye artık yedek olarak
              kullanılıyor (canlı TJK eşleşmesi varsa o önceliklidir, daha güncel). */}
          {gruplar.map((grup, i) => (
            <KuponGroup key={i} kuponlar={grup} altiliResults={altiliResults} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
    </section>
  );
}
