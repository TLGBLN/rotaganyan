"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { productSchema } from "@/lib/validations/product";

type ProductInput = {
  name: string;
  slug: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
  stock: number;
};

export async function upsertProduct(id: string | null, input: ProductInput) {
  await requireRole("EDITOR");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
  }

  const data = {
    ...parsed.data,
    description: input.description || null,
    image: input.image || null,
    category: input.category || null,
  };

  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data });

  revalidatePath("/admin/urunler");
  revalidatePath("/rotastore");
  return { success: true, id: product.id };
}

export async function activateProduct(id: string) {
  await requireRole("EDITOR");
  const product = await db.product.update({ where: { id }, data: { active: true } });
  revalidatePath("/admin/urunler");
  revalidatePath("/rotastore");
  revalidatePath(`/rotastore/${product.slug}`);
}

export async function deactivateProduct(id: string) {
  await requireRole("EDITOR");
  await db.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/urunler");
  revalidatePath("/rotastore");
}

export async function deleteProduct(id: string) {
  await requireRole("ADMIN");
  await db.product.delete({ where: { id } });
  revalidatePath("/admin/urunler");
  revalidatePath("/rotastore");
}
