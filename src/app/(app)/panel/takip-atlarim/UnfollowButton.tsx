"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { unfollowHorse } from "@/server/actions/horse-follow";

export default function UnfollowButton({ horseName }: { horseName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await unfollowHorse(horseName);
          router.refresh();
        })
      }
      title="Takipten çık"
      className="flex items-center gap-1 rounded border border-miss/40 px-2 py-1 text-xs text-miss hover:bg-miss/10 disabled:opacity-50 transition-colors shrink-0"
    >
      <X className="h-3 w-3" />
      Takipten Çık
    </button>
  );
}
