import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/server/services/product.service";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.active) return { title: "Ürün bulunamadı" };
  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: { title: product.name, description: product.description ?? undefined, images: product.image ? [{ url: product.image }] : undefined },
  };
}

export default async function UrunDetayPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.active) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/rotastore" className="text-sm text-muted-foreground hover:text-brand">
        ← Tüm ürünler
      </Link>

      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl font-black text-muted-foreground/20">
              ROTA<span className="text-brand/30">STORE</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {product.category && (
            <span className="inline-block w-fit rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              {product.category}
            </span>
          )}
          <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
          <p className="text-2xl font-semibold tabular-nums">
            {product.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
          </p>
          {product.description && <p className="whitespace-pre-line text-muted-foreground">{product.description}</p>}
          <p className="text-sm text-muted-foreground">
            {product.stock > 0 ? `Stokta ${product.stock} adet` : "Şu an stokta yok"}
          </p>
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Satın alma çok yakında aktif olacak — şimdilik yalnız vitrindeyiz.
          </div>
        </div>
      </div>
    </main>
  );
}
