"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFullReport } from "@/lib/md-report-parser";
import { ANALYSIS_REPORT_TEMPLATE } from "@/lib/methodology/report-template";

interface ParsedRunner {
  no: number;
  name: string;
  jockey?: string;
  weight?: number;
  agf?: number;
  sameJockey?: boolean;
  equipmentAdded?: string | null;
}

interface Props {
  raceId: string;
  raceLabel: string;
  defaultOpen?: boolean;
}

const PLACEHOLDER = `No | At | Jokey | Kilo | ΔKilo | AGF% | Notlar
1 | KARTAL | A.YILDIZ | 57.5 | -2 | 23.5 | sarı üçgen
2 | FIRTINA | M.DEMİR | 54 | 0 | 15.2 | sipiyere
3 | ŞIMŞEK | K.ÇELIK | 56 | 1 | 8.4 |`;

export default function MarkdownRaceInput({ raceId, raceLabel, defaultOpen = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [runners, setRunners] = useState<ParsedRunner[]>([]);

  async function submit() {
    if (!text.trim()) return;
    setStatus("loading");
    setMessage("");

    const fullReport = isFullReport(text);
    const endpoint = fullReport ? "/api/admin/parse-report" : "/api/admin/parse-md";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId, markdown: text }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Hata oluştu");
      return;
    }

    setStatus("ok");
    if (fullReport) {
      setMessage(`Tam rapor kaydedildi: ${data.picks} seçim, ${data.runners} at`);
      setRunners([]);
    } else {
      setMessage(`${data.updated} at kaydedildi`);
      setRunners(data.runners ?? []);
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          {raceLabel}
          {status === "ok" && (
            <span className="text-[10px] font-normal text-hit">{message}</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 p-4 space-y-3">
          {/* Format hint */}
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-mono bg-white/5 px-1 rounded">No | At | Jokey | Kilo | ΔKilo | AGF% | Notlar</span>
            <span className="ml-2">— Notlar: &quot;sarı üçgen&quot;, ekipman adı (sipiyere, bone…)</span>
            <br />
            <span className="text-brand">Tam ROTAGANYAN v1.6 analiz raporunu</span> (KOŞU KİMLİĞİ, GENEL PROGRAM, NİHAİ SIRALAMA ÖZET, KUPON dahil) doğrudan yapıştırabilirsiniz — otomatik algılanır.
          </p>

          {/* Şablonu yükle */}
          <button
            type="button"
            onClick={() => { setText(ANALYSIS_REPORT_TEMPLATE); setStatus("idle"); }}
            className="text-[11px] font-medium text-brand hover:underline"
          >
            v1.6 Şablonunu Yükle →
          </button>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setStatus("idle"); }}
            placeholder={PLACEHOLDER}
            rows={8}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-white/20 focus:border-brand/40 focus:outline-none resize-y"
          />

          {/* Error */}
          {status === "error" && (
            <div className="flex items-center gap-2 text-xs text-miss">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={status === "loading" || !text.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-black hover:bg-brand/90 disabled:opacity-50"
            >
              {status === "loading" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Kaydediliyor…</>
              ) : (
                "Kaydet & Analiz Et"
              )}
            </button>
          </div>

          {/* Mini preview after save */}
          {status === "ok" && runners.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">No</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">At</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Jokey</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Kilo</th>
                    <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">AGF%</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Notlar</th>
                  </tr>
                </thead>
                <tbody>
                  {runners.map((r, idx) => (
                    <tr key={`${r.no}-${idx}`} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.no}</td>
                      <td className="px-2 py-1.5 font-medium">
                        {r.name}
                        {r.sameJockey && <span className="ml-1 text-yellow-400 text-[9px]">▲</span>}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.jockey ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {r.weight != null ? r.weight : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-brand">
                        {r.agf != null ? `%${r.agf.toFixed(1)}` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.equipmentAdded ? (
                          <span className="text-hit text-[10px]">{r.equipmentAdded}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
