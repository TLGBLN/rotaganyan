import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
  getArchiveStats,
  getAgfEdgeStats,
  getGunlukBasariOzeti,
} from "@/server/services/admin.service";
import { getRaceStyleWinStats, raceStyleBreakdownToRows } from "@/lib/stats";
import { getV5SinyalPerformansi, getV5SinyalPerformansiKosuTipineGore } from "@/server/services/v5-sinyal-performans.service";
import { getAnalizPerformansOzeti } from "@/server/services/analiz-performans.service";
import { getVersiyonKarsilastirmasi } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { getAgfTrendIstatistik } from "@/server/services/agf-trend-istatistik.service";
import { getAylikKuponKazanci, getKuponRoiOzeti } from "@/server/services/race.service";
import v5WeightsDusukSart from "@/lib/methodology/weights/v5-weights-dusuksart.json";
import v5WeightsDiger from "@/lib/methodology/weights/v5-weights-diger.json";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import PerformansDenetimiPanel from "@/components/admin/PerformansDenetimiPanel";
import AylikKuponKazanciCard from "@/components/home/AylikKuponKazanciCard";
import KuponRoiCard from "@/components/admin/KuponRoiCard";
import type { CouponTierBreakdown } from "@/server/services/admin.service";
import NarrativeSummary from "@/components/admin/NarrativeSummary";
import AgfEdgeCard from "@/components/admin/AgfEdgeCard";
import DailyTrendChart from "@/components/admin/DailyTrendChart";
import RecentFeed from "@/components/admin/RecentFeed";
import PendingList from "@/components/admin/PendingList";
import AdminRefresh from "@/components/admin/AdminRefresh";
import ArchiveStatsWidget from "@/components/admin/ArchiveStatsWidget";
import GunlukBasariPanel from "@/components/admin/GunlukBasariPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    stats, analyst, recentPredictions, pendingPredictions, raceStyleStats,
    archiveStats, agfEdge, v5SinyalPerformansi, performansOzeti, versiyonKarsilastirmasi, agfTrendIstatistik,
    aylikKuponKazanci, v5SinyalPerformansiKosuTipineGore, gunlukBasariOzeti, kuponRoiOzeti,
  ] = await Promise.all([
    getDashboardStats(),
    // 2026-08-30 kullanıcı talebi ("v5'e kilitlensin"): /admin/analizler ve /admin/kupon
    // sayfaları zaten sadeceGuncelMotor=true çağırıyordu (yalnız V5 dönemi) — dashboard'un
    // genel özeti (bu sayfa) parametre vermediği için VARSAYILAN false ile tüm motor
    // dönemlerini (V1-V22/V2/V3/V4/V5) karıştırıyordu. Artık tutarlı: dashboard'daki tüm
    // özet/trend/kupon-kademe grafikleri de yalnız güncel ana sürümün (GUNCEL_MOTOR_BASLANGIC)
    // verisini gösteriyor.
    getAnalystStats(undefined, true),
    getRecentPredictions(16),
    getPendingPredictions(),
    getRaceStyleWinStats(),
    getArchiveStats(),
    getAgfEdgeStats(),
    getV5SinyalPerformansi(),
    getAnalizPerformansOzeti(),
    getVersiyonKarsilastirmasi(),
    getAgfTrendIstatistik(),
    getAylikKuponKazanci(),
    getV5SinyalPerformansiKosuTipineGore(),
    getGunlukBasariOzeti(),
    getKuponRoiOzeti(),
  ]);
  // V5.3 (2026-08-21): motor artık koşu kategorisine göre İKİ AYRI eğitilmiş modelden
  // birini kullanıyor (şartlı1/19/27+maiden vs diğer) — bkz. v5-engine.ts üstündeki not.
  // Buradaki "kendi test seti" özeti ikisinin birleşik (ağırlıklı ortalama) hâli.
  const dsTest = v5WeightsDusukSart.testEval;
  const dgTest = v5WeightsDiger.testEval;
  const v5Test = {
    n: dsTest.n + dgTest.n,
    top1P: (dsTest.top1P * dsTest.n + dgTest.top1P * dgTest.n) / (dsTest.n + dgTest.n),
    top3P: (dsTest.top3P * dsTest.n + dgTest.top3P * dgTest.n) / (dsTest.n + dgTest.n),
  };
  // 2026-08-23 — sabit "V5.3" etiketi bayatlamıştı (aynı hata FEATURE_NAMES.length'te de
  // yaşanmıştı, bkz. v5-engine.ts) — artık versiyonKarsilastirmasi'nin son (bitis:null)
  // girdisinden türetiliyor, bir daha elle güncellenmesi gerekmiyor.
  const guncelVersiyon = versiyonKarsilastirmasi[versiyonKarsilastirmasi.length - 1]?.versiyon ?? "V5";

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

      {/* ── Rotaganyan Puan Sıralaması — Günlük Başarı Analizi ──────────
          2026-09-07 kullanıcı talebi: "gün sonunda başarı oranını çıkar, genele bağla
          istatistiksel oranlara" — her gün ayrı satır, genel V5-dönemi ortalaması
          (Wilson %95 GA) referans olarak üstte. */}
      <GunlukBasariPanel ozet={gunlukBasariOzeti} />

      {/* ── Aylık Kupon Kazancı ────────────────────────────────────────
          2026-08-24 kullanıcı talebi: "dashboard'ta aylık kupon kazancında olsun,
          her tutan kupon ilgili ayın kazancına eklenecek". */}
      <AylikKuponKazanciCard aylar={aylikKuponKazanci} />

      {/* ── Harcanan vs Kazanç (ROI) ───────────────────────────────────
          2026-09-17 kullanıcı talebi: yalnız admin görsün (kamuya açık sayfalarda
          bağlamsız ROI% yanıltıcı olabilir, bkz. KuponRoiCard.tsx). */}
      <KuponRoiCard ozeti={kuponRoiOzeti} />

      {/* ── Performans Denetimi ──────────────────────────────────────
          2026-08-17 kullanıcı talebi: eskiden ayrı /admin/performans sayfasındaydı,
          "dashboard'a bağlanabilir mi, fazlalık yapmasın" — tek sayfaya taşındı,
          ayrı route/nav girdisi kaldırıldı. */}
      <PerformansDenetimiPanel ozet={performansOzeti} agfTrendIstatistik={agfTrendIstatistik} />

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
                {guncelVersiyon} Motoru — Kendi Test Seti (offline backtest, n={v5Test.n}, iki segment modeli birleşik)
              </span>
              Hiç görülmemiş {v5Test.n} koşuda{" "}
              <span className="font-semibold text-foreground">%{v5Test.top1P.toFixed(1)} ilk sıra</span> /{" "}
              <span className="font-semibold text-foreground">%{v5Test.top3P.toFixed(1)} ilk-3</span> isabet
              ({v5WeightsDiger.featureNames.length} özellik, koşullu logit). Alttaki tablo ise modelin iddiası değil — canlıda
              yayınlanmış+sonuçlanmış V5 tahminlerinde her sinyalin taşındığı atın gerçekten
              kazandığı oran.
            </div>
            <PerformanceBreakdown title="Sinyal Bazlı Gerçek İsabet Oranı — V5 Dönemi" rows={v5SinyalPerformansi} />

            {/* 2026-08-30 kullanıcı talebi ("V5 Sinyal Kütüğü... koşular koştukça hangi
                sinyallerin hangi yarışlarda daha faydalı olduğunu görmek istiyorum...
                ileride yarışlara göre sinyal seçimleri yapabilmemiz için altyapısını
                hazırla") — üstteki panelin AYNI verisi, koşu-tipi-grubuna (Maiden/Şartlı/
                Handikap/KV/Satış/Açık) göre kırılmış hâli. Şimdilik yalnız GÖZLEM amaçlı —
                hiçbir seçim/ağırlıklandırma otomatik uygulanmıyor, gelecekteki koşu-tipine-
                özel sinyal seçimi kararları için temel oluşturuyor. */}
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Sinyal Bazlı Gerçek İsabet Oranı — Koşu Tipine Göre (henüz otomatik bir seçim/ağırlıklandırma uygulanmıyor, yalnız gözlem amaçlı)
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {v5SinyalPerformansiKosuTipineGore.map((g) => (
                  <PerformanceBreakdown
                    key={g.koşuTipi}
                    title={`${g.koşuTipi} (${g.toplamKosu} koşu)`}
                    rows={g.sinyaller}
                  />
                ))}
              </div>
            </div>

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

            {/* 2026-08-30 kullanıcı talebi: "at sayılarına göre hangi katmanda yazılan
                atlar daha şanslı oluyor" araştırması — saha büyüdükçe Ekonomik'in isabet
                oranı düşüyor, Geniş'e kaçma oranı artıyor (bkz. admin.service.ts'teki
                atSayisiBucket notu). Şimdilik yalnız GÖRÜNÜR kılınıyor, tierOneri()'nin
                eşiklerine henüz dokunulmadı. */}
            <CouponTierChart
              rows={analyst.couponTierByAtSayisi}
              title="At Sayısına Göre Kazanan Hangi Kupon Kademesinde Geldi"
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
