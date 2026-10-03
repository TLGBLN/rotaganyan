"use client";

import { useForm } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertArticle, publishArticle } from "@/server/actions/article.actions";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe } from "lucide-react";

const TiptapEditor = dynamic(() => import("@/components/editor/TiptapEditor"), { ssr: false });

type ArticleType = "EDUCATIONAL" | "MAGAZINE";

type FormData = {
  type: ArticleType;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
};

type Props = {
  articleId?: string;
  defaultValues?: Partial<FormData & { body: string; published: boolean }>;
  xConnected?: boolean;
};

export default function ArticleForm({ articleId, defaultValues, xConnected }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(defaultValues?.body ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [publishing, startPublish] = useTransition();
  const savedId = articleId ?? null;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      type: defaultValues?.type ?? "EDUCATIONAL",
      title: defaultValues?.title ?? "",
      slug: defaultValues?.slug ?? "",
      excerpt: defaultValues?.excerpt ?? "",
      coverImage: defaultValues?.coverImage ?? "",
      category: defaultValues?.category ?? "",
      tags: defaultValues?.tags ?? "",
      metaTitle: defaultValues?.metaTitle ?? "",
      metaDescription: defaultValues?.metaDescription ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const result = await upsertArticle(articleId ?? null, {
        type: data.type,
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || undefined,
        body,
        coverImage: data.coverImage || undefined,
        category: data.category || undefined,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        metaTitle: data.metaTitle || undefined,
        metaDescription: data.metaDescription || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Makale kaydedildi");
        if (!articleId && result.id) {
          router.push(`/admin/makaleler/${result.id}`);
        } else {
          router.push("/admin/makaleler");
        }
      }
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePublish() {
    if (!savedId) return toast.error("Önce kaydedin");
    startPublish(async () => {
      await publishArticle(savedId);
      toast.success("Makale yayımlandı!");
      router.push("/admin/makaleler");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tür</Label>
          <select className="w-full rounded-md border bg-background px-2 py-2 text-sm" {...register("type")}>
            <option value="EDUCATIONAL">Rehber (Educational)</option>
            <option value="MAGAZINE">Magazin</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Input placeholder="Pedigri, Galop, AGF…" {...register("category")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Başlık</Label>
        <Input placeholder="Makale başlığı" {...register("title", { required: true })} />
        {errors.title && <p className="text-xs text-miss">Başlık zorunlu</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Slug (URL)</Label>
        <Input placeholder="makale-basligi" {...register("slug", { required: true })} />
        {errors.slug && <p className="text-xs text-miss">Slug zorunlu</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Özet</Label>
        <Textarea rows={2} placeholder="Kısa açıklama" {...register("excerpt")} />
      </div>

      <div className="space-y-1.5">
        <Label>İçerik</Label>
        <TiptapEditor content={body} onChange={setBody} placeholder="Makale içeriği…" />
      </div>

      <div className="space-y-1.5">
        <Label>Kapak Görseli URL</Label>
        <Input type="url" placeholder="https://…" {...register("coverImage")} />
      </div>

      <div className="space-y-1.5">
        <Label>Etiketler (virgülle)</Label>
        <Input placeholder="pedigri, galop, at yarışı" {...register("tags")} />
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Meta Başlık (max 70 karakter)</Label>
          <Input {...register("metaTitle")} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Meta Açıklama (max 160 karakter)</Label>
          <Textarea rows={2} {...register("metaDescription")} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {articleId ? "Güncelle" : "Kaydet"}
        </Button>

        {!defaultValues?.published && (
          <Button
            type="button"
            variant="outline"
            onClick={handlePublish}
            disabled={publishing || !savedId}
          >
            <Globe className="mr-2 h-3.5 w-3.5" />
            {publishing ? "Yayımlanıyor…" : "Yayımla"}
          </Button>
        )}

        <Button type="button" variant="ghost" onClick={() => router.push("/admin/makaleler")}>
          İptal
        </Button>

        {!defaultValues?.published && (
          <Badge
            variant={xConnected ? "default" : "secondary"}
            className="ml-auto self-center text-xs"
          >
            {xConnected ? "X bağlı — yayımlanınca otomatik tweetlenir" : "X bağlı değil"}
          </Badge>
        )}
      </div>
    </form>
  );
}
