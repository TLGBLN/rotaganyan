import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getPublishedArticles } from "@/server/services/article.service";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Rehber",
  description: "At yarışı analiz metodolojisi hakkında kapsamlı rehber makaleleri.",
};

export default async function RehberPage() {
  const { items, total } = await getPublishedArticles("EDUCATIONAL");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analiz Rehberi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          At yarışı analizinde kullandığımız metodoloji ve kavramları anlatan {total} makale.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">
          Henüz makale yayımlanmamış.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((article) => (
            <Link
              key={article.id}
              href={`/rehber/${article.slug}`}
              className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              {article.coverImage && (
                <div className="relative mb-3 h-36 w-full overflow-hidden rounded-md">
                  <Image
                    src={article.coverImage}
                    alt={article.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}
              {article.category && (
                <Badge variant="secondary" className="mb-2 text-xs">{article.category}</Badge>
              )}
              <h2 className="font-semibold leading-snug group-hover:text-brand">
                {article.title}
              </h2>
              {article.excerpt && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                {article.author.name ?? "ROTAGANYAN"}
                {article.publishedAt && (
                  <> · {format(new Date(article.publishedAt), "d MMM yyyy", { locale: tr })}</>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
