"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

// 2026-09-11 kullanıcı talebi — LocaleToggle (TR/EN) ile aynı desen, yalnız
// tam-yuvarlak (rounded-full) pill: kullanıcı ekran görüntüsüyle bu şekli
// açıkça istedi. `mounted` kontrolü next-themes'in standart hydration-mismatch
// önlemi — sunucu hangi temanın aktif olduğunu bilemez (localStorage client'ta).
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("tema");

  useEffect(() => setMounted(true), []);
  const active = mounted ? theme : "dark";

  return (
    <div className="flex items-center gap-0.5 rounded-full border px-0.5 py-0.5 text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 transition-colors",
          active === "light" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sun className="h-3 w-3" />
        {t("acik")}
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-1 transition-colors",
          active === "dark" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Moon className="h-3 w-3" />
        {t("koyu")}
      </button>
    </div>
  );
}
