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
const TAB_INACTIVE = "bg-white/5 text-muted-foreground border hover:bg-muted";

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

function KuponBlock({ data, ikramiye, isAdmin }: { data: Kupon; ikramiye: string | null; isAdmin: boolean }) {
  const t = useTranslations("home.tahminOnerileri");
  const STATUS_LABEL: Record<KuponStatus, string> = { hit: t("hit"), miss: t("miss"), pending: t("pending") };
  const visibleVariants = data.variants.filter((v) => v.status !== "miss" && v.filled);
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
  async function handleShare(platform: "instagram" | "x") {
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
        <span className="text-sm font-medium text-muted-foreground">{data.hippodromeName}</span>
        {isAdmin && (
          <div className="flex items-center gap-1.5">
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
          </div>
        )}
      </div>

      {/* Tek kupon şablonu — Ekonomik/Normal/Geniş, /program'daki panel butonları gibi tıklanınca değişir */}
      <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {visibleVariants.map((variant) => (
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
                      return (
                        <div key={no}>
                          {leg.winnerNos.includes(no) ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                              {no}
                            </span>
                          ) : ekuriWinnerNo != null ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                                {no}
                              </span>
                              <span className="text-[9px] text-hit">({ekuriWinnerNo} eküri)</span>
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
  );
}

type Props = { data: KuponOnerisi[]; altiliResults?: AltiliCityResult[]; isLoggedIn?: boolean; isAdmin?: boolean };

export default function TahminOnerileri({ data, altiliResults = [], isLoggedIn = false, isAdmin = false }: Props) {
  const t = useTranslations("home.tahminOnerileri");
  const items = data.filter((k): k is Kupon => k !== null);
  const hasVisible = items.some((k) => k.variants.some((v) => v.status !== "miss"));
  if (items.length === 0 || !hasVisible) return null;

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
          {items.map((kupon, i) => (
            <KuponBlock key={i} data={kupon} ikramiye={findIkramiyeForHippodrome(kupon.hippodromeName, altiliResults)} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
    </section>
  );
}
