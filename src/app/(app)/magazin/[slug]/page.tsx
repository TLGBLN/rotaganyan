import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getArticleBySlug } from "@/server/services/article.service";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

function XShareButton({ title, slug }: { title: string; slug: string }) {
  const url = `${BASE_URL}/magazin/${slug}`;
  const text = `${title} — ROTAGANYAN\n${url}\n\n#Rotaganyan #AtYarışı`;
  const href = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      X&apos;te Paylaş
    </a>
  );
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
    openGraph: article.ogImage ? { images: [article.ogImage] } : undefined,
  };
}

export default async function MagazinArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published || article.type !== "MAGAZINE") notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/magazin"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Magazin
      </Link>

      {article.coverImage && (
        <img
          src={article.coverImage}
          alt={article.title}
          className="mb-6 h-56 w-full rounded-xl object-cover"
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
        <XShareButton title={article.title} slug={slug} />
      </div>

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
