"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertPrediction, type PickInput } from "@/server/actions/prediction.actions";
import { faz2PickDetaylari } from "@/lib/methodology/v2-engine";

// v6.51 — kullanıcı kararı 2026-08-03 ("hepsini hayata sok"): bu, "sıfırdan" tasarlanan
// V1-V22 + A-E muhakeme matrisi motorunun GERÇEK admin akışına bağlanmış hali —
// AIAnalysisPanel'in (eski 64-madde Faz2+Faz3) YANINDA, onu HİÇ değiştirmeden duruyor.
// Temel fark: Faz3 (sayısal puanlama) YOK — kullanıcı kararı, ek maliyet istemiyor. Bu
// yüzden kaydedilen picks'te score HER ZAMAN boş (null) kalır — PuanTablosu.tsx zaten
// score=null'da "—" yerine (bkz. o dosyadaki güncelleme) "karar" etiketini gösterir.
// Banko/kupon, Faz2'nin kendi teknikSira+karar alanlarına dayanan MEKANİK bir işarettir
// (faz2BankoAdayiTespit) — Faz3'ün gerçek 0-100 puanlamasından türetilen banko kadar
// güvenilir değildir, bu yüzden "Banko Adayı" dille sunulur, "Banko" dille değil.
type TestV2Pick = { no: number; ad: string; teknikSira: number; karar: string; muhakeme: string };
type Runner = { id: string; no: number; name: string };
type BankoAdayiSonuc = {
  bankoAdayi: boolean; sebep: string;
  birinci?: { no: number; ad: string; karar: string };
  ikinci?: { no: number; ad: string; karar: string };
};
type KaliteUyariSatiri = { no: number; ad: string; uyarilar: string[] };

type Props = { raceId: string };

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
    throw new Error("Sunucudan geçerli bir yanıt gelmedi — istek zaman aşımına uğramış olabilir, tekrar deneyin.");
  }
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Hata");
  return data;
}

