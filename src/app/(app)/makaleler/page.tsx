import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getPublishedArticles } from "@/server/services/article.service";
import { getArticleLikeStates } from "@/server/actions/article-like.actions";
import ArticleLikeButton from "@/components/articles/ArticleLikeButton";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Makaleler",
  description: "Rotaganyan'dan at yarışı analizi, pedigri, galop ve AGF üzerine makaleler.",
};

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function MakalelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const { items, total } = await getPublishedArticles(undefined, page, 12);
  const totalPages = Math.ceil(total / 12);
  const likeStates = await getArticleLikeStates(items);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Makaleler</h1>
        <p className="mt-2 text-muted-foreground">
          At yarışı analizi, pedigri, galop ve AGF üzerine yazılar.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Henüz yayınlanmış makale yok.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/makaleler/${a.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                {a.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin'in yapıştırdığı
                  // rastgele harici URL, next/image remotePatterns beyaz listesi (yalnız
                  // supabase.co/unsplash) gerektirir — ham <img> ANY domain için güvenilir çalışır.
                  <img src={a.coverImage} alt={a.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-black text-muted-foreground/20">
                    ROTA<span className="text-brand/30">GANYAN</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                {a.category && (
                  <span className="w-fit rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {a.category}
                  </span>
                )}
                <h2 className="line-clamp-2 font-bold leading-snug group-hover:text-brand">{a.title}</h2>
                {a.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>}
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  {/* 2026-09-18 kullanıcı talebi: gerçek admin adı yerine jenerik "Rotaganyan
                      Editör" — author ilişkisi (admin takibi için) DEĞİŞMEDİ, yalnız herkese
                      açık gösterim etiketi. */}
                  <span>Rotaganyan Editör</span>
                  {a.publishedAt && <span>{format(new Date(a.publishedAt), "d MMM yyyy", { locale: tr })}</span>}
                </div>
                <ArticleLikeButton
                  articleId={a.id}
                  slug={a.slug}
                  initialTotal={likeStates[a.id]?.total ?? a.seedLikeCount}
                  initialLikedByMe={likeStates[a.id]?.likedByMe ?? false}
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link href={`/makaleler?sayfa=${page - 1}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/makaleler?sayfa=${page + 1}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
