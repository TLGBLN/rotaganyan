"use client";

import { useTranslations } from "next-intl";

type HeaderKey = "program" | "puanTablosu" | "altiliNeVerir" | "bankoOnerileri" | "girisYap" | "kayitOl";

// Header.tsx sunucu bileşeni kalmalı (auth + DB sorguları) — dil değişimi client-side
// olduğu için (bkz. LocaleProvider) yalnız çevrilen metin buraya, küçük bir client
// bileşenine taşındı; geri kalan Header aynen sunucuda render olmaya devam ediyor.
export default function HeaderLabel({ k }: { k: HeaderKey }) {
  const t = useTranslations("header");
  return <>{t(k)}</>;
}
