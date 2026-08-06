"use client";

import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale.actions";
import { useLocaleSwitch } from "@/components/providers/LocaleProvider";
import type { AppLocale } from "@/i18n/request";

// v2026-08-02: eskiden router.refresh() ile TAM sunucu turu yapıyordu — ağır sayfalarda
// (örn. /program) bu tur saniyeler sürebiliyordu (kullanıcı şikayeti). Artık dil değişimi
// TAMAMEN client-side (LocaleProvider), sunucu turu yok — anlık. Cookie (kalıcılık için,
// bir sonraki gerçek navigasyonda doğru dille SSR yapılsın diye) arka planda yazılıyor,
// hiçbir şeyi bloklamıyor.
export default function LocaleToggle() {
  const { locale, setLocaleClient } = useLocaleSwitch();

  function choose(next: AppLocale) {
    if (next === locale) return;
    setLocaleClient(next);
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    void setLocale(next);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border px-0.5 py-0.5 text-[11px] font-semibold">
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          className={cn(
            "rounded px-1.5 py-0.5 uppercase transition-colors",
            l === locale ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
