import { redirect } from "next/navigation";

// 2026-11-10 kullanıcı talebi ("sonuçlar ile koşu tipleri birleştirilsin") — bu sayfanın
// tüm içeriği /admin/kosu-tipleri'ne taşındı (tip-bazlı özet TABLOSU + zengin tek-tek sonuç
// LİSTESİ artık orada tek sayfada). Eski bağlantılar/yer imleri kırılmasın diye buradan
// yönlendiriliyor.
export default function SonuclarPageRedirect() {
  redirect("/admin/kosu-tipleri");
}
