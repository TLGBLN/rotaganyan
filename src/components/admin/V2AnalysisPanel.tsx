"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, AlertTriangle, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
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
type BatchAt = { no: number; ad: string; karar: string; muhakeme: string };
type Runner = { id: string; no: number; name: string };
type BankoAdayiSonuc = {
  bankoAdayi: boolean; sebep: string;
  birinci?: { no: number; ad: string; karar: string };
  ikinci?: { no: number; ad: string; karar: string };
};
type KaliteUyariSatiri = { no: number; ad: string; uyarilar: string[] };
type KullanilmayanVeriSatiri = { no: number; ad: string; kullanilmayanKodlar: string[] };
type Top3TerfiSonuc = { no: number; ad: string; eskiSira: number; yeniSira: number };
type KararHiyerarsiDegisikligi = { no: number; ad: string; eskiSira: number; yeniSira: number };

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
  // v6.60 — kullanıcı bulgusu 2026-08-05: "Kaçırma Uyarıları" metni "elle yukarı al"
  // diyordu ama arayüzde bunu yapacak bir yol yoktu, liste yalnızca motorun teknikSira'sıyla
  // kaydediliyordu. manualOrder: admin'in seçtiği sıradaki "no" listesi — başlangıçta
  // teknikSira'dan türetilir, yukarı/aşağı okla değiştirilebilir, kayıt BUNU kullanır.
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [dragNo, setDragNo] = useState<number | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [bankoAdayi, setBankoAdayi] = useState<BankoAdayiSonuc | null>(null);
  const [kaliteUyarilari, setKaliteUyarilari] = useState<KaliteUyariSatiri[]>([]);
  const [siralamaUyarilari, setSiralamaUyarilari] = useState<KaliteUyariSatiri[]>([]);
  const [kararSiraUyarilari, setKararSiraUyarilari] = useState<KaliteUyariSatiri[]>([]);
  const [kullanilmayanVeri, setKullanilmayanVeri] = useState<KullanilmayanVeriSatiri[]>([]);
  const [top3Terfileri, setTop3Terfileri] = useState<Top3TerfiSonuc[]>([]);
  const [agf456Terfileri, setAgf456Terfileri] = useState<Top3TerfiSonuc[]>([]);
  const [gucluTop3Terfileri, setGucluTop3Terfileri] = useState<Top3TerfiSonuc[]>([]);
  const [agfFavoriTerfileri, setAgfFavoriTerfileri] = useState<Top3TerfiSonuc[]>([]);
  const [kararHiyerarsiDegisiklikleri, setKararHiyerarsiDegisiklikleri] = useState<KararHiyerarsiDegisikligi[]>([]);
  const [kullanilmayanVeriOnay, setKullanilmayanVeriOnay] = useState(false);
  const [tempoOzeti, setTempoOzeti] = useState<string>("");
  const [kuponlar, setKuponlar] = useState<{ narrow?: string; normal?: string; wide?: string }>({});
  const [asama, setAsama] = useState<string>("");

  // v6.54 — kullanıcı bulgusu 2026-08-04: tek istekte grup grup döngü, sunucuda
  // TÜMÜYLE başarıyla bitse bile (loglar kanıtladı) tarayıcıya "Failed to fetch" olarak
  // düşebiliyordu — dakikalarca hiç veri akışı olmadan açık kalan TEK bir HTTP isteği,
  // aradaki bir ağ katmanınca sessizce kesilebiliyor (kullanıcının kendi bağlantısı hiç
  // kopmasa bile). Eski sistem bunu hiç yaşamaz çünkü Faz1/Faz2/Faz3 üç AYRI fetch().
  // Şimdi burada da aynı desen: her grup ve sıralama ayrı bir fetch() — hiçbiri diğerini
  // beklerken bağlantıyı dakikalarca açık tutmuyor.
  async function handleCalistir() {
    setError(null);
    setAtlar(null);
    setManualOrder([]);
    setApplied(false);
    setKaliteUyarilari([]);
    setSiralamaUyarilari([]);
    setKararSiraUyarilari([]);
    setKullanilmayanVeri([]);
    setTop3Terfileri([]);
    setAgf456Terfileri([]);
    setGucluTop3Terfileri([]);
    setAgfFavoriTerfileri([]);
    setKararHiyerarsiDegisiklikleri([]);
    setKullanilmayanVeriOnay(false);
    setBankoAdayi(null);
    setLoading(true);
    let wakeLock: WakeLockSentinel | null = null;
    try {
      wakeLock = await navigator.wakeLock?.request("screen");
    } catch { /* desteklenmiyor, sorun değil */ }

    try {
      const allAtlar: BatchAt[] = [];
      let totalBatches = 1;
      let batchIndex = 0;
      do {
        setAsama(totalBatches > 1 ? `Grup ${batchIndex + 1}/${totalBatches} analiz ediliyor…` : "Analiz ediliyor…");
        const res = await fetchJson<{ atlar: BatchAt[]; totalBatches: number }>(
          "/api/admin/test-v2-engine",
          { raceId, step: "batch", batchIndex }
        );
        allAtlar.push(...res.atlar);
        totalBatches = res.totalBatches;
        batchIndex++;
      } while (batchIndex < totalBatches);

      setAsama("Nihai sıralama hesaplanıyor…");
      const res = await fetchJson<{
        parsed: { atlar: TestV2Pick[] } | null;
        runners: Runner[];
        faz2BankoAdayi: BankoAdayiSonuc | null;
        faz2KaliteUyarilari: KaliteUyariSatiri[] | null;
        faz2SiralamaUyarilari: KaliteUyariSatiri[] | null;
        faz2KararSiraUyarilari: KaliteUyariSatiri[] | null;
        faz2KullanilmayanVeri: KullanilmayanVeriSatiri[] | null;
        faz2Top3Terfileri: Top3TerfiSonuc[] | null;
        faz2Agf456Terfileri: Top3TerfiSonuc[] | null;
        faz2GucluTop3Terfileri: Top3TerfiSonuc[] | null;
        faz2AgfFavoriTerfileri: Top3TerfiSonuc[] | null;
        faz2KararHiyerarsiDegisiklikleri: KararHiyerarsiDegisikligi[] | null;
        tempoOzeti: string;
        couponNarrow?: string; couponNormal?: string; couponWide?: string;
      }>("/api/admin/test-v2-engine", { raceId, step: "rank", atlar: allAtlar });

      if (!res.parsed?.atlar?.length) throw new Error("Sıralama yanıtı parse edilemedi.");
      setAtlar(res.parsed.atlar);
      setManualOrder([...res.parsed.atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => a.no));
      setRunners(res.runners ?? []);
      setBankoAdayi(res.faz2BankoAdayi ?? null);
      setKaliteUyarilari((res.faz2KaliteUyarilari ?? []).filter((k) => k.uyarilar.length > 0));
      setSiralamaUyarilari((res.faz2SiralamaUyarilari ?? []).filter((k) => k.uyarilar.length > 0));
      setKararSiraUyarilari((res.faz2KararSiraUyarilari ?? []).filter((k) => k.uyarilar.length > 0));
      setKullanilmayanVeri(res.faz2KullanilmayanVeri ?? []);
      setTop3Terfileri(res.faz2Top3Terfileri ?? []);
      setAgf456Terfileri(res.faz2Agf456Terfileri ?? []);
      setGucluTop3Terfileri(res.faz2GucluTop3Terfileri ?? []);
      setAgfFavoriTerfileri(res.faz2AgfFavoriTerfileri ?? []);
      setKararHiyerarsiDegisiklikleri(res.faz2KararHiyerarsiDegisiklikleri ?? []);
      setTempoOzeti(res.tempoOzeti ?? "");
      setKuponlar({ narrow: res.couponNarrow, normal: res.couponNormal, wide: res.couponWide });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
      setAsama("");
      wakeLock?.release().catch(() => {});
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

  // v6.60 — kullanıcı talebi: ok tuşlarına ek olarak "tut çek" (sürükle-bırak) ile
  // sıralama. Ekstra kütüphane gerektirmez, tarayıcının kendi HTML5 drag API'si yeterli
  // — bu araç yalnız admin masaüstünde kullanıldığı için mobil dokunmatik desteği şart değil.
  function handleDrop(targetNo: number) {
    if (dragNo == null || dragNo === targetNo) { setDragNo(null); return; }
    setManualOrder((prev) => {
      const from = prev.indexOf(dragNo);
      const to = prev.indexOf(targetNo);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragNo);
      return next;
    });
    setDragNo(null);
  }

  async function handleKaydet() {
    if (!atlar) return;
    setSaving(true);
    try {
      const runnersByNo = new Map(runners.map((r) => [r.no, r]));
      const atlarByNo = new Map(atlar.map((a) => [a.no, a]));
      const sirali = manualOrder.map((no) => atlarByNo.get(no)).filter((a): a is TestV2Pick => !!a);
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
      // v6.60 — manuel sıralama değiştiyse kupon dilimleri de ona göre yeniden kesilir,
      // motorun ORİJİNAL (belki hatalı) sırasından kalma kuponlar kaydedilmez.
      const orijinalSira = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira).map((a) => a.no);
      const manualDegisti = manualOrder.some((no, i) => orijinalSira[i] !== no);
      const noSirali = sirali.map((a) => a.no);
      const couponNarrow = manualDegisti ? noSirali.slice(0, 3).join("-") : kuponlar.narrow;
      const couponNormal = manualDegisti ? noSirali.slice(3, 6).join("-") : kuponlar.normal;
      const couponWide = manualDegisti ? noSirali.slice(6).join("-") : kuponlar.wide;
      const res = await upsertPrediction({
        raceId,
        confidence: "ORTA",
        notes: "Bu analiz yeni V1-V22 motoruyla (Faz2 muhakeme) üretildi — sayısal puanlama yok, yalnız sıralama ve nitel değerlendirme (Güçlü Aday / Düşük Risk / Orta Risk / Yüksek Risk).",
        tempo: tempoOzeti || undefined,
        couponNarrow: couponNarrow || undefined,
        couponNormal: couponNormal || undefined,
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
        <h3 className="text-sm font-semibold">V3 Analiz Motoru — Deneysel (V1-V22 + Çapraz-Okuma X1-X7, sayısal puanlama yok)</h3>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCalistir} disabled={loading} size="sm" className="gap-1.5" variant="outline">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? (asama || "Analiz oluşturuluyor…") : "V3 ile Analiz Et"}
        </Button>
        {atlar && (
          <Button
            onClick={handleKaydet}
            disabled={saving || (kullanilmayanVeri.length > 0 && !kullanilmayanVeriOnay)}
            size="sm"
            variant={applied ? "outline" : "default"}
            className={cn("gap-1.5", applied && "border-hit text-hit")}
          >
            {saving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Kaydediliyor…</>) : applied ? (<><CheckCircle className="h-3.5 w-3.5" /> Kaydedildi</>) : "Kaydet ve Yayımla"}
          </Button>
        )}
      </div>

      {error && (
        <div className="whitespace-pre-wrap rounded-lg border border-miss/30 bg-miss/10 px-3 py-2 text-xs text-miss">{error}</div>
      )}

      {kullanilmayanVeri.length > 0 && (
        <div className="space-y-2 rounded-lg border-2 border-miss/50 bg-miss/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-miss">
            <AlertTriangle className="h-3.5 w-3.5" /> Kullanılmayan Veri — kaydetmeden önce onay gerekir
          </div>
          <p className="text-muted-foreground">
            İlk 2 sıradaki atlar için Faz1&apos;de gerçek veri bulunan ama muhakemede hiç geçmeyen kodlar (STARŞAH/PRENSES MEHLİKA dersi — veri var, kullanılmamış):
          </p>
          <ul className="space-y-1">
            {kullanilmayanVeri.map((k) => (
              <li key={k.no}><span className="font-medium">#{k.no} {k.ad}:</span> <span className="text-muted-foreground">{k.kullanilmayanKodlar.join(", ")}</span></li>
            ))}
          </ul>
          <label className="flex items-start gap-2 pt-1 font-medium text-foreground">
            <input
              type="checkbox"
              checked={kullanilmayanVeriOnay}
              onChange={(e) => setKullanilmayanVeriOnay(e.target.checked)}
              className="mt-0.5"
            />
            Bu kodları elle kontrol ettim, yine de kaydetmek istiyorum.
          </label>
        </div>
      )}

      {top3Terfileri.length > 0 && (
        <div className="space-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Sistem Terfisi — DAELLA dersi
          </div>
          <p className="text-muted-foreground">
            Sahanın #1 tarihsel kazanan stiliyle (n≥10 gerçek örneklem, &ldquo;Yüksek Risk&rdquo; değil) eşleşen atlar sıralama çağrısının kaçırmasına rağmen ilk 3&apos;e alındı:
          </p>
          <ul className="space-y-0.5">
            {top3Terfileri.map((t) => (
              <li key={t.no} className="font-medium">#{t.no} {t.ad}: {t.eskiSira}. sıra → {t.yeniSira}. sıra</li>
            ))}
          </ul>
        </div>
      )}

      {gucluTop3Terfileri.length > 0 && (
        <div className="space-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Güçlü Kombinasyon Terfisi — ilk 3
          </div>
          <p className="text-muted-foreground">
            AGF trend&apos;de (yükselen veya düşen) belirgin hareket + birden çok güçlü kod-garantili sinyal (V1/V19/V22) birlikte bulunan atlar ilk 3&apos;e koşulsuz alındı:
          </p>
          <ul className="space-y-0.5">
            {gucluTop3Terfileri.map((t) => (
              <li key={t.no} className="font-medium">#{t.no} {t.ad}: {t.eskiSira}. sıra → {t.yeniSira}. sıra</li>
            ))}
          </ul>
        </div>
      )}

      {agfFavoriTerfileri.length > 0 && (
        <div className="space-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> AGF Lideri Terfisi — düşüşe rağmen ilk 3
          </div>
          <p className="text-muted-foreground">
            Sahadaki gerçek AGF lideri, gün içinde belirgin düşüşe rağmen hâlâ favori kaldığı için ilk 3&apos;e koşulsuz alındı (TÜRKÖREN dersi, 2026-08-09):
          </p>
          <ul className="space-y-0.5">
            {agfFavoriTerfileri.map((t) => (
              <li key={t.no} className="font-medium">#{t.no} {t.ad}: {t.eskiSira}. sıra → {t.yeniSira}. sıra</li>
            ))}
          </ul>
        </div>
      )}

      {agf456Terfileri.length > 0 && (
        <div className="space-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> AGF Trend Terfisi — 4-5-6
          </div>
          <p className="text-muted-foreground">
            Gün içinde parası belirgin şekilde yükselen veya düşen diğer atlar analiz gücüne göre 4-5-6 sırasına koşulsuz alındı:
          </p>
          <ul className="space-y-0.5">
            {agf456Terfileri.map((t) => (
              <li key={t.no} className="font-medium">#{t.no} {t.ad}: {t.eskiSira}. sıra → {t.yeniSira}. sıra</li>
            ))}
          </ul>
        </div>
      )}

      {kararHiyerarsiDegisiklikleri.length > 0 && (
        <div className="space-y-1 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Karar Hiyerarşisi Düzeltmesi — İstanbul 1.Koşu dersi
          </div>
          <p className="text-muted-foreground">
            Güçlü Aday &gt; Düşük Risk &gt; Orta Risk &gt; Yüksek Risk hiyerarşisi koşulsuz uygulandı:
          </p>
          <ul className="space-y-0.5">
            {kararHiyerarsiDegisiklikleri.map((d) => (
              <li key={d.no} className="font-medium">#{d.no} {d.ad}: {d.eskiSira}. sıra → {d.yeniSira}. sıra</li>
            ))}
          </ul>
        </div>
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

      {siralamaUyarilari.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Sıralama Tutarsızlığı — WOLF SEYFO dersi
          </div>
          <ul className="space-y-1">
            {siralamaUyarilari.map((k) => (
              <li key={k.no}><span className="font-medium">#{k.no} {k.ad}:</span> <span className="text-muted-foreground">{k.uyarilar.join(" ")}</span></li>
            ))}
          </ul>
        </div>
      )}

      {kararSiraUyarilari.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Karar-Sıra Tutarsızlığı — büyük saha dersi
          </div>
          <ul className="space-y-1">
            {kararSiraUyarilari.map((k) => (
              <li key={k.no}><span className="font-medium">#{k.no} {k.ad}:</span> <span className="text-muted-foreground">{k.uyarilar.join(" ")}</span></li>
            ))}
          </ul>
        </div>
      )}

      {atlar && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 text-xs font-semibold">
            Ön Teknik Sıra (nihai — Faz3 düzeltmesi yok) — sürükleyerek veya okla manuel sıralayabilirsiniz
          </div>
          <div className="divide-y">
            {manualOrder.map((no, i) => {
              const a = atlar.find((x) => x.no === no);
              if (!a) return null;
              const degisti = a.teknikSira !== i + 1;
              return (
                <div
                  key={a.no}
                  className={cn("px-3 py-2", dragNo === a.no && "opacity-40")}
                  draggable
                  onDragStart={() => setDragNo(a.no)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(a.no)}
                  onDragEnd={() => setDragNo(null)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        onClick={() => moveManual(a.no, -1)}
                        disabled={i === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        aria-label="Yukarı taşı"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveManual(a.no, 1)}
                        disabled={i === manualOrder.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        aria-label="Aşağı taşı"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                    {degisti && (
                      <span className="text-[10px] text-muted-foreground line-through shrink-0" title="Motorun önerdiği sıra">
                        {a.teknikSira}
                      </span>
                    )}
                    <span className="font-semibold text-sm">#{a.no} {a.ad}</span>
                    <span className="text-[10px] font-semibold text-purple-500">{a.karar}</span>
                  </div>
                  <p className="mt-1 pl-14 text-[11px] text-muted-foreground">{a.muhakeme}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
