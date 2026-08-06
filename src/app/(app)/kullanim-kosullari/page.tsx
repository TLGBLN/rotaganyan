import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kullanimKosullari");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function KullanimKosullariPage() {
  const t = await getTranslations("kullanimKosullari");
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("sonGuncelleme")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s1Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s1")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s2Baslik")}</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>{t("s2i1")}</li>
          <li>{t("s2i2")}</li>
          <li>{t("s2i3")}</li>
          <li>{t("s2i4")}</li>
          <li>{t("s2i5")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s3Baslik")}</h2>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">{t("s3Onemli")}</strong> {t("s3p1")}
          </p>
          <p>
            {t("s3p2")}
          </p>
          <p>
            {t("s3p3")}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s4Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s4")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          {t("s5Baslik")}{" "}
          <span className="text-sm font-normal text-muted-foreground">{t("s5NotAktif")}</span>
        </h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>{t("s5i1")}</li>
          <li>{t("s5i2")}</li>
          <li>{t("s5i3")}</li>
          <li>{t("s5i4")}</li>
          <li>{t("s5i5")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s6Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s6")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s7Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s7")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s8Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s8Pre")}{" "}
          <a href="mailto:destek@rotaganyan.com" className="text-brand underline">
            destek@rotaganyan.com
          </a>
        </p>
      </section>
    </main>
  );
}
