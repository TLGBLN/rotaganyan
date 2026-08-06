/**
 * TJK takı kodları ve "aile" eşlemesi — K (Kulaklık) ile SK (Starta Kadar Kulaklık) aynı
 * ailede sayılır (kulaklığın koşu boyunca vs. yalnız starta kadar kullanımı, ayrı ayrı
 * eklenen/çıkarılan sayılmamalı). son-yaris-detay.actions.ts (bugünkü takı karşılaştırması)
 * ve trainer-equipment-own-stat.service.ts (antrenörün ekipman-değişikliği geçmişi) TARAFINDAN
 * paylaşılır, tek yerden bakım için.
 */
export const EQUIPMENT_LABELS: Record<string, string> = {
  K: "Kulaklık",
  KG: "Kapalı Gözlük",
  DB: "Dil Bağı",
  SK: "Starta Kadar Kulaklık",
  GKR: "Göz Koruyucu",
};

const EQUIPMENT_FAMILY: Record<string, string> = { K: "KULAKLIK", SK: "KULAKLIK" };

export function familyOf(code: string): string {
  return EQUIPMENT_FAMILY[code] ?? code;
}

export function labelFor(code: string): string {
  return EQUIPMENT_LABELS[code] ?? code;
}

export function toCodes(raw: string | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** İki takı listesi (virgüllü ham metin) arasında AİLE bazında fark var mı. */
export function equipmentFamiliesChanged(prevRaw: string | null, currentRaw: string | null): boolean {
  const prevFamilies = new Set(toCodes(prevRaw).map(familyOf));
  const currentFamilies = new Set(toCodes(currentRaw).map(familyOf));
  if (prevFamilies.size !== currentFamilies.size) return true;
  for (const f of currentFamilies) if (!prevFamilies.has(f)) return true;
  return false;
}
