"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Slide = { id: string; url: string; order: number; active: boolean };

export default function BannerManager({ initialSlides }: { initialSlides: Slide[] }) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-banner", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      setSlides((prev) => [...prev, data.slide]);
      toast.success("Slide eklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteSlide(id: string) {
    if (!confirm("Bu slide'ı silmek istediğine emin misin?")) return;
    const res = await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSlides((prev) => prev.filter((s) => s.id !== id));
      toast.success("Slide silindi");
    } else {
      toast.error("Silinemedi");
    }
  }

  async function toggleActive(slide: Slide) {
    const res = await fetch(`/api/admin/banners/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !slide.active }),
    });
    if (res.ok) {
      setSlides((prev) => prev.map((s) => s.id === slide.id ? { ...s, active: !s.active } : s));
    }
  }

  async function move(id: string, dir: "up" | "down") {
    const sorted = [...slides].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const newOrderA = b.order;
    const newOrderB = a.order;

    await Promise.all([
      fetch(`/api/admin/banners/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: newOrderA }) }),
      fetch(`/api/admin/banners/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: newOrderB }) }),
    ]);

    setSlides((prev) => prev.map((s) => {
      if (s.id === a.id) return { ...s, order: newOrderA };
      if (s.id === b.id) return { ...s, order: newOrderB };
      return s;
    }));
  }

  const sorted = [...slides].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Upload */}
      <label className={cn(
        "flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-brand/30 py-8 text-muted-foreground transition-colors hover:border-brand/60 hover:bg-brand/5",
        uploading && "pointer-events-none opacity-50"
      )}>
        <Upload className="h-5 w-5 text-brand/50" />
        <div>
          <span className="text-sm font-medium">{uploading ? "Yükleniyor…" : "Yeni slide ekle"}</span>
          <span className="ml-1.5 text-xs text-muted-foreground/70">JPEG/PNG/WebP · maks. 5 MB</span>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleUpload} disabled={uploading} />
      </label>

      {/* Slide list */}
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Henüz slide eklenmedi.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((slide, i) => (
            <div key={slide.id} className={cn(
              "flex gap-3 rounded-xl border p-3",
              !slide.active && "opacity-50"
            )}>
              {/* Thumbnail */}
              <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-md border">
                <Image src={slide.url} alt={`Slide ${i + 1}`} fill className="object-cover" unoptimized />
              </div>

              {/* Info + actions */}
              <div className="flex flex-1 flex-col justify-between">
                <p className="text-xs font-medium text-muted-foreground">Slide {i + 1}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(slide.id, "up")} disabled={i === 0} title="Yukarı taşı">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(slide.id, "down")} disabled={i === sorted.length - 1} title="Aşağı taşı">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(slide)} title={slide.active ? "Gizle" : "Göster"}>
                    {slide.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSlide(slide.id)} title="Sil">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Değişiklikler anında sitede geçerli olur (sayfa yenilenince).
        </p>
      )}
    </div>
  );
}
