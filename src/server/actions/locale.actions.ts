"use server";

import { cookies } from "next/headers";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/request";

export async function setLocale(locale: AppLocale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
