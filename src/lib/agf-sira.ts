// 2026-08-20 kullanıcı talebi: her atın yanında o koşudaki AGF sırasını (kaçıncı at
// olduğunu) göster — yalnız admin görsün, diğer kullanıcılar (piyasa bilgisini önceden
// bilmek avantaj sağlayabileceği için) görmesin. Koşu içi AGF büyükten küçüğe sıralanır,
// agf null olanlar sıraya girmez (eşitlikte no'ya göre kararlı sıra).
// 2026-09-10 kullanıcı talebi: bu artık yalnız PuanTablosu.tsx'te değil, ProgramView.tsx'in
// "Analiz Detayları" panelinde de gösteriliyor — TEK, paylaşılan kaynağa çıkarıldı ki
// PuanTablosu.tsx (server, next-intl/server importluyor) ile ProgramView.tsx ("use client")
// arasında modül sınırı ihlali olmasın.
export function agfSiraMapOlustur(runners: { no: number; agf: number | null }[]): Map<number, number> {
  const sirali = runners
    .filter((r) => r.agf != null)
    .sort((a, b) => (b.agf! !== a.agf! ? b.agf! - a.agf! : a.no - b.no));
  return new Map(sirali.map((r, i) => [r.no, i + 1]));
}
