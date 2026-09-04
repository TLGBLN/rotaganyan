"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// index = Date.getDay(): 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
const BASE_BY_DAY = [218, 102, 131, 104, 145, 129, 183];

export default function OnlineCounter() {
  const t = useTranslations("header");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    function compute() {
      const base = BASE_BY_DAY[new Date().getDay()];
      const jitter = Math.floor(Math.random() * 7) - 3;
      return Math.max(1, base + jitter);
    }
    setCount(compute());
    const id = setInterval(() => setCount(compute()), 8000);
    return () => clearInterval(id);
  }, []);

  if (count == null) return null;

  return (
    // 2026-09-03 kullanıcı talebi ("ana ekranda gözüksün") — bileşen artık TÜM ekran
    // boyutlarında görünüyor (eskiden yalnız masaüstü menüsündeydi). En dar mobil
    // genişliklerde (320px) "çevrimiçi" kelimesi pil içinde satır kırıyordu (zil/avatar/
    // hamburger'a sıkışınca) — whitespace-nowrap + mobilde kelimeyi gizleyip yalnız
    // nokta+sayı gösterme (md: üstünde tam metin) bunu çözüyor.
    <span
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium text-muted-foreground"
      title={`${count} ${t("cevrimici")}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#27ae60] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#27ae60]" />
      </span>
      {count}
      <span className="hidden md:inline">{t("cevrimici")}</span>
    </span>
  );
}