"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PedigreeRating } from "@prisma/client";

const ALAN_LABEL: Record<string, string> = {
  hpBugun: "Bugünkü HP",
  hpOnceki: "Geçmiş HP (HP ivmesi)",
  tempoVeriN: "Tempo Örneklemi",
  agfSirasi: "AGF Sırası",
  formYonu: "Form Yönü",
};

const FAZ_LABEL: Record<"faz2" | "faz4", string> = {
  faz2: "Faz 1 + Faz 2 çalışıyor — veri toplama + skorlama…",
  faz4: "Faz 3 + Faz 4 çalışıyor — geçit motoru + sıralama/kupon…",
};

type Debug = {
  faz1VeriDoluluk: { alan: string; oran: number }[];
  gecitDurum: string;
  gecitUyari: string | null;
};

export type AIPickResult = {
  rank: number;
  no: number;
  name: string;
  score: number;
  pedigreeRating: PedigreeRating;
  isTarget: boolean;
  details: string[];
  note: string;
};

export type AIAnalysisResult = {
  picks: AIPickResult[];
  confidence: "DUSUK" | "ORTA" | "YUKSEK";
  isBanko: boolean;
  bankoNote: string;
  notes: string;
  tempo: string;
  couponNarrow: string;
  couponNormal: string;
  couponWide: string;
};

type Runner = { id: string; no: number; name: string };

type Props = {
  raceId: string;
  onApply: (result: AIAnalysisResult, runners: Runner[]) => void;
};

const CONFIDENCE_LABEL = { DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek" };
const PEDIGREE_LABEL: Record<PedigreeRating, string> = {
  COK_YUKSEK: "Çok Yüksek", YUKSEK: "Yüksek", GUCLU: "Güçlü", ORTA: "Orta",
  DUSUK: "Düşük", ZAYIF: "Zayıf", SORU: "Soru", BILINMIYOR: "?",
};

/** Sunucudan gelen yanıtı önce metin olarak okuyup öyle parse eder — sunucu JSON
 *  döndürmediyse (ör. Vercel'in platform zaman aşımı sayfası) ham "Unexpected token"
 *  parse hatası yerine anlaşılır bir mesaj fırlatır. */
async function fetchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: T & { ok?: boolean; error?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "Sunucudan geçerli bir yanıt gelmedi — muhtemelen istek çok uzun sürdü ve zaman aşımına uğradı. Az önce ödenen çağrı(lar) boşa gitmiş olabilir, lütfen tekrar deneyin."
    );
  }
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Hata");
  return data;
}

