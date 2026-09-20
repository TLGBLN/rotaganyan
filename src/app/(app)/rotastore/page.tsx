import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedProducts } from "@/server/services/product.service";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "RotaStore",
  description: "Rotaganyan ürünleri — şapka, anahtarlık, tişört ve daha fazlası.",
};

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function RotaStorePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const { items, total } = await getPublishedProducts(page, 24);
  const totalPages = Math.ceil(total / 24);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">RotaStore</h1>
        <p className="mt-2 text-muted-foreground">Rotaganyan ürünleri — şapka, anahtarlık, tişört ve daha fazlası.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Yakında burada olacak.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/rotastore/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl font-black text-muted-foreground/20">
                    ROTA<span className="text-brand/30">STORE</span>
                  </div>
                )}
                {p.stock === 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Tükendi
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                {p.category && (
                  <span className="w-fit rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {p.category}
                  </span>
                )}
                <h2 className="font-bold leading-snug group-hover:text-brand">{p.name}</h2>
                <p className="mt-auto text-lg font-semibold tabular-nums">
                  {p.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link href={`/rotastore?sayfa=${page - 1}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/rotastore?sayfa=${page + 1}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
