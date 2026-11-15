import { redirect } from "next/navigation";

// 2026-11-15 kullanıcı kararı: /admin/analizler doğrudan yeni analiz sayfasını açsın.
// Tip bazlı Top1/Top3/Top6 sonuçları /admin/kosu-tipleri sayfasında.
export default function AdminAnalizlerPage() {
  redirect("/admin/analizler/yeni");
}
