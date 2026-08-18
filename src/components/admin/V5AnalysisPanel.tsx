"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertPrediction, type PickInput } from "@/server/actions/prediction.actions";
import type { PickDetailsV2 } from "@/lib/methodology/muhakeme-format";

// 2026-08-16 — V5 motoru: V4'ün mekanik sinyal-sayımının YERİNE geçer (bkz.
// SmartAnalysisEditor.tsx). Claude çağrısı YAPMAZ — koşullu logit (Plackett-Luce) modeli
// 15 sürekli/ham özelliği TEK skorda birleştirip atları doğrudan kıyaslar (eşiklerle
// kutulamaz). Doğrulama: test top1=%33.8 (GA %28.0-40.6)/top3=%70.0 (GA %63.8-76.8),
// V4'ün AYNI test kümesinde canlı top1=%24.2/top3=%55.1'ini net geçiyor. Detaylar
// src/lib/methodology/v5-engine.ts başlık yorumunda.

type TumOzellikDetay = { kod: string; etiket: string; hamDeger: number; standartDeger: number; katki: number };
type V5At = {
  no: number;
  ad: string;
  teknikSira: number;
  karar: string;
  olasilik: number;
  details: PickDetailsV2;
  tumSinyaller?: TumOzellikDetay[];
};
type Runner = { id: string; no: number; name: string };
type BankoAdayiSonuc = { bankoAdayi: boolean; sebep: string };

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

/** Kaydedilmiş bir Pick.details'ten (PickDetailsV2) V5At'e yakın bir görünüm türetir —
 *  motoru yeniden ÇALIŞTIRMAZ. Olasılık, kod-garantili OLASILIK satırının metninden
 *  geri okunur (bkz. v5-engine.ts muhakemeUretV5). */
