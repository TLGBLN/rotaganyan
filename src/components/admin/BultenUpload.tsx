"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ExtractedRunner {
  no: number;
  name: string;
  jockey?: string;
  weight?: number;
  agf?: number;
  equipmentAdded?: string | null;
  sameJockey?: boolean;
}

interface Props {
  raceId: string;
  raceName: string;
}

export default function BultenUpload({ raceId, raceName }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [status, setStatus] = useState<"idle" | "analyzing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [runners, setRunners] = useState<ExtractedRunner[]>([]);

  function handleFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError("Sadece JPG, PNG veya WebP yükleyebilirsiniz.");
      return;
    }
    setError(null);
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function analyze() {
    if (!preview) return;
    setStatus("analyzing");
    setError(null);

    try {
      // Extract base64 without the data URL prefix
      const base64 = preview.split(",")[1];

      const res = await fetch("/api/admin/analyze-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId, imageBase64: base64, mediaType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Bir hata oluştu.");
        setStatus("error");
        return;
      }

      setRunners(data.runners ?? []);
      setStatus("done");
      // Refresh server component so analysis table shows new data
      router.refresh();
    } catch {
      setError("Ağ hatası. Tekrar deneyin.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      {status === "idle" || status === "error" ? (
        <div
          className="relative cursor-pointer rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center transition-colors hover:border-brand/40 hover:bg-brand/5"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onInputChange}
          />
          {preview ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-56 w-full overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Önizleme" className="h-full w-full object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">Değiştirmek için tıkla veya sürükle</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Upload className="h-10 w-10 opacity-30" />
              <div>
                <p className="text-sm font-medium">TJK bülten ekran görüntüsünü buraya sürükle</p>
                <p className="mt-1 text-xs">veya seçmek için tıkla · JPG, PNG, WebP</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-miss/30 bg-miss/5 px-4 py-3 text-xs text-miss">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Analyze button */}
      {preview && status !== "done" && (
        <button
          onClick={analyze}
          disabled={status === "analyzing"}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-black hover:bg-brand/90 disabled:opacity-60"
        >
          {status === "analyzing" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Claude görüntüyü analiz ediyor…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Bülteni Analiz Et
            </>
          )}
        </button>
      )}

      {/* Results */}
      {status === "done" && runners.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-hit">
            <CheckCircle className="h-4 w-4" />
            {runners.length} at çıkarıldı ve veritabanına kaydedildi
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">No</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">At</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Jokey</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Kilo</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">AGF%</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Takı</th>
                </tr>
              </thead>
              <tbody>
                {runners.map((r) => (
                  <tr key={r.no} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.no}</td>
                    <td className="px-3 py-2 font-medium">
                      {r.name}
                      {r.sameJockey && (
                        <span className="ml-1.5 text-[9px] text-yellow-400">▲</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.jockey ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.weight != null ? r.weight : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-brand">
                      {r.agf != null ? `%${r.agf.toFixed(1)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.equipmentAdded ? (
                        <span className="text-hit">{r.equipmentAdded}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setPreview(null);
                setStatus("idle");
                setRunners([]);
              }}
              className="rounded-lg border px-4 py-2.5 text-sm hover:bg-muted"
            >
              Yeni Ekran Görüntüsü Yükle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
