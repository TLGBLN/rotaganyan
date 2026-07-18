"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { markAllRead } from "./actions";

export default function MarkAllReadButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await markAllRead(userId);
      } catch {
        toast.error("İşlem başarısız oldu, tekrar deneyin.");
      }
    });
  }

  return (
    <form action={handleClick}>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-brand hover:underline disabled:opacity-50"
      >
        {pending ? "…" : "Tümünü okundu işaretle"}
      </button>
    </form>
  );
}
