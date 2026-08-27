// Eküri (aynı sahiplik grubu) renk paleti — TEK kaynak, sitenin her yerinde (ProgramView,
// PuanTablosu, KuponForm) aynı eküri numarası her zaman aynı rengi alsın diye (kullanıcı
// talebi 2026-08-27: "1-3 bir eküri kırmızıysa diğer eküri mavi gibi, bu mantık eküri
// nerelerde ise uygulanacak"). Renk yalnız ekuriGroup SAYISINA bağlı — sahadaki diğer
// atlara bakmaya gerek yok, tek bir atın kendi ekuriGroup'u yeterli.
export const EKURI_COLORS = [
  { border: "border-l-[3px] border-[#3498db]", badge: "bg-[#3498db]" },
  { border: "border-l-[3px] border-[#e67e22]", badge: "bg-[#e67e22]" },
  { border: "border-l-[3px] border-[#9b59b6]", badge: "bg-[#9b59b6]" },
  { border: "border-l-[3px] border-[#e74c3c]", badge: "bg-[#e74c3c]" },
];

export function ekuriRengi(ekuriGroup: number): (typeof EKURI_COLORS)[number] {
  return EKURI_COLORS[(ekuriGroup - 1) % EKURI_COLORS.length];
}
