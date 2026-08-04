import { redirect } from "next/navigation";

// v6.50 — bu sayfa "Rotaganyan Sıralama Tablosu"na (/rotaganyansiralamasi) taşındı
// (bkz. o dosyadaki yorum). Eski adres yalnız yönlendirme için tutuluyor — mevcut
// bookmark/linkler kırılmasın.
type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function EskiPuanTablosuRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  redirect(`/rotaganyansiralamasi${params.tarih ? `?tarih=${params.tarih}` : ""}`);
}
