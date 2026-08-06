"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { updateFollowNote } from "@/server/actions/horse-follow";

export default function FollowNoteEditor({ horseName, note }: { horseName: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      try {
        await updateFollowNote(horseName, value);
        setEditing(false);
        router.refresh();
      } catch {
        toast.error("Not kaydedilemedi, tekrar deneyin.");
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Örn. şartlı düşünce takip et"
          maxLength={140}
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          title="Kaydet"
          className="shrink-0 rounded p-1 text-hit hover:bg-hit/10 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { setValue(note ?? ""); setEditing(false); }}
          title="Vazgeç"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <PencilLine className="h-3 w-3 shrink-0" />
      {note || "Not ekle"}
    </button>
  );
}
