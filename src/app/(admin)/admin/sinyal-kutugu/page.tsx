// 2026-11-04 kullanıcı talebi — Dashboard'daki "V5 Sinyal Kütüğü" buraya, ayrı bir
// sayfaya/sol menüye taşındı; yalnız V5.46.1'de GERÇEKTEN aktif olan sinyal ve kuralları
// gösterir (bkz. SinyalKutuguPanel.tsx). Aday/reddedilen sinyaller için ayrı sayfa:
// /admin/aday-sinyaller.
import SinyalKutuguPanel from "@/components/admin/SinyalKutuguPanel";

export const metadata = { title: "Sinyal Kütüğü — Admin" };

export default function SinyalKutuguSayfasi() {
  return (
    <div className="max-w-5xl">
      <SinyalKutuguPanel />
    </div>
  );
}
