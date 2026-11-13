// İzleme dashboard'unun ortak görsel dili: dikey şeritli başlıklar, KPI karoları, çipler, huni çubukları, renkli rozetler,
// renkli başlık bantlı kartlar, içgörü bandı. SADECE tema değişkenleri (brand/target/hit/miss/card/border) — açık ve koyu temada çalışır;
// mobilde taşmaz (tablolar kendi kapsayıcısında kayar). Sunucu bileşenleri (client JS yok).
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Ton = "altin" | "mavi" | "yesil" | "kirmizi" | "mor" | "gri";

/** Dolgulu zemin + okunur yazı (rozet, çubuk, başlık bandı) */
export const TON_DOLGU: Record<Ton, string> = {
  altin: "bg-brand text-brand-foreground",
  mavi: "bg-target text-target-foreground",
  yesil: "bg-hit text-white",
  kirmizi: "bg-miss text-white",
  mor: "bg-[oklch(0.55_0.14_300)] text-white",
  gri: "bg-muted-foreground/30 text-foreground",
};
export const TON_NOKTA: Record<Ton, string> = {
  altin: "bg-brand", mavi: "bg-target", yesil: "bg-hit", kirmizi: "bg-miss", mor: "bg-[oklch(0.55_0.14_300)]", gri: "bg-muted-foreground/50",
};
export const TON_METIN: Record<Ton, string> = {
  altin: "text-winner", mavi: "text-target", yesil: "text-hit", kirmizi: "text-miss", mor: "text-[oklch(0.5_0.14_300)]", gri: "text-muted-foreground",
};

