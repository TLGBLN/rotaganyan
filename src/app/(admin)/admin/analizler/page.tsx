import { redirect } from "next/navigation";

// 2026-11-15 kullanıcı kararı: /admin/analizler doğrudan yeni analiz sayfasını açsın.
// Eski liste (Top1/Top3/Top6 isabet özetiyle) /admin/analizler/gecmis altında duruyor.
export default function AdminAnalizlerPage() {
  redirect("/admin/analizler/yeni");
}
