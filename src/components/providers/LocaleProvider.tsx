"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AppLocale } from "@/i18n/request";
import trMessages from "../../../messages/tr.json";
import enMessages from "../../../messages/en.json";

const MESSAGES: Record<AppLocale, typeof trMessages> = { tr: trMessages, en: enMessages };

type LocaleCtxValue = { locale: AppLocale; setLocaleClient: (next: AppLocale) => void };
const LocaleCtx = createContext<LocaleCtxValue | null>(null);

/** TR/EN değişimi router.refresh() (tam sunucu turu) yerine burada — /program gibi ağır
 *  sayfalarda bu tur saniyeler sürebiliyordu (kullanıcı şikayeti). Her iki dilin mesajları
 *  zaten küçük JSON'lar, ikisi de bundle'a gömülü — geçiş yalnız client state, ~0ms. */
export function useLocaleSwitch() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useLocaleSwitch, LocaleProvider içinde kullanılmalı");
  return ctx;
}

export default function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);

  const setLocaleClient = useCallback((next: AppLocale) => {
    setLocale(next);
    document.documentElement.lang = next;
  }, []);

  return (
    <LocaleCtx.Provider value={{ locale, setLocaleClient }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleCtx.Provider>
  );
}
