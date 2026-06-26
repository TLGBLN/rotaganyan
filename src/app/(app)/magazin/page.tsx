import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getPublishedArticles } from "@/server/services/article.service";

export const metadata: Metadata = {
  title: "Magazin",
  description: "At yarışı dünyasından haberler, röportajlar ve analizler.",
};

export default async function MagazinPage() {
  const { items, total } = await getPublishedArticles("MAGAZINE");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Magazin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          At yarışı dünyasından {total} içerik.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">
          Henüz içerik yayımlanmamış.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((article) => (
            <Link
              key={article.id}
              href={`/magazin/${article.slug}`}
              className="group flex gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              {article.coverImage && (
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={article.coverImage}
                    alt={article.title}
                    fill
                    sizes="112px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold leading-snug group-hover:text-brand line-clamp-2">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {article.author.name ?? "ROTAGANYAN"}
                  {article.publishedAt && (
                    <> · {format(new Date(article.publishedAt), "d MMM yyyy", { locale: tr })}</>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
