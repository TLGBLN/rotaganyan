"use client";

import { useTranslations } from "next-intl";

type ProgramPageKey = "title" | "bankolarBaslik" | "kuponlarBaslik";

// program/page.tsx sunucu bileşeni kalmalı (ağır veri çekme) — dil değişimi client-side
// olduğu için (bkz. LocaleProvider) yalnız bu birkaç başlık buraya taşındı.
export default function ProgramPageLabel({ k }: { k: ProgramPageKey }) {
  const t = useTranslations("programPage");
  return <>{t(k)}</>;
}
