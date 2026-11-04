// 2026-11-04 kullanıcı talebi — "Sinyal Kütüğü" yalnız AKTİF sinyalleri gösterecek
// şekilde daraltılınca, reddedilen/aday/beklemedeki sinyaller kaybolmasın diye kendi
// ayrı sayfasına/sol menüye taşındı (bkz. AdaySinyallerPanel.tsx).
import AdaySinyallerPanel from "@/components/admin/AdaySinyallerPanel";

export const metadata = { title: "Aday Sinyaller — Admin" };

export default function AdaySinyallerSayfasi() {
  return (
    <div className="max-w-5xl">
      <AdaySinyallerPanel />
    </div>
  );
}
