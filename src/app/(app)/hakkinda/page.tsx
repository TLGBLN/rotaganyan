import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hakkinda");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function HakkindaPage() {
  const t = await getTranslations("hakkinda");
  const seffaflikItems = [t("seffaflik1"), t("seffaflik2"), t("seffaflik3"), t("seffaflik4"), t("seffaflik5")];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">
          ROTA<span className="text-brand">GANYAN</span> {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {t("intro")}
        </p>
      </div>

      <section className="rounded-xl border border-brand/30 bg-brand/5 p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold text-brand sm:text-xl">{t("misyonBaslik")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("misyon")}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("seffaflikBaslik")}</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {seffaflikItems.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-hit">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border p-5 bg-muted/30">
        <h2 className="text-base font-semibold mb-2">{t("yasalBaslik")}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("yasal")}
        </p>
      </section>
    </main>
  );
}
