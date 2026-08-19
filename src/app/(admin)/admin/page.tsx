import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
  getArchiveStats,
  getAgfEdgeStats,
} from "@/server/services/admin.service";
import { getRaceStyleWinStats, raceStyleBreakdownToRows } from "@/lib/stats";
import { getV5SinyalPerformansi } from "@/server/services/v5-sinyal-performans.service";
import { getAnalizPerformansOzeti } from "@/server/services/analiz-performans.service";
import { getVersiyonKarsilastirmasi } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { getAgfTrendIstatistik } from "@/server/services/agf-trend-istatistik.service";
import v5Weights from "@/lib/methodology/weights/v5-weights.json";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import PerformansDenetimiPanel from "@/components/admin/PerformansDenetimiPanel";
import type { CouponTierBreakdown } from "@/server/services/admin.service";
import NarrativeSummary from "@/components/admin/NarrativeSummary";
import AgfEdgeCard from "@/components/admin/AgfEdgeCard";
import DailyTrendChart from "@/components/admin/DailyTrendChart";
import RecentFeed from "@/components/admin/RecentFeed";
import PendingList from "@/components/admin/PendingList";
import AdminRefresh from "@/components/admin/AdminRefresh";
import ArchiveStatsWidget from "@/components/admin/ArchiveStatsWidget";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    stats, analyst, recentPredictions, pendingPredictions, raceStyleStats,
    archiveStats, agfEdge, v5SinyalPerformansi, performansOzeti, versiyonKarsilastirmasi, agfTrendIstatistik,
  ] = await Promise.all([
    getDashboardStats(),
    getAnalystStats(),
    getRecentPredictions(16),
    getPendingPredictions(),
    getRaceStyleWinStats(),
    getArchiveStats(),
    getAgfEdgeStats(),
    getV5SinyalPerformansi(),
    getAnalizPerformansOzeti(),
    getVersiyonKarsilastirmasi(),
    getAgfTrendIstatistik(),
  ]);
  const v5Test = v5Weights.testEval;

  const hasData = analyst.overall.total > 0;
  const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
  const last10 = analyst.recentTrend.slice(-10);
  const last10Hits = last10.filter(Boolean).length;
  const couponTier = analyst.overallCouponTier;

  // 2026-08-17 kullanıcı talebi: "Koşu Tipine Göre Kazanan Hangi Kupon Kademesinde Geldi"
  // paneli her alt-sınıfı (ŞARTLI 1, ŞARTLI 2, ...) ayrı satır gösteriyordu — çoğu n<5,
  // saf gürültü. V5'in hiçbir sinyali sınıf-bazlı değil (sınıf geçişi test edilip
  // reddedildi), bu yüzden yalnız üst grup (Şartlı/Handikap/Maiden/...) toplamına indirildi.
  const couponTierByGroup: CouponTierBreakdown[] = Object.values(
    analyst.couponTierByClassType.reduce<Record<string, CouponTierBreakdown>>((acc, r) => {
      const key = r.group ?? r.label;
      const entry = acc[key] ?? { label: key, total: 0, ekonomik: 0, normal: 0, genis: 0, kacti: 0 };
      entry.total += r.total;
      entry.ekonomik += r.ekonomik;
      entry.normal += r.normal;
      entry.genis += r.genis;
      entry.kacti += r.kacti;
      acc[key] = entry;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const trendStats = {
    overall: analyst.overall,
    coupon: couponTier.total >= 1
      ? { hits: couponTier.ekonomik, total: couponTier.total, rate: (couponTier.ekonomik / couponTier.total) * 100 }
      : undefined,
    banko: banko && banko.total >= 1 ? { rate: banko.rate, hits: banko.hits, total: banko.total } : undefined,
    last10: { rate: last10.length > 0 ? (last10Hits / last10.length) * 100 : 0, hits: last10Hits },
    last10Count: last10.length,
    pending: stats.pendingResults,
  };

  return (
    <div className="space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Dashboard</h1>
          <AdminRefresh />
        </div>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {analyst.overall.total} sonuçlanmış · {stats.totalPredictions} toplam tahmin
          </span>
        )}
      </div>

      {/* ── Arşiv Kapsamı ──────────────────────────────────────────── */}
      <ArchiveStatsWidget {...archiveStats} />

      {/* ── Yorumsal Özet ──────────────────────────────────────────── */}
      <NarrativeSummary analyst={analyst} pendingResults={stats.pendingResults} />

      {/* ── Sistem vs AGF Favorisi ─────────────────────────────────── */}
      <AgfEdgeCard stats={agfEdge} overallTotal={analyst.overall.total} />

      {/* ── Performans Denetimi ──────────────────────────────────────
          2026-08-17 kullanıcı talebi: eskiden ayrı /admin/performans sayfasındaydı,
          "dashboard'a bağlanabilir mi, fazlalık yapmasın" — tek sayfaya taşındı,
          ayrı route/nav girdisi kaldırıldı. */}
      <PerformansDenetimiPanel ozet={performansOzeti} versiyonlar={versiyonKarsilastirmasi} agfTrendIstatistik={agfTrendIstatistik} />

      {/* ── Trend + Bekleyen ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyTrendChart
            cumulativeTrend={analyst.cumulativeTrend}
            overallRate={analyst.overall.rate}
            stats={trendStats}
          />
        </div>
        <div className="space-y-4">
          <PendingList pending={pendingPredictions} />
        </div>
      </div>

      {/* ── Son Tahminler Akışı ────────────────────────────────────── */}
      <RecentFeed predictions={recentPredictions} />

      {/* ── Performans Tabloları ───────────────────────────────────── */}
      {hasData && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Performans Analizi
          </h2>

          <div className="space-y-4">
            {/* v6.17x — kullanıcı talebi 2026-08-17: "/admin dashboard'u V5'in 18 sinyaline
                göre detaylandır." Üstteki kutu modelin KENDİ test-seti iddiası (offline
                backtest); alttaki tablo ise yayınlanmış+sonuçlanmış GERÇEK V5 tahminlerinde
                her sinyalin taşındığı atın fiilen kazanma oranı — ikisi kasıtlı ayrı tutuldu,
                biri teoriyi biri sahadaki gerçeği gösteriyor. */}
            <div className="rounded-lg border p-4 text-xs leading-relaxed text-muted-foreground">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand">
                V5 Motoru — Kendi Test Seti (offline backtest, n={v5Test.n})
              </span>
              Hiç görülmemiş {v5Test.n} koşuda{" "}
              <span className="font-semibold text-foreground">%{v5Test.top1P.toFixed(1)} ilk sıra</span> /{" "}
              <span className="font-semibold text-foreground">%{v5Test.top3P.toFixed(1)} ilk-3</span> isabet
              (19 özellik, koşullu logit). Alttaki tablo ise modelin iddiası değil — canlıda
              yayınlanmış+sonuçlanmış V5 tahminlerinde her sinyalin taşındığı atın gerçekten
              kazandığı oran.
            </div>
            <PerformanceBreakdown title="Sinyal Bazlı Gerçek İsabet Oranı — V5 Dönemi" rows={v5SinyalPerformansi} />

            <CouponTierChart
              rows={[analyst.overallCouponTier]}
              title="Genel: Kazanan Hangi Kupon Kademesinde Geldi"
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PerformanceBreakdown
                title="Pist Tipine Göre"
                rows={analyst.bySurface}
              />
              <PerformanceBreakdown
                title="Mesafeye Göre"
                rows={analyst.byDistance}
              />
              <PerformanceBreakdown
                title="Hipodroma Göre"
                rows={analyst.byHippodrome}
                limit={8}
              />
            </div>

            <CouponTierChart
              rows={couponTierByGroup}
              title="Koşu Grubuna Göre Kazanan Hangi Kupon Kademesinde Geldi"
            />

            {/* kacakAtMi (KACAK) V5 sinyalinin dayandığı ham veri: TÜM TJK geçmişinde
                (Rotaganyan tahminlerinden bağımsız) hangi yarış stili ne sıklıkla kazanıyor.
                Üstteki "Sinyal Bazlı Gerçek İsabet Oranı" paneli bizim tahminlerimizde
                KACAK'ın sonucunu gösterir, bu ikisi genel piyasa gerçeğini gösterir. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <PerformanceBreakdown
                title="Kazanan Yarış Stili — Mesafeye Göre (KACAK sinyalinin dayandığı veri)"
                rows={raceStyleBreakdownToRows(raceStyleStats.byDistance)}
              />
              <PerformanceBreakdown
                title="Kazanan Yarış Stili — At Sayısına Göre (KACAK sinyalinin dayandığı veri)"
                rows={raceStyleBreakdownToRows(raceStyleStats.byFieldSize)}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
