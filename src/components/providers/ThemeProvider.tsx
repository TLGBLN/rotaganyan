"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// 2026-09-11 kullanıcı talebi — açık/koyu tema seçimi. Varsayılan hâlâ koyu (marka
// kimliği), enableSystem KAPALI: kullanıcı yalnız iki seçenek (Açık/Koyu) arasında
// kendi tercihiyle geçer, OS ayarına göre otomatik değişmez — bkz. ThemeToggle.tsx.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
