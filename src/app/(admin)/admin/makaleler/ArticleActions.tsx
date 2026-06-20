"use client";

import Link from "next/link";
import { unpublishArticle, publishArticle } from "@/server/actions/article.actions";
import { useTransition } from "react";
import { toast } from "sonner";

export default function ArticleActions({ id, published }: { id: string; published: boolean }) {
  const [pending, startTransition] = useTransition();

  function togglePublish() {
    startTransition(async () => {
      if (published) {
        await unpublishArticle(id);
        toast.success("Yayından kaldırıldı");
      } else {
        await publishArticle(id);
        toast.success("Yayımlandı");
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
        disabled={pending}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {pending ? "…" : published ? "Geri Al" : "Yayımla"}
      </button>
    </div>
  );
}
