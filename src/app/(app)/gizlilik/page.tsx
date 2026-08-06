import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("gizlilik");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function GizlilikPage() {
  const t = await getTranslations("gizlilik");
  const amacTablosu = [
    [t("s3r1a"), t("s3r1b")],
    [t("s3r2a"), t("s3r2b")],
    [t("s3r3a"), t("s3r3b")],
    [t("s3r4a"), t("s3r4b")],
    [t("s3r5a"), t("s3r5b")],
    [t("s3r6a"), t("s3r6b")],
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("sonGuncelleme")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s1Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s1")}{" "}
          <a href="mailto:destek@rotaganyan.com" className="text-brand underline">destek@rotaganyan.com</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s2Baslik")}</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>{t("s2i1L")}</strong> {t("s2i1")}</li>
          <li><strong>{t("s2i2L")}</strong> {t("s2i2")}</li>
          <li><strong>{t("s2i3L")}</strong> {t("s2i3")}</li>
          <li><strong>{t("s2i4L")}</strong> {t("s2i4")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s3Baslik")}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left">{t("s3ColAmac")}</th>
                <th className="px-3 py-2 text-left">{t("s3ColDayanak")}</th>
              </tr>
            </thead>
            <tbody>
              {amacTablosu.map(([amac, dayanak], i) => (
                <tr key={i} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                  <td className="px-3 py-2">{amac}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dayanak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s4Baslik")}</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>{t("s4i1L")}</strong> — {t("s4i1")}</li>
          <li><strong>{t("s4i2L")}</strong> — {t("s4i2")}</li>
          <li><strong>{t("s4i3L")}</strong> — {t("s4i3")}</li>
          <li><strong>{t("s4i4L")}</strong> — {t("s4i4")}</li>
          <li>{t("s4not")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s5Baslik")}</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>{t("s5i1")}</li>
          <li>{t("s5i2")}</li>
          <li>{t("s5i3")}</li>
          <li>{t("s5i4")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("s6Baslik")}</h2>
        <p className="text-muted-foreground">
          {t("s6p1")}
        </p>
        <p className="text-muted-foreground">
          {t("s6p2Pre")}{" "}
          <a href="mailto:destek@rotaganyan.com" className="text-brand underline">
            destek@rotaganyan.com
          </a>{" "}
          {t("s6p2Post")}
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
          {t("s8")}
        </p>
      </section>
    </main>
  );
}
