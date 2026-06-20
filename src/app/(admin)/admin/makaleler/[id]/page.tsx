import { notFound } from "next/navigation";
import { getAdminArticleById } from "@/server/services/article.service";
import ArticleForm from "@/components/admin/ArticleForm";
import { Badge } from "@/components/ui/badge";
import { X_CONFIGURED } from "@/lib/x";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditMakalePage({ params }: PageProps) {
  const { id } = await params;
  const article = await getAdminArticleById(id);
  if (!article) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">Makale Düzenle</h1>
        <Badge variant={article.published ? "default" : "secondary"}>
          {article.published ? "Yayında" : "Taslak"}
        </Badge>
      </div>
      <ArticleForm
        articleId={article.id}
        xConnected={X_CONFIGURED}
        defaultValues={{
          type: article.type,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt ?? "",
          body: article.body,
          coverImage: article.coverImage ?? "",
          category: article.category ?? "",
          tags: article.tags.join(", "),
          metaTitle: article.metaTitle ?? "",
          metaDescription: article.metaDescription ?? "",
          published: article.published,
        }}
      />
    </div>
  );
}
