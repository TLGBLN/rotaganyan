import { getAdminProducts } from "@/server/services/product.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ProductActions from "./ProductActions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function AdminUrunlerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const { items, total } = await getAdminProducts(page, 30);
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">RotaGanyan Store — Ürünler</h1>
        <Link
          href="/admin/urunler/yeni"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Yeni Ürün
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Henüz ürün eklenmedi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ürün</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kategori</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fiyat</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Stok</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => (
                <tr key={p.id} className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/urunler/${p.id}`} className="font-medium text-brand hover:underline line-clamp-1">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.category || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</td>
                  <td className={cn("px-3 py-2 tabular-nums", p.stock === 0 && "text-miss")}>{p.stock}</td>
                  <td className="px-3 py-2">
                    <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                      {p.active ? "Vitrinde" : "Taslak"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {format(new Date(p.updatedAt), "d MMM yyyy", { locale: tr })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ProductActions id={p.id} active={p.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/admin/urunler?sayfa=${page - 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/urunler?sayfa=${page + 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