/** Türkçe biçim: %12,3 — NaN/null → "—" */
export const yuzde = (x: number | null | undefined, d = 1): string => (x == null || !Number.isFinite(x) ? "—" : `%${(x * 100).toFixed(d).replace(".", ",")}`);
export const sayi = (x: number | null | undefined, d = 3): string => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(d).replace(".", ","));
export const isaretli = (x: number | null | undefined, d = 3): string => (x == null || !Number.isFinite(x) ? "—" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d).replace(".", ",")}`);
export const para = (x: number | null | undefined): string => (x == null || !Number.isFinite(x) ? "—" : `${Math.round(x).toLocaleString("tr-TR")} ₺`);

export function zamanOnce(iso: string | null, simdi: Date = new Date()): { metin: string; dakika: number | null } {
  if (!iso) return { metin: "kayıt yok", dakika: null };
  const dk = Math.max(0, Math.round((simdi.getTime() - new Date(iso).getTime()) / 60000));
  if (dk < 60) return { metin: `${dk} dk önce`, dakika: dk };
  if (dk < 60 * 36) return { metin: `${Math.round(dk / 60)} sa önce`, dakika: dk };
  return { metin: `${Math.round(dk / 1440)} gün önce`, dakika: dk };
}

/** Bölüm kartı: turuncu/altın dikey şeritli başlık + açıklama */
export function Bolum({ baslik, aciklama, sag, children, className }: { baslik: string; aciklama?: string; sag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold leading-tight sm:text-lg">
            <span aria-hidden className="inline-block h-4 w-1 shrink-0 rounded-full bg-brand sm:h-5" />
            <span className="min-w-0 break-words">{baslik}</span>
          </h2>
          {aciklama && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{aciklama}</p>}
        </div>
        {sag && <div className="shrink-0 text-[11px] text-muted-foreground">{sag}</div>}
      </div>
      {children}
    </section>
  );
}

/** KPI karo ızgarası (mobilde 2, geniş ekranda 3-6 sütun) */
export function KpiIzgara({ children, sutun = 6 }: { children: ReactNode; sutun?: 3 | 4 | 6 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-3", sutun === 3 && "sm:grid-cols-3", sutun === 4 && "sm:grid-cols-4", sutun === 6 && "sm:grid-cols-3 lg:grid-cols-6")}>{children}</div>
  );
}

export function KpiKaro({ deger, etiket, alt, ton }: { deger: ReactNode; etiket: string; alt?: ReactNode; ton?: Ton }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-3 py-3 sm:px-4">
      <div className={cn("truncate text-2xl font-bold tabular-nums leading-none sm:text-3xl", ton ? TON_METIN[ton] : "text-foreground")}>{deger}</div>
      <div className="mt-2 text-xs font-semibold">{etiket}</div>
      {alt && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{alt}</div>}
    </div>
  );
}

/** Renkli noktalı çip: ● 117 Idea */
export function Cip({ sayi: s, etiket, ton = "gri" }: { sayi: ReactNode; etiket: string; ton?: Ton }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", TON_NOKTA[ton])} />
      <b className={cn("tabular-nums", TON_METIN[ton])}>{s}</b>
      <span className="text-muted-foreground">{etiket}</span>
    </span>
  );
}

/** Yuvarlak renkli rakam rozeti (tablo hücreleri) */
export function Rozet({ children, ton = "gri", className }: { children: ReactNode; ton?: Ton; className?: string }) {
  return <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold tabular-nums", TON_DOLGU[ton], className)}>{children}</span>;
}

/** Huni/yatay çubuk satırı: etiket — dolgu (içinde değer) — sağ değer. yuzde 0-100 */
export function HuniSatiri({ etiket, yuzde: y, ton = "altin", icMetin, sagMetin, alt, soluk, ince }: { etiket: string; yuzde: number | null; ton?: Ton; icMetin?: string; sagMetin?: string; alt?: string; soluk?: boolean; ince?: boolean }) {
  const w = y == null || !Number.isFinite(y) ? 0 : Math.max(0, Math.min(100, y));
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", soluk && "opacity-50")}>
      <div className={cn("w-24 shrink-0 text-xs font-semibold leading-tight sm:w-32", TON_METIN[ton])}>
        {etiket}
        {alt && <div className="text-[10px] font-normal text-muted-foreground">{alt}</div>}
      </div>
      <div className={cn("relative min-w-0 flex-1 overflow-hidden rounded-lg bg-muted/40", ince ? "h-4" : "h-7")}>
        {w > 0 && (
          <div className={cn("flex h-full items-center rounded-lg px-2 text-[11px] font-bold tabular-nums", TON_DOLGU[ton])} style={{ width: `${w}%`, minWidth: icMetin ? "2.25rem" : undefined }}>
            {!ince && icMetin}
          </div>
        )}
      </div>
      <div className="w-14 shrink-0 text-right text-sm font-bold tabular-nums sm:w-20">{sagMetin ?? "—"}</div>
    </div>
  );
}

/** İçgörü bandı (referanstaki yeşil ★ bandı; ton'a göre yeşil/altın/kırmızı/mavi) */
export function IcgoruBandi({ ton = "yesil", children }: { ton?: "yesil" | "altin" | "kirmizi" | "mavi"; children: ReactNode }) {
  const stil = { yesil: "border-hit/30 bg-hit/10 text-hit", altin: "border-brand/40 bg-brand/10 text-winner", kirmizi: "border-miss/30 bg-miss/10 text-miss", mavi: "border-target/30 bg-target/10 text-target" }[ton];
  return (
    <div className={cn("mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed", stil)}>
      <span aria-hidden className="mt-px shrink-0">★</span>
      <div className="min-w-0 text-foreground/90 [&_b]:font-bold">{children}</div>
    </div>
  );
}

/** Renkli başlık bantlı kart (referanstaki "Realized Impact" kartları) */
export function RenkliBaslikKarti({ baslik, sag, ton, children }: { baslik: string; sag?: string; ton: Ton; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className={cn("flex items-center justify-between gap-2 px-4 py-2.5", TON_DOLGU[ton])}>
        <span className="truncate text-sm font-bold">{baslik}</span>
        {sag && <span className="shrink-0 text-xs font-bold opacity-90">{sag}</span>}
      </div>
      <div className="flex-1 space-y-0.5 px-4 py-3">{children}</div>
    </div>
  );
}

export function SatirDeger({ etiket, deger, alt, ton }: { etiket: string; deger: ReactNode; alt?: ReactNode; ton?: Ton }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{etiket}</span>
      <span className="min-w-0 text-right">
        <span className={cn("text-sm font-bold tabular-nums sm:text-base", ton && TON_METIN[ton])}>{deger}</span>
        {alt && <span className="ml-1.5 text-[10px] text-muted-foreground">{alt}</span>}
      </span>
    </div>
  );
}

/** Kapalı gelen detay grubu: başlık kartı (altın şerit + durum noktası) tıklanınca içindeki bölümler açılır. JS gerektirmez (<details>). */
export function KatlanirGrup({ baslik, aciklama, ton, children, acik }: { baslik: string; aciklama?: string; ton?: Ton; children: ReactNode; acik?: boolean }) {
  return (
    <details className="group" open={acik}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block h-4 w-1 shrink-0 rounded-full bg-brand sm:h-5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-bold sm:text-lg">
            {baslik}
            {ton && <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", TON_NOKTA[ton])} />}
          </span>
          {aciklama && <span className="mt-0.5 block text-xs text-muted-foreground">{aciklama}</span>}
        </span>
        <span aria-hidden className="shrink-0 text-xs text-muted-foreground group-open:hidden">aç ▾</span>
        <span aria-hidden className="hidden shrink-0 text-xs text-muted-foreground group-open:inline">kapat ▴</span>
      </summary>
      <div className="mt-3 space-y-5">{children}</div>
    </details>
  );
}
