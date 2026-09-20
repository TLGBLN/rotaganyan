import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ProductCard = Prisma.ProductGetPayload<object>;

export async function getPublishedProducts(page = 1, perPage = 24): Promise<{ items: ProductCard[]; total: number }> {
  const where: Prisma.ProductWhereInput = { active: true };
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    db.product.count({ where }),
  ]);
  return { items, total };
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({ where: { slug } });
}

export async function getAdminProducts(page = 1, perPage = 30): Promise<{ items: ProductCard[]; total: number }> {
  const [items, total] = await Promise.all([
    db.product.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    db.product.count(),
  ]);
  return { items, total };
}

export async function getAdminProductById(id: string) {
  return db.product.findUnique({ where: { id } });
}
