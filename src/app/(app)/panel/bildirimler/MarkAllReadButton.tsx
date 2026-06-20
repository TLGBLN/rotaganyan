"use client";

import { useTransition } from "react";
import { markAllRead } from "./actions";

export default function MarkAllReadButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <form action={() => { startTransition(() => markAllRead(userId)); }}>
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
