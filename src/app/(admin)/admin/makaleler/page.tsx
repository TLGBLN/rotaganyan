import { getAdminArticles } from "@/server/services/article.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ArticleActions from "./ArticleActions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ sayfa?: string }> };

export default async function AdminMakalelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.sayfa ?? "1", 10));
  const { items, total } = await getAdminArticles(page, 30);
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Makaleler</h1>
        <Link
          href="/admin/makaleler/yeni"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Yeni Makale
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Başlık</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tür</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Durum</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tarih</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id} className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}>
                <td className="px-3 py-2">
                  <Link href={`/admin/makaleler/${a.id}`} className="font-medium text-brand hover:underline line-clamp-1">
                    {a.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-xs">
                    {a.type === "EDUCATIONAL" ? "Rehber" : "Magazin"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={a.published ? "default" : "secondary"} className="text-xs">
                    {a.published ? "Yayında" : "Taslak"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {format(new Date(a.updatedAt), "d MMM yyyy", { locale: tr })}
                </td>
                <td className="px-3 py-2 text-right">
                  <ArticleActions id={a.id} published={a.published} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/admin/makaleler?sayfa=${page - 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              ← Önceki
            </Link>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/makaleler?sayfa=${page + 1}`} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">
              Sonraki →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
