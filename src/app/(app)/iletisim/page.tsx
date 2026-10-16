import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import IletisimForm from "./IletisimForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("iletisim");
  return { title: t("metaTitle") };
}

export default async function IletisimPage() {
  const t = await getTranslations("iletisim");
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-10 text-muted-foreground">
        {t("intro")}
      </p>

      <IletisimForm />
    </main>
  );
}
