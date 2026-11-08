// 2026-11-04 kullanıcı talebi — Dashboard'daki "V5 Sinyal Kütüğü" buraya, ayrı bir
// sayfaya/sol menüye taşındı; yalnız V5.46.1'de GERÇEKTEN aktif olan sinyal ve kuralları
// gösterir (bkz. SinyalKutuguPanel.tsx). Aday/reddedilen sinyaller için ayrı bir sayfa
// kısaca vardı (/admin/aday-sinyaller), kullanıcı kararıyla aynı gün kaldırıldı — veri
// hâlâ sinyal-kutugu.service.ts'te (ADAY_SINYALLER) araştırma kaydı olarak duruyor.
import SinyalKutuguPanel from "@/components/admin/SinyalKutuguPanel";
import RanV2SinyalKutuguPanel from "@/components/admin/RanV2SinyalKutuguPanel";

export const metadata = { title: "Sinyal Kütüğü — Admin" };

export default function SinyalKutuguSayfasi() {
  return (
    <div className="max-w-5xl">
      <SinyalKutuguPanel />
      {/* 2026-11-08 kullanıcı talebi — RAN v2 ("RotaGanyan Analiz Motoru") V5.46.1'den
          TAMAMEN AYRI bir sistem; yukarıdaki bölüme karışmadan, aynı sayfada ayrı bir
          bölüm olarak eklendi. */}
      <RanV2SinyalKutuguPanel />
    </div>
  );
}
