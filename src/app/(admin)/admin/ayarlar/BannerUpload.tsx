"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function BannerUpload({ currentUrl }: { currentUrl: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearPreview() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-banner", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      toast.success("Banner güncellendi! Değişiklik birkaç saniyede sitede görünür.");
      clearPreview();
      // sayfayı yenile — server component current banner'ı taze çeksin
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mevcut banner */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Mevcut Banner
        </p>
        <div className="overflow-hidden rounded-lg border">
          <Image
            src={currentUrl}
            alt="Mevcut banner"
            width={1200}
            height={393}
            className="w-full h-auto"
            unoptimized
          />
        </div>
      </div>

      {/* Yeni banner yükleme */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Yeni Banner Yükle
        </p>

        {preview ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border">
              <Image
                src={preview}
                alt="Önizleme"
                width={1200}
                height={393}
                className="w-full h-auto"
                unoptimized
              />
              <button
                onClick={clearPreview}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" />
                {uploading ? "Yükleniyor…" : "Banneri Yayınla"}
              </Button>
              <span className="text-xs text-muted-foreground">{file?.name}</span>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-brand/30 py-12 text-muted-foreground transition-colors hover:border-brand/60 hover:bg-brand/5">
            <Upload className="h-8 w-8 text-brand/40" />
            <div className="text-center">
              <p className="text-sm font-medium">Dosya seç veya buraya sürükle</p>
              <p className="mt-0.5 text-xs">JPEG, PNG, WebP — maks. 5 MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={onFileChange}
            />
          </label>
        )}
      </div>
    </div>
  );
}
