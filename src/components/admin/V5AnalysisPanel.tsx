"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertPrediction, type PickInput } from "@/server/actions/prediction.actions";
import type { PickDetailsV2 } from "@/lib/methodology/muhakeme-format";
import { CURRENT_ENGINE_LABEL } from "@/lib/methodology/v5-engine-label";

// 2026-08-16 — V5 motoru: V4'ün mekanik sinyal-sayımının YERİNE geçer (bkz.
// SmartAnalysisEditor.tsx). Claude çağrısı YAPMAZ — koşullu logit (Plackett-Luce) modeli
// 18 sürekli/ham özelliği TEK skorda birleştirip atları doğrudan kıyaslar (eşiklerle
// kutulamaz). Doğrulama (V5.1, 2026-08-19): test top1=%38.0 (GA %31.7-44.2)/top3=%70.2
// (GA %63.9-76.4). Detaylar src/lib/methodology/v5-engine.ts başlık yorumunda.

type TumOzellikDetay = { kod: string; etiket: string; hamDeger: number; standartDeger: number; katki: number };
type V5At = {
  no: number;
  ad: string;
  teknikSira: number;
  karar: string;
  olasilik: number;
  // 2026-08-29 — V6 Aşama 2 (bkz. plan): kayıtlı bir Pick'ten türetilen (savedPickToV5At)
  // görünümde YOK — yalnız canlı /api/admin/test-v5-engine cevabında geliyor, bu yüzden
  // opsiyonel. handleKaydet bunları PickInput'a taşır.
  probTop2?: number;
  probTop3?: number;
  marketBlindProb1?: number;
  // 2026-09-01 — "Saf Model" kıyası (kullanıcı talebi, KARDAHA vakası): marketBlindProb1
  // zaten vardı ama AGF'nin kendisiyle YAN YANA kıyaslanmıyordu. agfPayi/agfSirasi bu
  // kıyası (Saf Model % vs AGF % vs nihai Piyasa-Ayarlı %) mümkün kılmak için eklendi.
  agfPayi?: number;
  agfSirasi?: number;
  // 2026-09-02 — Saf Model Değer Terfisi (THEATER OF WAR vakası): fark>=5pp VE yeterli
  // sinyalSayisi varsa at artık koşulsuz ilk-6'ya taşınıyor — aşağıdaki rozet artık
  // YALNIZ bilgi amaçlı değil, bu atın GERÇEKTEN terfi ettiğini de gösteriyor.
  degerTerfisi?: "ilk3" | "ilk6" | null;
  // 2026-08-30 — B katmanı (bkz. plan: A/B/C Sinyal Katmanlama Mimarisi). "Tüm 12 Sinyal"
  // paneli yalnız A katmanını (12 özellik) listeler — B katmanı (şimdilik sireOrani/
  // düşük-şart) ORADA GÖRÜNMÜYOR, kullanıcı bunu fark edip sordu. Bu iki alan o boşluğu
  // dolduruyor: bu atta B katmanı fiilen uygulandı mı ve sireOrani'nin ham değeri neydi.
  bKatmaniUygulandiMi?: boolean;
  sireOrani?: number;
  // 2026-08-30 (V5.30) — Opus denetimi: bu iki B katmanı teriminin GERÇEK sayısal katkısı
  // (uygulandı/uygulanmadı booleanının ötesinde) önceden hiçbir yerde saklanmıyordu — ne
  // gerekçe metninde ne featureSnapshot'ta ölçülebiliyordu. Artık gerçek katkı burada da
  // taşınıyor, featureSnapshot'a (handleKaydet) ve amber denetim satırlarına besleniyor.
  bSireKatkisi?: number;
  bZeminMesafeKatkisi?: number;
  // 2026-08-30 — Zemin+Mesafe Deneyimi B katmanı (bkz. zemin-mesafe-deneyimi.actions.ts) —
  // sireOrani'nin AKSİNE TÜM kategorilerde uygulanıyor, kullanıcı kararıyla hiç gölge-test
  // tamamlanmadan canlıya alındı.
  zeminMesafeBKatmaniUygulandiMi?: boolean;
  zeminMesafeDeneyim?: number;
  zeminMesafeDeneyimSeviyesi?: "tam" | "kismi" | "yok";
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

const KATEGORI_ETIKET: Record<string, string> = {
  "1a": "Düşük-şart (Şartlı 1/27) ağırlık seti",
  "1b": "Düşük-şart (Maiden/Şartlı 19) ağırlık seti",
  // 2026-08-26 kullanıcı bulgusu: "Maiden/Satış" hibrit koşularda eskiden yanlışlıkla
  // "1b" (saf düşük-şart) gösteriliyordu — gerçekte düşük-şart+diğer HARMANLANIYOR
  // (bkz. v5-engine.ts hibritMaidenSatisMi/agirlikSetleriSec). Yalnız etiket yanlıştı,
  // skorlama hep doğruydu.
  hibrit: "Harmanlanmış (Düşük-şart + Diğer — Maiden/Satış hibrit)",
};

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
  // 2026-08-21 kullanıcı bulgusu (Bursa/ŞENGÜL SULTAN vakası): panel hangi ağırlık
  // setinin (düşük-şart/diğer) kullanıldığını hiç göstermiyordu — şeffaflık eksikliği.
  const [kategori, setKategori] = useState<string | null>(null);
  // 2026-08-22 kullanıcı bulgusu: başlıktaki sürüm/özellik-sayısı metni iki kez sabit
  // (hardcoded) yazılıp güncellenmeyi unutulmuştu — artık CURRENT_ENGINE_LABEL'den (gerçek
  // özellik sayısından türetilmiş) geliyor, elle güncelleme GEREKMİYOR.
  // 2026-08-27 kullanıcı talebi: "Analiz Et"e basmadan ÖNCE de görünsün — başlangıç
  // değeri artık import edilen sabitten geliyor (API cevabı gelince AYNI değerle
  // üzerine yazılır, davranış değişmez, yalnız ilk render'da da doğru gösterir).
  const [motorEtiketi, setMotorEtiketi] = useState<string | null>(CURRENT_ENGINE_LABEL);

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
    setKategori(null);
    setMotorEtiketi(null);
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
        kategori?: string;
        motorEtiketi?: string;
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
      setKategori(data.kategori ?? null);
      setMotorEtiketi(data.motorEtiketi ?? null);
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
          // 2026-08-29 — V6 Aşama 2: probTop2/probTop3/marketBlindProb1 yalnız canlı
          // ("canli") çalıştırmada dolu — "kayitli" kaynaktan (savedPickToV5At) gelen
          // atlar bunları taşımaz, undefined olarak Prisma'nın nullable alanına gider
          // (mevcut değeri SİLMEZ mi diye dikkat: bu zaten her kaydetmede picks
          // deleteMany+create ile TAMAMEN yeniden yazılıyor, üzerine yazma riski yok).
          probTop2: a.probTop2,
          probTop3: a.probTop3,
          marketBlindProb1: a.marketBlindProb1,
          // 2026-08-30 (V5.30) — Opus denetimi: tumSinyaller yalnız A katmanının 12
          // özelliğini kapsıyor, B katmanı (sireOrani/zeminMesafeDeneyim) hiç ölçülemiyordu.
          // bKatmani alanı bu boşluğu kapatıyor — canlı sonuçlar birikince B katmanı
          // sinyalleri de featureSnapshot z-skoru yöntemiyle denetlenebilecek.
          featureSnapshot: a.tumSinyaller
            ? {
                tumSinyaller: a.tumSinyaller,
                motorEtiketi,
                bKatmani: {
                  sireUygulandiMi: a.bKatmaniUygulandiMi ?? false,
                  sireKatkisi: a.bSireKatkisi ?? 0,
                  zeminMesafeUygulandiMi: a.zeminMesafeBKatmaniUygulandiMi ?? false,
                  zeminMesafeKatkisi: a.bZeminMesafeKatkisi ?? 0,
                },
              }
            : undefined,
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
        notes: `Bu analiz ${motorEtiketi ?? "V5 motoruyla"} üretildi — koşullu logit (Plackett-Luce) modeli AGF trend/sıra/favori/payı, Accurace, form eğimi, KGS, pist uzmanlığı, aygır/jokey/antrenör kazanma oranı, galop, idman jokeyi uyumu, uzun-ara galop takibi, rakipsiz kaçak, H2H (net skor + kilo-ayarlı), hız derecesi sinyallerini TEK skorda birleştirip atları doğrudan kıyaslar. Claude muhakemesi kullanılmadı.`,
        tempo: "V5 motoru koşullu logit skoruna dayanır, ayrı bir tempo/stil senaryosu üretmez.",
        couponNarrow: couponNarrow || undefined,
        couponNormal: couponNormal || undefined,
        couponWide: couponWide || undefined,
        // 2026-08-28 kullanıcı bulgusu: bu alan öncesinde SABİT `false` yazılıyordu —
        // ekranda "★ BANKO ADAYI" gösterilse bile kaydet/yayımla anında hep false
        // gönderiliyordu. V5 döneminde (16-27 Ağustos, 210 yarış) v5BankoAdayiTespit
        // 31 kez GERÇEKTEN tetiklenmiş (isabet %51.6) ama HİÇBİRİ hiç kaydedilmemiş.
        // Kontrol edildi: bu 31'in 30'u zaten AGF favorisiyle aynı (assertPublishSafe
        // kural 3'ü sorunsuz geçer), yalnız 1'i çakışırdı (o da kaybetmiş) — düzeltme
        // güvenli.
        isBanko: bankoAdayi?.bankoAdayi ?? false,
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

  // 2026-09-05 kullanıcı talebi ("analizler bittikten sonra bu alanda ... çekilen atla
  // ilgili açıklama yer alsın, başında ünlem işaretiyle") — KOPUK UÇURTMA vakasından
  // (İzmir K3, 2026-09-04: Saf Model onu 1.sırada görüyordu, AGF payı düşük olduğu için
  // final skor 4.'e çekmişti, at yine de kazandı) doğan bir özet notu. Banko kutusuyla
  // AYNI üst özet alanında, TEK TEK at kartlarına inmeden görünür. Eşik (3pp) BİLEREK
  // safModelDegerTerfisiUygula'nın terfi eşiklerinden (5pp ilk-6/8pp ilk-3) DAHA DÜŞÜK —
  // bu not yalnız bilgi amaçlı (KOPUK UÇURTMA'nın kendi vakası +3.8pp'ydi, mevcut 5pp
  // terfi eşiğini bile geçmemişti), sıralamayı/kararı HİÇ etkilemiyor.
  const CEKILEN_AT_ESIGI = 3;
  const cekilenAtNotlari = (() => {
    if (!atlar) return [];
    const gecerliAtlar = atlar.filter((x) => x.marketBlindProb1 != null && x.agfPayi != null && x.agfSirasi != null);
    if (gecerliAtlar.length === 0) return [];
    const safModelSirali = [...gecerliAtlar].sort((x, y) => (y.marketBlindProb1 ?? 0) - (x.marketBlindProb1 ?? 0));
    const safModelSiraByNo = new Map(safModelSirali.map((x, idx) => [x.no, idx + 1]));
    const notlar: string[] = [];
    for (const a of gecerliAtlar) {
      const safSira = safModelSiraByNo.get(a.no);
      if (safSira == null || safSira >= a.teknikSira) continue; // yalnız GERÇEKTEN aşağı çekilmişse
      const safYuzde = (a.marketBlindProb1 ?? 0) * 100;
      const fark = safYuzde - (a.agfPayi ?? 0);
      if (fark < CEKILEN_AT_ESIGI) continue;
      // 2026-09-05 — safModelDegerTerfisiUygula ile AYNI kalite filtresi: yalnız fark'a
      // bakmak yeterli değil, düşük AGF payı OLAN HER at matematiksel olarak pozitif bir
      // fark üretebiliyor (KOPUK UÇURTMA testi sırasında 11 attan 6'sı tetiklendi, çoğu
      // GERÇEKTEN zayıf atlar). AGF-dışı katkı toplamı net pozitif değilse (modelin kendi
      // GÖRÜŞÜ de zaten olumsuzsa) not üretilmez.
      const nonAgfToplam = (a.tumSinyaller ?? [])
        .filter((o) => !["agfSirasi", "agfPayi", "agfPayi2"].includes(o.kod))
        .reduce((s, o) => s + o.katki, 0);
      if (nonAgfToplam <= 0) continue;
      const destek: string[] = [];
      const bul = (kod: string) => a.tumSinyaller?.find((o) => o.kod === kod);
      const hiz = bul("hizDerecesi");
      if (hiz && hiz.hamDeger > 1) destek.push(`hızDerecesi +${hiz.hamDeger.toFixed(2)}`);
      const yakinsama = bul("yakinsama2Plus");
      if (yakinsama && yakinsama.hamDeger === 1) destek.push("yakınsama (2+ olumlu işaret) var");
      const h2h = bul("h2hNetSkor");
      if (h2h && h2h.hamDeger > 0) destek.push(`H2H net ${h2h.hamDeger}`);
      const destekMetni = destek.length > 0 ? ` — ${destek.slice(0, 2).join(", ")}.` : "";
      notlar.push(
        `#${a.no} ${a.ad}: Saf Model (AGF'siz) onu zaten ${safSira}. sırada (%${safYuzde.toFixed(1)}) görüyordu.${destekMetni} AGF payı düşük olduğu için (%${a.agfPayi!.toFixed(1)}, sıra ${a.agfSirasi}) harmanlanan skor onu ${a.teknikSira}.'e çekmiş.`
      );
    }
    return notlar;
  })();

  return (
    <div className="space-y-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
        <h3 className="min-w-0 text-sm font-semibold break-words">
          {motorEtiketi}
        </h3>
      </div>

      {kategori && (
        <div className="inline-block rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300">
          Bu koşuda kullanılan model: {KATEGORI_ETIKET[kategori] ?? "Genel (diğer koşular) ağırlık seti"}
        </div>
      )}

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

      {cekilenAtNotlari.length > 0 && (
        <div className="space-y-1.5">
          {cekilenAtNotlari.map((not, i) => (
            <div key={i} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
              <span className="font-semibold">! </span>
              {not}
            </div>
          ))}
        </div>
      )}

      {atlar && (
        <div className="space-y-1.5">
          {(() => {
            // 2026-09-01 — Saf Model sırası: marketBlindProb1'e göre sahadaki sırası
            // (AGF hiç yokmuş gibi model kime en çok güveniyor). agfSirasi zaten sunucudan
            // geliyor (yeniden hesaplamaya gerek yok). Yalnız canlı yeniden-analizde
            // (marketBlindProb1 dolu) anlamlı — kayıtlı eski Pick görünümünde sessizce
            // gizlenir (guard aşağıda, .safModelSirasi == null ise satır hiç basılmaz).
            const gecerliAtlar = atlar.filter((x) => x.marketBlindProb1 != null);
            const safModelSirali = [...gecerliAtlar].sort((x, y) => (y.marketBlindProb1 ?? 0) - (x.marketBlindProb1 ?? 0));
            const safModelSiraByNo = new Map(safModelSirali.map((x, idx) => [x.no, idx + 1]));
            return manualOrder.map((no, i) => {
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
                {/* 2026-09-03 kullanıcı talebi ("bu kısımlarda görsel olarak kötü gözüküyor,
                    alt alta madde halinde yaz") — bu dört madde eskiden başlık satırında
                    dar rozetler (rounded-full pill) olarak yan yana sıkışıyor, dar ekranda
                    ortasından bölünüyordu. Artık kodluSatirlar ile AYNI liste stilinde,
                    alt alta madde halinde. */}
                {(a.probTop3 != null || (a.marketBlindProb1 != null && a.agfPayi != null && a.agfSirasi != null) || a.bKatmaniUygulandiMi || a.zeminMesafeBKatmaniUygulandiMi) && (
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {/* 2026-08-29 — V6 Aşama 2 (bkz. plan): yalnız QA amaçlı, admin-only —
                        public gösterime henüz alınmadı, ayrı bir karar bekliyor. Kullanıcı
                        "T2/T3/körü" VE ardından "AGF'siz %18" kısaltmalarının kendi başına
                        anlaşılmadığını belirtti (2026-08-29) — artık her rakamın ne olduğu
                        tam kelimelerle, tooltip'e bakmaya gerek kalmadan yazılıyor. */}
                    {a.probTop3 != null && (
                      <li title="Bu üçü de yalnız bilgi amaçlı — sıralamayı/kararı ETKİLEMEZ. İlk 2'ye/3'e girme olasılığı: at yarışı bitince ilk 2 ya da ilk 3 içinde olma ihtimali (yalnız kazanma değil). AGF'siz kazanma ihtimali: AGF (bahis payı/piyasa favorisi) bilgisi TAMAMEN çıkarılıp yeniden hesaplanırsa modelin bu ata vereceği kazanma olasılığı — yani piyasa bu atı hiç tanımasaydı model ne düşünürdü.">
                        İlk 2&apos;ye girme: %{((a.probTop2 ?? 0) * 100).toFixed(0)} · İlk 3&apos;e girme: %{((a.probTop3 ?? 0) * 100).toFixed(0)} · AGF&apos;siz kazanma: %
                        {((a.marketBlindProb1 ?? 0) * 100).toFixed(0)}
                      </li>
                    )}
                    {/* 2026-09-01 — "Saf Model" kıyası (kullanıcı talebi, KARDAHA vakası):
                        Saf Model (AGF'siz, marketBlindProb1) / AGF (piyasa) / Piyasa-Ayarlı
                        (nihai olasilik) sıra+yüzde YAN YANA — piyasanın görmediği ama modelin
                        bağımsız olarak bulduğu değeri göstermek için. Fark = Saf Model% - AGF%.
                        2026-09-02 GÜNCELLEME (THEATER OF WAR vakası, kullanıcı kararı): bu
                        artık YALNIZ bilgi amaçlı DEĞİL — fark>=5pp VE AGF-dışı katkı toplamı
                        net pozitifse safModelDegerTerfisiUygula bu atı koşulsuz ilk-6'ya
                        taşıyor (bkz. v5-engine.ts). degerTerfisi="ilk3"/"ilk6" ise madde bunu belirtir
                        (V5.41 — ilk-3 için daha sıkı bir eşik, fark>=8pp, kullanılır). */}
                    {a.marketBlindProb1 != null && a.agfPayi != null && a.agfSirasi != null && (() => {
                      const safYuzde = a.marketBlindProb1 * 100;
                      const fark = safYuzde - a.agfPayi;
                      const safSira = safModelSiraByNo.get(a.no);
                      return (
                        <li
                          className={cn(a.degerTerfisi ? "text-hit" : fark >= 5 ? "text-amber-600" : "")}
                          title="Saf Model: AGF bilgisi HİÇ olmasaydı model bu atı sahada nereye koyardı (marketBlindProb1'in sıra+yüzdesi). AGF: piyasanın (bahis payının) kendi sırası+yüzdesi. Fark büyük ve pozitifse, model piyasanın görmediği bağımsız bir değer buluyor. Fark>=8pp ilk-3'e, >=5pp ilk-6'ya koşulsuz taşır (modelin AGF-dışı görüşü net pozitifse) — degerTerfisi bunu gösterir."
                        >
                          Saf Model: {safSira ?? "?"}. sıra (%{safYuzde.toFixed(1)}) · AGF: {a.agfSirasi}. sıra (%{a.agfPayi.toFixed(1)}) · Fark: {fark > 0 ? "+" : ""}{fark.toFixed(1)}pp
                          {a.degerTerfisi === "ilk3" && " · ✓ İlk-3 Terfisi"}
                          {a.degerTerfisi === "ilk6" && " · ✓ İlk-6 Terfisi"}
                        </li>
                      );
                    })()}
                    {/* 2026-08-30 — B katmanı görünürlüğü: "Tüm 12 Sinyal" paneli B
                        katmanını içermiyor, bu yüzden ayrı bir madde gerekiyor. */}
                    {a.bKatmaniUygulandiMi && (
                      <li
                        className="text-amber-600"
                        title="B katmanı (kanıtsız ama kullanıcı kararıyla eklenen istisna) bu atta uygulandı — mevcut 12 özellikten AYRI, düşük-şart'a özel bir terim olarak skora eklendi."
                      >
                        B: sireOrani ({(a.sireOrani ?? 0).toFixed(1)})
                      </li>
                    )}
                    {a.zeminMesafeBKatmaniUygulandiMi && (
                      <li
                        className="text-amber-600"
                        title="Zemin+Mesafe Deneyimi (hiç gölge-test edilmeden kullanıcı kararıyla eklenen istisna) bu atta uygulandı — TÜM kategorilerde, mevcut 12 özellikten AYRI bir terim olarak skora eklendi."
                      >
                        B: zeminMesafeDeneyim ({(a.zeminMesafeDeneyim ?? 0) > 0 ? "+" : ""}
                        {(a.zeminMesafeDeneyim ?? 0).toFixed(1)}%, {a.zeminMesafeDeneyimSeviyesi})
                      </li>
                    )}
                  </ul>
                )}
                {kodluSatirlar.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {kodluSatirlar.map((s, si) => (
                      <li key={si}>
                        {s.tip === "risk" ? "⚠ " : ""}
                        {s.aciklama}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Belirgin bir özellik katkısı yok.</p>
                )}

                {a.tumSinyaller && (
                  <div className="border-t border-border/60 pt-1.5">
                    <button
                      onClick={() => toggleDetay(no)}
                      className="flex items-center gap-1 text-[11px] font-medium text-purple-500 hover:underline"
                    >
                      {acikDetay.has(no) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {(() => {
                        const bSayisi = (a.bKatmaniUygulandiMi ? 1 : 0) + (a.zeminMesafeBKatmaniUygulandiMi ? 1 : 0);
                        const ek = bSayisi > 0 ? `+${bSayisi}` : "";
                        return (
                          <>
                            Tüm {a.tumSinyaller!.length} Sinyal{bSayisi > 0 ? ` + B Katmanı (${bSayisi})` : ""} — Denetim Kaydı ({a.tumSinyaller!.length}
                            {ek}/{a.tumSinyaller!.length}
                            {ek} hesaplandı)
                          </>
                        );
                      })()}
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
                            {/* 2026-08-30 (V5.30) — B katmanı bu tabloda AYRI bir satır olarak
                                gösteriliyor, A katmanının 12 özelliğiyle karışmasın diye amber
                                renkte işaretli. Opus denetimi öncesi bu satır katsayı/ortalama/
                                sapmayı v5-engine.ts'ten KOPYALAYIP burada yeniden hesaplıyordu —
                                iki yerde aynı sabitler ayrı ayrı güncellenmek zorunda kalıyordu,
                                drift riski. Artık gerçek katkı (r.bSireKatkisi) motor tarafında
                                hesaplanıp doğrudan taşınıyor, burada yeniden türetilmiyor. */}
                            {a.bKatmaniUygulandiMi && (
                              <tr className="border-t border-amber-500/30 bg-amber-500/5">
                                <td className="py-1 pr-2 text-amber-600">Sire Oranı (B katmanı)</td>
                                <td className="py-1 pr-2 font-mono text-amber-600/80">{(a.sireOrani ?? 0).toFixed(2)}</td>
                                <td className="py-1 pr-2 font-mono text-amber-600/80">—</td>
                                <td className="py-1 font-mono text-amber-600">
                                  {(a.bSireKatkisi ?? 0) >= 0 ? "+" : ""}
                                  {(a.bSireKatkisi ?? 0).toFixed(3)}
                                </td>
                              </tr>
                            )}
                            {/* 2026-08-30 (V5.30) — Zemin+Mesafe Deneyimi B katmanı — sireOrani
                                satırıyla AYNI desen, aynı sebeple gerçek katkı taşınıyor. */}
                            {a.zeminMesafeBKatmaniUygulandiMi && (
                              <tr className="border-t border-amber-500/30 bg-amber-500/5">
                                <td className="py-1 pr-2 text-amber-600">Zemin+Mesafe Deneyimi (B katmanı)</td>
                                <td className="py-1 pr-2 font-mono text-amber-600/80">
                                  {(a.zeminMesafeDeneyim ?? 0) > 0 ? "+" : ""}
                                  {(a.zeminMesafeDeneyim ?? 0).toFixed(1)}% ({a.zeminMesafeDeneyimSeviyesi})
                                </td>
                                <td className="py-1 pr-2 font-mono text-amber-600/80">—</td>
                                <td className="py-1 font-mono text-amber-600">
                                  {(a.bZeminMesafeKatkisi ?? 0) >= 0 ? "+" : ""}
                                  {(a.bZeminMesafeKatkisi ?? 0).toFixed(3)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          Bu tablo, gerekçe metninde eşik altı kaldığı için görünmeyen sinyalleri de gösterir — modelin her at için A katmanının {a.tumSinyaller!.length} özelliğinin TAMAMINI hesapladığının kanıtıdır{(a.bKatmaniUygulandiMi || a.zeminMesafeBKatmaniUygulandiMi) ? " (B katmanı ayrı satır(lar)da, amber renkte)" : ""}.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            });
          })()}
        </div>
      )}
    </div>
  );
}