export default function AIAnalysisPanel({ raceId, onApply }: Props) {
  const [phase, setPhase] = useState<"faz2" | "faz4" | null>(null);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [debug, setDebug] = useState<Debug | null>(null);
  const [progress, setProgress] = useState(0);
  const loading = phase !== null;

  // Faz 2 ve Faz 4 artık ayrı isteklerde çalışıyor (bkz. /api/admin/oto-analiz-faz2 ve
  // -faz4 route'larındaki not: eskiden tek istekte çalışıyorlardı, toplamları bazı
  // koşularda 300s'lik Vercel sınırını aşıp fonksiyonu ortadan kesiyordu). Her fazın
  // kendi Claude çağrısı hâlâ ne kadar süreceği önceden bilinmediği için (SSE yok)
  // gerçek yüzde veremiyoruz, ama HANGİ fazda olduğumuzu artık gerçekten biliyoruz —
  // faz değişince şerit sıfırlanıp o fazın kendi süresi için yeniden %95'e yaklaşır.
  useEffect(() => {
    if (!phase) { setProgress(0); return; }
    const start = Date.now();
    const TIME_CONSTANT_MS = 45_000;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(95 * (1 - Math.exp(-elapsed / TIME_CONSTANT_MS)));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  async function handleEvaluate() {
    setError(null);
    setResult(null);
    setApplied(false);
    setDebug(null);
    try {
      setPhase("faz2");
      const step1 = await fetchJson<{ faz1: unknown; faz2: unknown; sharedContext: string }>(
        "/api/admin/oto-analiz-faz2",
        { raceId }
      );

      setPhase("faz4");
      const step2 = await fetchJson<{ result: AIAnalysisResult; runners: Runner[]; debug: Debug }>(
        "/api/admin/oto-analiz-faz4",
        { raceId, faz1: step1.faz1, faz2: step1.faz2, sharedContext: step1.sharedContext }
      );

      setResult(step2.result);
      setRunners(step2.runners ?? []);
      setDebug(step2.debug ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setPhase(null);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(result, runners);
    setApplied(true);
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold">Otomatik Analiz</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Metodoloji (v4.2) + geçit motoru + sitenin kendi verisiyle tamamen otomatik çalışır</span>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleEvaluate}
          disabled={loading}
          size="sm"
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analiz oluşturuluyor…" : "Otomatik Analiz Oluştur"}
        </Button>
        {result && (
          <Button
            onClick={handleApply}
            size="sm"
            variant={applied ? "outline" : "default"}
            className={cn("gap-1.5", applied && "border-hit text-hit")}
          >
            {applied ? <><CheckCircle className="h-3.5 w-3.5" /> Uygulandı</> : "Forma Uygula →"}
          </Button>
        )}
      </div>

      {phase && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">{FAZ_LABEL[phase]}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand/15">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="whitespace-pre-wrap rounded-lg border border-miss/30 bg-miss/10 px-3 py-2 text-xs text-miss">
          {error}
        </div>
      )}

      {debug && (debug.gecitUyari || debug.faz1VeriDoluluk.some((v) => v.oran < 0.9)) && (
        <div className="space-y-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Veri Durumu — dikkat
          </div>
          {debug.gecitUyari && (
            <p className="whitespace-pre-wrap text-muted-foreground">{debug.gecitUyari}</p>
          )}
          {debug.faz1VeriDoluluk.filter((v) => v.oran < 0.9).length > 0 && (
            <p className="text-muted-foreground">
              Eksik/zayıf veri:{" "}
              {debug.faz1VeriDoluluk
                .filter((v) => v.oran < 0.9)
                .map((v) => `${ALAN_LABEL[v.alan] ?? v.alan} (%${Math.round(v.oran * 100)})`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Pick tablosu */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-xs font-semibold">Final Sıralama</div>
            <div className="divide-y">
              {result.picks.map((pick) => (
                <div key={pick.rank} className="flex items-start gap-3 px-3 py-2">
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    pick.rank === 1 ? "bg-brand text-black" : "bg-muted text-muted-foreground"
                  )}>
                    {pick.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{pick.no} {pick.name}</span>
                      <span className="text-[10px] text-muted-foreground">puan:{pick.score}</span>
                      <span className="text-[10px] text-muted-foreground">{PEDIGREE_LABEL[pick.pedigreeRating]}</span>
                      {pick.isTarget && <span className="text-[10px] font-semibold text-brand">★ Hedef</span>}
                    </div>
                    {pick.details.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {pick.details.map((d) => (
                          <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{d}</span>
                        ))}
                      </div>
                    )}
                    {pick.note && (
                      <p className="mt-1 text-xs text-muted-foreground">{pick.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Güven</div>
              <div className="font-semibold">{CONFIDENCE_LABEL[result.confidence]}</div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Banko</div>
              <div className={cn("font-semibold", result.isBanko ? "text-brand" : "text-muted-foreground")}>
                {result.isBanko ? "★ Evet" : "Hayır"}
              </div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Tempo</div>
              <div>{result.tempo || "—"}</div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Kupon</div>
              <div className="font-mono">{result.couponNarrow} / {result.couponNormal} / {result.couponWide}</div>
            </div>
          </div>

          {result.notes && (
            <div className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
              {result.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
