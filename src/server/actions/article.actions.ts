"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { articleSchema } from "@/lib/validations/article";
import { tweetArticlePublished } from "@/lib/x";

type ArticleInput = {
  type: "EDUCATIONAL" | "MAGAZINE";
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  coverImage?: string;
  category?: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
};

export async function upsertArticle(id: string | null, input: ArticleInput) {
  const session = await requireRole("EDITOR");

  const parsed = articleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
  }

  const data = {
    ...parsed.data,
    authorId: session.user.id,
    body: input.body,
    coverImage: input.coverImage || null,
    excerpt: input.excerpt || null,
    category: input.category || null,
    metaTitle: input.metaTitle || null,
    metaDescription: input.metaDescription || null,
  };

  const article = id
    ? await db.article.update({ where: { id }, data })
    : await db.article.create({ data });

  revalidatePath("/admin/makaleler");
  return { success: true, id: article.id };
}

export async function publishArticle(id: string) {
  await requireRole("EDITOR");

  const article = await db.article.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });

  revalidatePath("/admin/makaleler");
  await tweetArticlePublished(article.title, "/");
}

export async function unpublishArticle(id: string) {
  await requireRole("EDITOR");

  await db.article.update({
    where: { id },
    data: { published: false, publishedAt: null },
  });

  revalidatePath("/admin/makaleler");
}

export async function deleteArticle(id: string) {
  await requireRole("ADMIN");
  await db.article.delete({ where: { id } });
  revalidatePath("/admin/makaleler");
}
