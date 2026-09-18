"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleArticleLike } from "@/server/actions/article-like.actions";

type Props = {
  articleId: string;
  slug: string;
  initialTotal: number;
  initialLikedByMe: boolean;
};

export default function ArticleLikeButton({ articleId, slug, initialTotal, initialLikedByMe }: Props) {
  const [total, setTotal] = useState(initialTotal);
  const [liked, setLiked] = useState(initialLikedByMe);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Kart genelinde Link olabilir (makale listesi) — tıklama yukarı sızıp sayfaya
    // navigasyon tetiklemesin.
    e.preventDefault();
    e.stopPropagation();
    // İyimser güncelleme — sunucu hata döndürürse (ör. giriş yapılmamış) geri alınır.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setTotal((t) => t + (nextLiked ? 1 : -1));

    startTransition(async () => {
      try {
        const result = await toggleArticleLike(articleId, slug);
        setLiked(result.liked);
      } catch (e) {
        setLiked(!nextLiked);
        setTotal((t) => t + (nextLiked ? -1 : 1));
        toast.error(e instanceof Error ? e.message : "Beğeni kaydedilemedi");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={liked ? "Beğenmekten vazgeç" : "Beğen"}
      aria-label={liked ? "Beğenmekten vazgeç" : "Beğen"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border p-2 text-sm font-medium transition-colors disabled:opacity-60",
        liked
          ? "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20"
          : "border-muted-foreground/25 text-muted-foreground hover:bg-muted"
      )}
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} />
      <span className="tabular-nums">{total}</span>
    </button>
  );
}
