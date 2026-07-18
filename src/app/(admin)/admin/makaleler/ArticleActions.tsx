"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { unpublishArticle, publishArticle, deleteArticle } from "@/server/actions/article.actions";
import { useTransition } from "react";
import { toast } from "sonner";

export default function ArticleActions({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  function togglePublish() {
    startTransition(async () => {
      try {
        if (published) {
          await unpublishArticle(id);
          toast.success("Yayından kaldırıldı");
        } else {
          await publishArticle(id);
          toast.success("Yayımlandı");
        }
        router.refresh();
      } catch {
        toast.error("İşlem başarısız oldu, tekrar deneyin.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Bu makaleyi kalıcı olarak silmek istediğinize emin misiniz?")) return;
    startDeleteTransition(async () => {
      try {
        await deleteArticle(id);
        toast.success("Makale silindi");
        router.refresh();
      } catch {
        toast.error("Silinemedi, tekrar deneyin.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/admin/makaleler/${id}`} className="text-xs text-brand hover:underline">
        Düzenle
      </Link>
      <button
        onClick={togglePublish}
        disabled={pending || deleting}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {pending ? "…" : published ? "Geri Al" : "Yayımla"}
      </button>
      <button
        onClick={handleDelete}
        disabled={pending || deleting}
        className="text-xs text-miss hover:underline disabled:opacity-50"
      >
        {deleting ? "…" : "Sil"}
      </button>
    </div>
  );
}
