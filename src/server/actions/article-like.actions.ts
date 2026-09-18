"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyAdminsArticleLiked } from "@/server/actions/notification.actions";

export async function toggleArticleLike(articleId: string, slug: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Giriş yapmalısınız.");

  const existing = await db.articleLike.findUnique({
    where: { articleId_userId: { articleId, userId: session.user.id } },
  });

  if (existing) {
    await db.articleLike.delete({ where: { id: existing.id } });
    revalidatePath(`/makaleler/${slug}`);
    revalidatePath("/makaleler");
    return { liked: false };
  }

  await db.articleLike.create({ data: { articleId, userId: session.user.id } });
  // Sahte seed sayısı DEĞİL, gerçek kullanıcı beğenisi — admin'e bildirim.
  await notifyAdminsArticleLiked(articleId, session.user.name ?? "Bir kullanıcı");
  revalidatePath(`/makaleler/${slug}`);
  revalidatePath("/makaleler");
  return { liked: true };
}

/** Bir dizi makale için: her birinin (seed+gerçek) toplam beğeni sayısı ve mevcut
 *  kullanıcının beğenip beğenmediği — liste sayfasında tek sorguda toplu çekilir. */
export async function getArticleLikeStates(
  articles: { id: string; seedLikeCount: number; _count: { likes: number } }[]
): Promise<Record<string, { total: number; likedByMe: boolean }>> {
  const session = await auth();
  const likedSet = new Set<string>();

  if (session?.user?.id && articles.length > 0) {
    const myLikes = await db.articleLike.findMany({
      where: { userId: session.user.id, articleId: { in: articles.map((a) => a.id) } },
      select: { articleId: true },
    });
    for (const l of myLikes) likedSet.add(l.articleId);
  }

  const out: Record<string, { total: number; likedByMe: boolean }> = {};
  for (const a of articles) {
    out[a.id] = { total: a.seedLikeCount + a._count.likes, likedByMe: likedSet.has(a.id) };
  }
  return out;
}
