"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { activateProduct, deactivateProduct, deleteProduct } from "@/server/actions/product.actions";
import { useTransition } from "react";
import { toast } from "sonner";

export default function ProductActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      try {
        if (active) {
          await deactivateProduct(id);
          toast.success("Vitrinden kaldırıldı");
        } else {
          await activateProduct(id);
          toast.success("Vitrine eklendi");
        }
        router.refresh();
      } catch {
        toast.error("İşlem başarısız oldu, tekrar deneyin.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Bu ürünü kalıcı olarak silmek istediğinize emin misiniz?")) return;
    startDeleteTransition(async () => {
      try {
        await deleteProduct(id);
        toast.success("Ürün silindi");
        router.refresh();
      } catch {
        toast.error("Silinemedi, tekrar deneyin.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Link href={`/admin/urunler/${id}`} className="text-xs text-brand hover:underline">
        Düzenle
      </Link>
      <button
        onClick={toggleActive}
        disabled={pending || deleting}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {pending ? "…" : active ? "Vitrinden Kaldır" : "Vitrine Ekle"}
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
