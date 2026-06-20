import { db } from "@/lib/db";
import type { ArticleType, Prisma } from "@prisma/client";

export type ArticleCard = Prisma.ArticleGetPayload<{
  include: { author: { select: { name: true } } };
}>;

export async function getPublishedArticles(
  type: ArticleType,
  page = 1,
  perPage = 12
): Promise<{ items: ArticleCard[]; total: number }> {
  const where: Prisma.ArticleWhereInput = { type, published: true };

  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      include: { author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.article.count({ where }),
  ]);

  return { items, total };
}

export async function getArticleBySlug(slug: string) {
  return db.article.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });
}

export async function getAdminArticles(
  page = 1,
  perPage = 30
): Promise<{ items: ArticleCard[]; total: number }> {
  const [items, total] = await Promise.all([
    db.article.findMany({
      include: { author: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.article.count(),
  ]);

  return { items, total };
}

export async function getAdminArticleById(id: string) {
  return db.article.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });
}
