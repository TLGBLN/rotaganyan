import { redirect } from "next/navigation";

// 2026-09-25: Veri Tamlığı, Sistem Anatomisi sayfasına entegre edildi (Veri Toplama katmanının girdi kalitesi).
// Eski adres (bildirim linkleri, yer imleri) çalışmaya devam eder.
export default function VeriTamligiPage() {
  redirect("/admin/system-anatomy#veri-tamligi");
}
