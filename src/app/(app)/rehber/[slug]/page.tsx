import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getArticleBySlug } from "@/server/services/article.service";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
  };
}

export default async function RehberArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published || article.type !== "EDUCATIONAL") notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/rehber"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Rehber
      </Link>

      {article.coverImage && (
        <img
          src={article.coverImage}
          alt={article.title}
          className="mb-6 h-56 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{article.author.name ?? "ROTAGANYAN"}</span>
        {article.publishedAt && (
          <span>· {format(new Date(article.publishedAt), "d MMMM yyyy", { locale: tr })}</span>
        )}
      </div>

      <article
        className="prose prose-sm mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />

      {article.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-1.5 border-t pt-4">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
