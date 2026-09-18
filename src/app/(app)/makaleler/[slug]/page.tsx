import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getArticleBySlug } from "@/server/services/article.service";
import ArticleShareButtons from "@/components/articles/ArticleShareButtons";

export const revalidate = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published) return { title: "Makale bulunamadı" };

  const title = article.metaTitle || article.title;
  const description = article.metaDescription || article.excerpt || undefined;
  const image = article.ogImage || article.coverImage || undefined;
  const url = `${BASE_URL}/makaleler/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: image ? [{ url: image }] : undefined,
      publishedTime: article.publishedAt?.toISOString(),
      authors: [article.author.name ?? "Rotaganyan"],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function MakaleDetayPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published) notFound();

  const url = `${BASE_URL}/makaleler/${article.slug}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/makaleler" className="text-sm text-muted-foreground hover:text-brand">
        ← Tüm makaleler
      </Link>

      <article className="mt-4 space-y-6">
        <header className="space-y-3">
          {article.category && (
            <span className="inline-block w-fit rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              {article.category}
            </span>
          )}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{article.title}</h1>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 text-sm text-muted-foreground">
            <span>
              {article.author.name}
              {article.publishedAt && <> · {format(new Date(article.publishedAt), "d MMMM yyyy", { locale: tr })}</>}
            </span>
            <ArticleShareButtons url={url} title={article.title} />
          </div>
        </header>

        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- bkz. /makaleler/page.tsx notu
          <img src={article.coverImage} alt={article.title} className="w-full rounded-xl object-cover" />
        )}

        <div
          className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-brand"
          dangerouslySetInnerHTML={{ __html: article.body }}
        />

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="border-t pt-4">
          <ArticleShareButtons url={url} title={article.title} />
        </div>
      </article>
    </main>
  );
}