export default function V2AnalysisPanel({ raceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atlar, setAtlar] = useState<TestV2Pick[] | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [bankoAdayi, setBankoAdayi] = useState<BankoAdayiSonuc | null>(null);
  const [kaliteUyarilari, setKaliteUyarilari] = useState<KaliteUyariSatiri[]>([]);
  const [tempoOzeti, setTempoOzeti] = useState<string>("");
  const [kuponlar, setKuponlar] = useState<{ narrow?: string; normal?: string; wide?: string }>({});

  async function handleCalistir() {
    setError(null);
    setAtlar(null);
    setApplied(false);
    setKaliteUyarilari([]);
    setBankoAdayi(null);
    setLoading(true);
    let wakeLock: WakeLockSentinel | null = null;
    try {
      wakeLock = await navigator.wakeLock?.request("screen");
    } catch { /* desteklenmiyor, sorun değil */ }

    try {
      const res = await fetchJson<{
        parsed: { atlar: TestV2Pick[] } | null;
        runners: Runner[];
        faz2BankoAdayi: BankoAdayiSonuc | null;
        faz2KaliteUyarilari: KaliteUyariSatiri[] | null;
        tempoOzeti: string;
        couponNarrow?: string; couponNormal?: string; couponWide?: string;
      }>("/api/admin/test-v2-engine", { raceId });

      if (!res.parsed?.atlar?.length) throw new Error("Faz2 yanıtı parse edilemedi.");
      setAtlar(res.parsed.atlar);
      setRunners(res.runners ?? []);
      setBankoAdayi(res.faz2BankoAdayi ?? null);
      setKaliteUyarilari((res.faz2KaliteUyarilari ?? []).filter((k) => k.uyarilar.length > 0));
      setTempoOzeti(res.tempoOzeti ?? "");
      setKuponlar({ narrow: res.couponNarrow, normal: res.couponNormal, wide: res.couponWide });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
      wakeLock?.release().catch(() => {});
    }
  }

  async function handleKaydet() {
    if (!atlar) return;
    setSaving(true);
    try {
      const runnersByNo = new Map(runners.map((r) => [r.no, r]));
      const sirali = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
      const picks: PickInput[] = sirali.map((a, i) => {
        const runner = runnersByNo.get(a.no);
        return {
          rank: i + 1,
          runnerId: runner?.id,
          runnerLabel: runner ? `#${runner.no} ${runner.name}` : `#${a.no} ${a.ad}`,
          // score BİLİNÇLİ OLARAK boş — Faz3 (sayısal puanlama) yok, bkz. dosya başı notu.
          score: undefined,
          details: faz2PickDetaylari(a.karar, a.muhakeme),
          pedigreeRating: "BILINMIYOR",
          isTarget: false,
        };
      });
      const res = await upsertPrediction({
        raceId,
        confidence: "ORTA",
        notes: "Bu analiz yeni V1-V22 motoruyla (Faz2 muhakeme) üretildi — sayısal puanlama yok, yalnız sıralama ve nitel değerlendirme (Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk).",
        tempo: tempoOzeti || undefined,
        couponNarrow: kuponlar.narrow || undefined,
        couponNormal: kuponlar.normal || undefined,
        couponWide: kuponlar.wide || undefined,
        isBanko: bankoAdayi?.bankoAdayi ?? false,
        bankoNote: bankoAdayi?.sebep,
        picks,
      });
      if (res.publishError) {
        toast.warning(`Kaydedildi ama yayınlanamadı: ${res.publishError}`);
      } else {
        toast.success("V2 analizi kaydedildi ve yayınlandı");
      }
      setApplied(true);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <h3 className="text-sm font-semibold">V2 Motoru — Deneysel (V1-V22, sayısal puanlama yok)</h3>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCalistir} disabled={loading} size="sm" className="gap-1.5" variant="outline">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analiz oluşturuluyor…" : "V2 ile Analiz Et"}
        </Button>
        {atlar && (
          <Button onClick={handleKaydet} disabled={saving} size="sm" variant={applied ? "outline" : "default"} className={cn("gap-1.5", applied && "border-hit text-hit")}>
            {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Kaydediliyor…</>) : applied ? (<><CheckCircle className="h-3.5 w-3.5" /> Kaydedildi</>) : "Kaydet ve Yayımla"}
          </Button>
        )}
      </div>

      {error && (
        <div className="whitespace-pre-wrap rounded-lg border border-miss/30 bg-miss/10 px-3 py-2 text-xs text-miss">{error}</div>
      )}

      {bankoAdayi && (
        <div className={cn("rounded-lg border px-3 py-2 text-xs", bankoAdayi.bankoAdayi ? "border-brand/40 bg-brand/10" : "")}>
          <span className={bankoAdayi.bankoAdayi ? "font-semibold text-brand" : "text-muted-foreground"}>
            {bankoAdayi.bankoAdayi ? "★ Banko Adayı: " : "Banko adayı yok: "}
          </span>
          {bankoAdayi.sebep}
        </div>
      )}

      {kaliteUyarilari.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Kaçırma Uyarıları — Elazığ 8.Koşu dersi
          </div>
          <ul className="space-y-1">
            {kaliteUyarilari.map((k) => (
              <li key={k.no}><span className="font-medium">#{k.no} {k.ad}:</span> <span className="text-muted-foreground">{k.uyarilar.join(" ")}</span></li>
            ))}
          </ul>
        </div>
      )}

      {atlar && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 text-xs font-semibold">Ön Teknik Sıra (nihai — Faz3 düzeltmesi yok)</div>
          <div className="divide-y">
            {[...atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => (
              <div key={a.no} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{a.teknikSira}</span>
                  <span className="font-semibold text-sm">#{a.no} {a.ad}</span>
                  <span className="text-[10px] font-semibold text-purple-500">{a.karar}</span>
                </div>
                <p className="mt-1 pl-8 text-[11px] text-muted-foreground">{a.muhakeme}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
