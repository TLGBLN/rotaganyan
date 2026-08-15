"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertPrediction, type PickInput } from "@/server/actions/prediction.actions";
import type { PickDetailsV2 } from "@/lib/methodology/muhakeme-format";

// 2026-08-14 — V4 motoru: eski V1-V22 serbest-Claude-muhakeme sisteminin (V2AnalysisPanel)
// YERİNE geçer (bkz. SmartAnalysisEditor.tsx). Claude çağrısı YAPMAZ — 6 doğrulanmış
// sinyalin (AGF trend yönü, Accurace en hızlı son 200m kapanışı, son yarış galibiyeti,
// KGS 14-30 gün, hipodrom+pist+mesafe uzmanlığı, aygır üst %20) mekanik sayımına göre
// sıralar (backtest: n=575, %29.7 galibiyet/%60.3 ilk3, 2026-08-14). Maliyet sıfır —
// V2'deki batching/wakeLock/truncation-retry karmaşıklığının hiçbiri gerekmiyor.

type V4At = {
  no: number;
  ad: string;
  teknikSira: number;
  karar: string;
  sinyalSayisi: number;
  etiketler: string[];
  agfTrendVeAccuraceBirlikte: boolean;
  details: PickDetailsV2;
};
type Runner = { id: string; no: number; name: string };
type BankoAdayiSonuc = { bankoAdayi: boolean; sebep: string };

// muhakemeUretV4'ün ürettiği 8 sayaç kodu — JOKEY (destek, sayaca dahil değil), JOKSTAT
// (bilgi amaçlı) ve SIRA (0-sinyal kod-garantisi) hariç. Kaydedilmiş bir analizi (details)
// ekrana geri koyarken sinyalSayisi/etiketler'i buradan yeniden türetiyoruz.
const SAYILAN_KODLAR = ["AGF", "ACC", "FORM", "KGS", "PIST", "SIRE", "GALOP", "IDMJOK"];

type SavedPick = {
  rank: number;
  runnerId?: string | null;
  runnerLabel: string;
  details: unknown;
};
type ExistingPrediction = {
  couponNarrow?: string | null;
  couponNormal?: string | null;
  couponWide?: string | null;
  bankoNote?: string | null;
  picks: SavedPick[];
};

type Props = { raceId: string; runners?: Runner[]; existingPrediction?: ExistingPrediction };

/** Kaydedilmiş bir Pick.details'ten (PickDetailsV2) V4At'e yakın bir görünüm türetir —
 *  motoru yeniden ÇALIŞTIRMAZ, yalnız daha önce hesaplanmış/kaydedilmiş sonucu gösterir. */
