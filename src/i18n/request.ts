import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { TZ } from "../lib/tz";

export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "tr";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: AppLocale = SUPPORTED_LOCALES.includes(cookieLocale as AppLocale)
    ? (cookieLocale as AppLocale)
    : DEFAULT_LOCALE;

  return {
    locale,
    // timeZone tanımsızken next-intl her render'da ENVIRONMENT_FALLBACK hatası logluyordu (sunucu UTC / istemci TR farkı riski). Sitenin saat dilimi sabit: Türkiye.
    timeZone: TZ,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
