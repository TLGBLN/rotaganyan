import { redirect } from "next/navigation";

// 2026-11-15: Pedigri Merkezi (TJK) /admin/pedigri-merkezi'ne taşındı; eski adres yer imlerini bozmasın diye yönlendirilir.
export const dynamic = "force-dynamic";

export default async function EskiPedigriSayfasi({ searchParams }: { searchParams: Promise<{ tarih?: string }> }) {
  const { tarih } = await searchParams;
  redirect(tarih ? `/admin/pedigri-merkezi?tarih=${encodeURIComponent(tarih)}` : "/admin/pedigri-merkezi");
}