function savedPickToV4At(pick: SavedPick, runnersByNo: Map<number, Runner>): V4At | null {
  const d = pick.details as { versiyon?: number; karar?: string; satirlar?: { kod: string[]; aciklama: string }[] } | null;
  if (!d || d.versiyon !== 2 || !Array.isArray(d.satirlar)) return null;
  const sayilanSatirlar = d.satirlar.filter((s) => s.kod?.some((k) => SAYILAN_KODLAR.includes(k)));
  const noMatch = pick.runnerLabel.match(/^#(\d+)/);
  const no = noMatch ? parseInt(noMatch[1], 10) : 0;
  const runner = runnersByNo.get(no);
  return {
    no,
    ad: runner?.name ?? pick.runnerLabel.replace(/^#\d+\s*/, ""),
    teknikSira: pick.rank,
    karar: d.karar ?? "—",
    sinyalSayisi: sayilanSatirlar.length,
    etiketler: sayilanSatirlar.map((s) => s.aciklama),
    agfTrendVeAccuraceBirlikte:
      d.satirlar.some((s) => s.kod?.includes("AGF")) && d.satirlar.some((s) => s.kod?.includes("ACC")),
    details: d as PickDetailsV2,
  };
}

const KARAR_RENK: Record<string, string> = {
  "Güçlü Aday": "text-hit",
  "Düşük Risk": "text-emerald-500",
  "Orta Risk": "text-amber-500",
  "Yüksek Risk": "text-muted-foreground",
};

export default function V4AnalysisPanel({ raceId, runners: raceRunners, existingPrediction }: Props) {
  const router = useRouter();

  // Daha önce kaydedilmiş bir analiz varsa (existingPrediction.picks dolu), paneli motoru
  // yeniden çalıştırmadan o kayıtlı sonuçla açıyoruz — kullanıcı bulgusu 2026-08-15:
  // "yeniden analiz et" kısmına dönüldüğünde önceki analiz kayboluyordu, tekrar "Analiz
  // Et"e basmak (AGF trend gibi gün içinde değişen verilerle) FARKLI bir sonuç üretebiliyordu.
  const kayitliBaslangic = (() => {
    if (!existingPrediction?.picks?.length || !raceRunners) return null;
    const runnersByNo = new Map(raceRunners.map((r) => [r.no, r]));
    const atlar = existingPrediction.picks
      .map((p) => savedPickToV4At(p, runnersByNo))
      .filter((a): a is V4At => !!a)
      .sort((a, b) => a.teknikSira - b.teknikSira);
    if (atlar.length === 0) return null;
    return {
      atlar,
      manualOrder: atlar.map((a) => a.no),
      runners: raceRunners.map((r) => ({ id: r.id, no: r.no, name: r.name })),
      bankoAdayi: existingPrediction.bankoNote
        ? { bankoAdayi: false, sebep: existingPrediction.bankoNote }
        : null,
      kuponlar: {
        narrow: existingPrediction.couponNarrow ?? undefined,
        normal: existingPrediction.couponNormal ?? undefined,
        wide: existingPrediction.couponWide ?? undefined,
      },
    };
  })();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(!!kayitliBaslangic);
  const [error, setError] = useState<string | null>(null);
  const [atlar, setAtlar] = useState<V4At[] | null>(kayitliBaslangic?.atlar ?? null);
  const [manualOrder, setManualOrder] = useState<number[]>(kayitliBaslangic?.manualOrder ?? []);
  const [runners, setRunners] = useState<Runner[]>(kayitliBaslangic?.runners ?? []);
  const [bankoAdayi, setBankoAdayi] = useState<BankoAdayiSonuc | null>(kayitliBaslangic?.bankoAdayi ?? null);
  const [kuponlar, setKuponlar] = useState<{ narrow?: string; normal?: string; wide?: string }>(
    kayitliBaslangic?.kuponlar ?? {}
  );
  const [kaynak, setKaynak] = useState<"kayitli" | "canli" | null>(kayitliBaslangic ? "kayitli" : null);

  async function handleCalistir() {
    setError(null);
    setAtlar(null);
    setManualOrder([]);
    setApplied(false);
    setBankoAdayi(null);
    setKaynak(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-v4-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const raw = await res.text();
      let data: {
        ok?: boolean;
        error?: string;
        atlar: V4At[];
        runners: Runner[];
        bankoAdayi: BankoAdayiSonuc;
        couponNarrow?: string;
        couponNormal?: string;
        couponWide?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Sunucudan geçerli bir yanıt gelmedi — tekrar deneyin.");
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Hata");

      setAtlar(data.atlar);
      setManualOrder([...data.atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => a.no));
      setRunners(data.runners ?? []);
      setBankoAdayi(data.bankoAdayi ?? null);
      setKuponlar({ narrow: data.couponNarrow, normal: data.couponNormal, wide: data.couponWide });
      setKaynak("canli");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  function moveManual(no: number, direction: -1 | 1) {
    setManualOrder((prev) => {
      const idx = prev.indexOf(no);
      const swapWith = idx + direction;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  async function handleKaydet() {
    if (!atlar) return;
    setSaving(true);
    try {
      const runnersByNo = new Map(runners.map((r) => [r.no, r]));
      const atlarByNo = new Map(atlar.map((a) => [a.no, a]));
      const sirali = manualOrder.map((no) => atlarByNo.get(no)).filter((a): a is V4At => !!a);
      const picks: PickInput[] = sirali.map((a, i) => {
        const runner = runnersByNo.get(a.no);
        return {
          rank: i + 1,
          runnerId: runner?.id,
          runnerLabel: runner ? `#${runner.no} ${runner.name}` : `#${a.no} ${a.ad}`,
          score: undefined,
          details: a.details,
          pedigreeRating: "BILINMIYOR",
          isTarget: false,
        };
      });
      const orijinalSira = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => a.no);
      const manualDegisti = manualOrder.some((no, i) => orijinalSira[i] !== no);
      const noSirali = sirali.map((a) => a.no);
      const couponNarrow = manualDegisti ? noSirali.slice(0, 3).join("-") : kuponlar.narrow;
      const couponNormal = manualDegisti ? noSirali.slice(3, 6).join("-") : kuponlar.normal;
      const couponWide = manualDegisti ? noSirali.slice(6).join("-") : kuponlar.wide;
      // (4) assertPublishSafe: 2+ kaçak stilli at varken tempo boş bırakılamaz — V4 bu
      // veriyi toplamıyor (raceStyle V1-V22'nin dayandığı bir alan), bu yüzden her zaman
      // dolu bir açıklama gönderiyoruz, kural körlemesine tetiklenmesin.
      const res = await upsertPrediction({
        raceId,
        confidence: "ORTA",
        notes:
          "Bu analiz V4 motoruyla üretildi — 8 doğrulanmış sinyalin (AGF trend, Accurace en hızlı kapanış, son yarış galibiyeti, KGS 14-30, pist+mesafe uzmanlığı, aygır üst %20, keskin galop zinciri, idman jokeyi uyumu) mekanik sayımına dayanır. Claude muhakemesi kullanılmadı.",
        tempo: "V4 motoru mekanik sinyal sayımına dayanır, ayrı bir tempo/stil senaryosu üretmez.",
        couponNarrow: couponNarrow || undefined,
        couponNormal: couponNormal || undefined,
        couponWide: couponWide || undefined,
        // 2026-08-14 — kullanıcı kararı: V4'te sıralama artık AGF favorisine değil sinyal
        // sayısına göre belirleniyor, bu ikisi kasıtlı olarak farklılaşabilir (asıl amaç
        // piyasanın görmediğini bulmak). assertPublishSafe (3) "banko ise AGF favorisiyle
        // sistem 1.si aynı olmalı" kuralı bu yüzden V4'te sık sık gereksiz yere yayın
        // engelliyordu (ör. ŞAFAKATEŞ vakası) — "Banko Adayı" rozeti bilgi amaçlı UI'da
        // görünmeye devam eder, ama kayıtta ARTIK otomatik isBanko:true göndermiyoruz.
        // İsterse admin PredictionForm üzerinden elle banko işaretleyebilir.
        isBanko: false,
        bankoNote: bankoAdayi?.sebep,
        picks,
      });
      if (res.publishError) {
        toast.warning(`Kaydedildi ama yayınlanamadı: ${res.publishError}`);
      } else {
        toast.success("V4 analizi kaydedildi ve yayınlandı");
      }
      setApplied(true);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  const atlarByNo = new Map((atlar ?? []).map((a) => [a.no, a]));

  return (
    <div className="space-y-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <h3 className="text-sm font-semibold">
          V4 — 8 Sinyal Mekanik Motoru (AGF trend, Accurace, form, KGS, pist uzmanlığı, aygır, keskin galop zinciri, idman jokeyi uyumu — Claude yok, maliyet sıfır)
        </h3>
      </div>

      {kaynak === "kayitli" && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-300">
          Daha önce kaydedilmiş analiz gösteriliyor. Güncel veriyle (AGF gün içinde değişmiş olabilir) yeniden hesaplamak için &quot;Yeniden Analiz Et&quot;e bas.
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleCalistir} disabled={loading} size="sm" className="gap-1.5" variant="outline">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analiz ediliyor…" : kaynak === "kayitli" ? "Yeniden Analiz Et" : "Analiz Et"}
        </Button>
        {atlar && (
          <Button
            onClick={handleKaydet}
            disabled={saving}
            size="sm"
            variant={applied ? "outline" : "default"}
            className={cn("gap-1.5", applied && "border-hit text-hit")}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kaydediliyor…
              </>
            ) : applied ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" /> Kaydedildi
              </>
            ) : (
              "Kaydet ve Yayımla"
            )}
          </Button>
        )}
      </div>

      {error && (
        <pre className="whitespace-pre-wrap rounded-md border border-miss/40 bg-miss/10 p-3 text-xs text-miss">{error}</pre>
      )}

      {bankoAdayi && (
        <div className={cn("rounded-lg border px-3 py-2.5 text-xs", bankoAdayi.bankoAdayi ? "border-hit/40 bg-hit/10" : "border-border")}>
          <span className={cn("font-semibold", bankoAdayi.bankoAdayi ? "text-hit" : "text-muted-foreground")}>
            {bankoAdayi.bankoAdayi ? "★ BANKO ADAYI: " : "Banko adayı yok: "}
          </span>
          {bankoAdayi.sebep}
        </div>
      )}

      {atlar && (
        <div className="space-y-1.5">
          {manualOrder.map((no, i) => {
            const a = atlarByNo.get(no);
            if (!a) return null;
            return (
              <div key={no} className="space-y-1 rounded-lg border border-border bg-background p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{i + 1}.</span>
                    <span className="font-semibold">
                      #{a.no} {a.ad}
                    </span>
                    <span className={cn("font-medium", KARAR_RENK[a.karar] ?? "")}>{a.karar}</span>
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[11px] text-purple-600">
                      {a.sinyalSayisi}/8 sinyal
                    </span>
                    {a.agfTrendVeAccuraceBirlikte && (
                      <span className="rounded-full bg-hit/15 px-2 py-0.5 font-mono text-[11px] text-hit">AGF+ACC</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveManual(no, -1)} disabled={i === 0}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveManual(no, 1)}
                      disabled={i === manualOrder.length - 1}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground">{a.etiketler.join(" · ") || "Hiçbir sinyal taşımıyor."}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
