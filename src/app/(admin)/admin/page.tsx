import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
  getArchiveStats,
  getGunlukBasariOzeti,
} from "@/server/services/admin.service";
import { getAnalizPerformansOzeti } from "@/server/services/analiz-performans.service";
import { getAgfTrendIstatistik } from "@/server/services/agf-trend-istatistik.service";
import { getAylikKuponKazanci } from "@/server/services/race.service";
import { getIzleme } from "@/server/services/izleme.service";
import { getKuponTutma } from "@/server/services/kupon-tutma.service";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import PerformansDenetimiPanel from "@/components/admin/PerformansDenetimiPanel";
import AylikKuponKazanciCard from "@/components/home/AylikKuponKazanciCard";
import type { CouponTierBreakdown } from "@/server/services/admin.service";
import NarrativeSummary from "@/components/admin/NarrativeSummary";
import DailyTrendChart from "@/components/admin/DailyTrendChart";
import RecentFeed from "@/components/admin/RecentFeed";
import PendingList from "@/components/admin/PendingList";
import AdminRefresh from "@/components/admin/AdminRefresh";
import ArchiveStatsWidget from "@/components/admin/ArchiveStatsWidget";
import GunlukBasariPanel from "@/components/admin/GunlukBasariPanel";
import { DurumOzeti, modelIsigi, kuponIsigi, veriIsigi, ModelGenelGorunumu, SurumKarsilastirma, TipPerformansi, KalibrasyonKarti, BankoKarti, KuponPerformansi, SinyalSagligi, VeriGuncelligi } from "@/components/admin/izleme/IzlemeBolumleri";
import { Bolum, IcgoruBandi, KatlanirGrup } from "@/components/admin/izleme/ui";

export const dynamic = "force-dynamic";

/** İzleme servisleri hata verirse (ör. DB geçici sorun) sayfanın geri kalanı çalışmaya devam eder. */
async function guvenli<T>(p: Promise<T>, ad: string): Promise<T | null> {
  try { return await p; } catch (e) { console.error(`[admin dashboard] ${ad} hesaplanamadı:`, e); return null; }
}

