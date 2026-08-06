import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("eposta")}</p>
          <a
            href="mailto:destek@rotaganyan.com"
            className="text-lg font-medium text-brand hover:underline underline-offset-4"
          >
            destek@rotaganyan.com
          </a>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("epostaDetay")}
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("yanitSuresi")}</p>
          <p className="text-lg font-medium">{t("yanitSuresiDeger")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("yanitSuresiDetay")}
          </p>
        </div>

      </div>
    </main>
  );
}