function savedPickToV5At(pick: SavedPick, runnersByNo: Map<number, Runner>): V5At | null {
  const d = pick.details as { versiyon?: number; karar?: string; satirlar?: { kod: string[]; aciklama: string }[] } | null;
  if (!d || d.versiyon !== 2 || !Array.isArray(d.satirlar)) return null;
  const olasilikSatiri = d.satirlar.find((s) => s.kod?.includes("OLASILIK"));
  const m = olasilikSatiri?.aciklama.match(/%([\d.]+)/);
  const olasilik = m ? parseFloat(m[1]) / 100 : 0;
  const noMatch = pick.runnerLabel.match(/^#(\d+)/);
  const no = noMatch ? parseInt(noMatch[1], 10) : 0;
  const runner = runnersByNo.get(no);
  return {
    no,
    ad: runner?.name ?? pick.runnerLabel.replace(/^#\d+\s*/, ""),
    teknikSira: pick.rank,
    karar: d.karar ?? "—",
    olasilik,
    details: d as PickDetailsV2,
  };
}

const KARAR_RENK: Record<string, string> = {
  "Güçlü Aday": "text-hit",
  "Düşük Risk": "text-emerald-500",
  "Orta Risk": "text-amber-500",
  "Yüksek Risk": "text-muted-foreground",
};

export default function V5AnalysisPanel({ raceId, runners: raceRunners, existingPrediction }: Props) {
  const router = useRouter();

  const kayitliBaslangic = (() => {
    if (!existingPrediction?.picks?.length || !raceRunners) return null;
    const runnersByNo = new Map(raceRunners.map((r) => [r.no, r]));
    const atlar = existingPrediction.picks
      .map((p) => savedPickToV5At(p, runnersByNo))
      .filter((a): a is V5At => !!a)
      .sort((a, b) => a.teknikSira - b.teknikSira);
    if (atlar.length === 0) return null;
    return {
      atlar,
      manualOrder: atlar.map((a) => a.no),
      runners: raceRunners.map((r) => ({ id: r.id, no: r.no, name: r.name })),
      bankoAdayi: existingPrediction.bankoNote ? { bankoAdayi: false, sebep: existingPrediction.bankoNote } : null,
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
  const [atlar, setAtlar] = useState<V5At[] | null>(kayitliBaslangic?.atlar ?? null);
  const [manualOrder, setManualOrder] = useState<number[]>(kayitliBaslangic?.manualOrder ?? []);
  const [runners, setRunners] = useState<Runner[]>(kayitliBaslangic?.runners ?? []);
  const [bankoAdayi, setBankoAdayi] = useState<BankoAdayiSonuc | null>(kayitliBaslangic?.bankoAdayi ?? null);
  const [kuponlar, setKuponlar] = useState<{ narrow?: string; normal?: string; wide?: string }>(kayitliBaslangic?.kuponlar ?? {});
  const [kaynak, setKaynak] = useState<"kayitli" | "canli" | null>(kayitliBaslangic ? "kayitli" : null);
  const [acikDetay, setAcikDetay] = useState<Set<number>>(new Set());

  function toggleDetay(no: number) {
    setAcikDetay((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  }

  async function handleCalistir() {
    setError(null);
    setAtlar(null);
    setManualOrder([]);
    setApplied(false);
    setBankoAdayi(null);
    setKaynak(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-v5-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const raw = await res.text();
      let data: {
        ok?: boolean;
        error?: string;
        atlar: V5At[];
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
      const sirali = manualOrder.map((no) => atlarByNo.get(no)).filter((a): a is V5At => !!a);
      const picks: PickInput[] = sirali.map((a, i) => {
        const runner = runnersByNo.get(a.no);
        return {
          rank: i + 1,
          runnerId: runner?.id,
          runnerLabel: runner ? `#${runner.no} ${runner.name}` : `#${a.no} ${a.ad}`,
          // 2026-08-16 kullanıcı kararı: Puan Tablosu'nda gerçek bir sayı görünsün —
          // V5'in kazanma olasılığı (%) 0-100 ölçeğe yuvarlanıp score'a yazılıyor.
          // V1-V22'nin eski "kalite skoru"ndan farklı bir anlamı var (bu gerçek, kalibre
          // edilmiş bir olasılık) ama Puan Tablosu ikisini de aynı sütunda gösterdiği
          // için karışıklık riski var — kullanıcı bunu bilerek kabul etti.
          score: Math.round(a.olasilik * 100),
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
      const res = await upsertPrediction({
        raceId,
        confidence: "ORTA",
        notes:
          "Bu analiz V5 motoruyla üretildi — koşullu logit (Plackett-Luce) modeli 18 özelliği (AGF trend/sıra/favori, Accurace, form eğimi, KGS, pist uzmanlığı, aygır/jokey/antrenör kazanma oranı, galop, kaçak at, düşüş-ama-iyi-pozisyon) TEK skorda birleştirip atları doğrudan kıyaslar. Claude muhakemesi kullanılmadı.",
        tempo: "V5 motoru koşullu logit skoruna dayanır, ayrı bir tempo/stil senaryosu üretmez.",
        couponNarrow: couponNarrow || undefined,
        couponNormal: couponNormal || undefined,
        couponWide: couponWide || undefined,
        isBanko: false,
        bankoNote: bankoAdayi?.sebep,
        picks,
      });
      if (res.publishError) {
        toast.warning(`Kaydedildi ama yayınlanamadı: ${res.publishError}`);
      } else {
        toast.success("V5 analizi kaydedildi ve yayınlandı");
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
          V5 — Koşullu Logit Modeli (18 özellik, atları doğrudan kıyaslar — Claude yok, maliyet sıfır)
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

      {error && <pre className="whitespace-pre-wrap rounded-md border border-miss/40 bg-miss/10 p-3 text-xs text-miss">{error}</pre>}

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
            const kodluSatirlar = a.details.satirlar.filter((s) => s.kod.length > 0 && !s.kod.includes("OLASILIK"));
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
                      %{(a.olasilik * 100).toFixed(1)}
                    </span>
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
                <p className="text-muted-foreground">
                  {kodluSatirlar.length > 0
                    ? kodluSatirlar.map((s) => `${s.tip === "risk" ? "⚠ " : ""}${s.aciklama}`).join(" · ")
                    : "Belirgin bir özellik katkısı yok."}
                </p>

                {a.tumSinyaller && (
                  <div className="border-t border-border/60 pt-1.5">
                    <button
                      onClick={() => toggleDetay(no)}
                      className="flex items-center gap-1 text-[11px] font-medium text-purple-500 hover:underline"
                    >
                      {acikDetay.has(no) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Tüm 18 Sinyal — Denetim Kaydı ({a.tumSinyaller.length}/18 hesaplandı)
                    </button>
                    {acikDetay.has(no) && (
                      <div className="mt-1.5 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-[10px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-1 pr-2 font-medium">Sinyal</th>
                              <th className="pb-1 pr-2 font-medium">Ham Değer</th>
                              <th className="pb-1 pr-2 font-medium">Standardize</th>
                              <th className="pb-1 font-medium">Model Katkısı</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.tumSinyaller.map((s) => (
                              <tr key={s.kod} className="border-t border-border/40">
                                <td className="py-1 pr-2 text-foreground/90">{s.etiket}</td>
                                <td className="py-1 pr-2 font-mono text-muted-foreground">{s.hamDeger}</td>
                                <td className="py-1 pr-2 font-mono text-muted-foreground">{s.standartDeger}</td>
                                <td className={cn("py-1 font-mono", s.katki > 0 ? "text-hit" : s.katki < 0 ? "text-miss" : "text-muted-foreground")}>
                                  {s.katki > 0 ? "+" : ""}{s.katki}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          Bu tablo, gerekçe metninde eşik altı kaldığı için görünmeyen sinyalleri de gösterir — modelin her at için 18 özelliğin TAMAMINI hesapladığının kanıtıdır.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