export default async function AdminDashboard() {
  const [
    izleme, kuponTutma, stats, analyst, recentPredictions, pendingPredictions,
    archiveStats, performansOzeti, agfTrendIstatistik, aylikKuponKazanci, gunlukBasariOzeti,
  ] = await Promise.all([
    guvenli(getIzleme(), "izleme"),
    guvenli(getKuponTutma(), "kupon tutma"),
    getDashboardStats(),
    // Eski (V5 dönemi) özetler: GUNCEL_MOTOR_BASLANGIC'ten itibaren TÜM model sürümlerini karıştırır — "Geçmiş Dönem" bölümünde.
    getAnalystStats(undefined, true),
    getRecentPredictions(16),
    getPendingPredictions(),
    getArchiveStats(),
    getAnalizPerformansOzeti(),
    getAgfTrendIstatistik(),
    getAylikKuponKazanci(),
    getGunlukBasariOzeti(),
  ]);

  const hasData = analyst.overall.total > 0;
  const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
  const last10 = analyst.recentTrend.slice(-10);
  const last10Hits = last10.filter(Boolean).length;
  const couponTier = analyst.overallCouponTier;

  // Koşu tipi alt sınıfları (ŞARTLI 1, 2, ...) çoğu n<5 gürültü — üst grup toplamına indirgenir.
  const couponTierByGroup: CouponTierBreakdown[] = Object.values(
    analyst.couponTierByClassType.reduce<Record<string, CouponTierBreakdown>>((acc, r) => {
      const key = r.group ?? r.label;
      const entry = acc[key] ?? { label: key, total: 0, ekonomik: 0, normal: 0, genis: 0, kacti: 0 };
      entry.total += r.total; entry.ekonomik += r.ekonomik; entry.normal += r.normal; entry.genis += r.genis; entry.kacti += r.kacti;
      acc[key] = entry;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const trendStats = {
    overall: analyst.overall,
    coupon: couponTier.total >= 1 ? { hits: couponTier.ekonomik, total: couponTier.total, rate: (couponTier.ekonomik / couponTier.total) * 100 } : undefined,
    banko: banko && banko.total >= 1 ? { rate: banko.rate, hits: banko.hits, total: banko.total } : undefined,
    last10: { rate: last10.length > 0 ? (last10Hits / last10.length) * 100 : 0, hits: last10Hits },
    last10Count: last10.length,
    pending: stats.pendingResults,
  };

  return (
    <div className="space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <AdminRefresh />
        </div>
        <span className="text-xs text-muted-foreground">
          {stats.totalPredictions} toplam tahmin · {stats.pendingResults} sonuç bekleyen
        </span>
      </div>

      {/* ── 0) Tek bakışta durum: üç trafik ışığı ───────────────────────── */}
      <DurumOzeti v={izleme} k={kuponTutma} />

      {/* ── Detay grupları (kapalı gelir; ışığı yeşil/altın olmayan alanı açıp bakın) ── */}
      <KatlanirGrup baslik="Model Detayı" aciklama="Genel görünüm, sürüm karşılaştırması, koşu tipi, kalibrasyon, banko" ton={modelIsigi(izleme).ton}>
        {izleme ? (
          <>
            <ModelGenelGorunumu v={izleme} />
            <SurumKarsilastirma v={izleme} />
            <TipPerformansi v={izleme} />
            <KalibrasyonKarti v={izleme} />
            <BankoKarti v={izleme} />
          </>
        ) : (
          <Bolum baslik="Model İzleme" aciklama="Canlı izleme verisi şu anda hesaplanamadı.">
            <IcgoruBandi ton="kirmizi">İzleme servisi hata verdi (sunucu günlüğüne yazıldı). Sayfanın geri kalanı çalışıyor; birkaç dakika sonra yenileyin.</IcgoruBandi>
          </Bolum>
        )}
      </KatlanirGrup>

      <KatlanirGrup baslik="Kupon Detayı" aciklama="Son 30 gün tutma oranı ve kazanç, aylık kupon kazancı, günlük başarı" ton={kuponIsigi(kuponTutma).ton}>
        {kuponTutma && <KuponPerformansi k={kuponTutma} />}
        <AylikKuponKazanciCard aylar={aylikKuponKazanci} />
        <GunlukBasariPanel ozet={gunlukBasariOzeti} />
      </KatlanirGrup>

      <KatlanirGrup baslik="Sinyal ve Veri Sağlığı" aciklama="Her sinyalin canlı gözlem oranı, AGF/sonuç/tahmin güncelliği" ton={veriIsigi(izleme).ton}>
        {izleme && <SinyalSagligi v={izleme} />}
        {izleme && <VeriGuncelligi v={izleme} />}
      </KatlanirGrup>

      <KatlanirGrup baslik="Operasyon" aciklama="Arşiv kapsamı, son tahminler, sonuç bekleyenler">
        <ArchiveStatsWidget {...archiveStats} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><RecentFeed predictions={recentPredictions} /></div>
          <PendingList pending={pendingPredictions} />
        </div>
      </KatlanirGrup>

      {/* ── 6) Geçmiş dönem (V5, farklı modeller karışık) — kapalı ───────────────── */}
      <details className="group rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold sm:text-lg">
          <span aria-hidden className="inline-block h-4 w-1 rounded-full bg-muted-foreground/40 sm:h-5" />
          Geçmiş Dönem — V5 (16 Ağustos&apos;tan beri, farklı modeller karışık)
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">göster</span>
          <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">gizle</span>
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Bu bölüm AGF&apos;li V5 döneminden başlayarak TÜM model sürümlerini tek yüzdede toplar; güncel Saf Model&apos;i yansıtmaz. Karar için yukarıdaki canlı izleme bölümlerini esas alın.
        </p>
        <div className="mt-4 space-y-4">
          <NarrativeSummary analyst={analyst} pendingResults={stats.pendingResults} />
          <PerformansDenetimiPanel ozet={performansOzeti} agfTrendIstatistik={agfTrendIstatistik} />
          <DailyTrendChart cumulativeTrend={analyst.cumulativeTrend} overallRate={analyst.overall.rate} stats={trendStats} />
          {hasData && (
            <>
              <CouponTierChart rows={[analyst.overallCouponTier]} title="Genel: Kazanan Hangi Kupon Kademesinde Geldi" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PerformanceBreakdown title="Pist Tipine Göre" rows={analyst.bySurface} />
                <PerformanceBreakdown title="Mesafeye Göre" rows={analyst.byDistance} />
                <PerformanceBreakdown title="Hipodroma Göre" rows={analyst.byHippodrome} limit={8} />
              </div>
              <CouponTierChart rows={couponTierByGroup} title="Koşu Grubuna Göre Kazanan Hangi Kupon Kademesinde Geldi" />
              <CouponTierChart rows={analyst.couponTierByAtSayisi} title="At Sayısına Göre Kazanan Hangi Kupon Kademesinde Geldi" />
            </>
          )}
        </div>
      </details>
    </div>
  );
}
