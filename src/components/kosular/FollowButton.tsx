"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Bookmark, BookmarkCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleHorseFollow, updateFollowNote } from "@/server/actions/horse-follow";

type Props = {
  horseName: string;
  initialFollowing: boolean;
  initialNote?: string | null;
};

export default function FollowButton({ horseName, initialFollowing, initialNote }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [note, setNote] = useState(initialNote ?? "");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleHorseFollow(horseName, note);
      setFollowing(result.following);
      if (!result.following) setOpen(false);
    });
  }

  function handleSaveNote() {
    startTransition(async () => {
      await updateFollowNote(horseName, note);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        title={following ? "Takiptesin · düzenle" : "Takip et"}
        className={cn(
          "flex items-center rounded px-1 py-0.5 transition-colors",
          following
            ? "text-brand hover:text-brand/80"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {following ? (
          <BookmarkCheck className="h-3 w-3" />
        ) : (
          <Bookmark className="h-3 w-3" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-50 w-52 rounded-lg border bg-background p-3 shadow-lg">
          <p className="mb-1.5 text-[11px] font-semibold truncate">{horseName}</p>
          <textarea
            className="w-full resize-none rounded border bg-muted/30 px-2 py-1.5 text-xs outline-none focus:border-brand"
            rows={2}
            placeholder="Not ekle (opsiyonel)…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-2 flex gap-1.5">
            {following ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Kaydet
                </button>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1 rounded border border-miss/50 px-2 py-1 text-[11px] text-miss hover:bg-miss/10 disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Çık
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-brand px-2 py-1 text-[11px] font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  <BookmarkCheck className="h-3 w-3" /> Takip Et
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
