/**
 * Race.breed/surface/distance ↔ SireStat.irk/filtrePist/filtreMesafe eşlemesi ve
 * at-babası (sire) isim eşleştirmesi — hem analiz motoru (veri-toplama.ts) hem de
 * herkese açık/admin pedigri görünümleri (race.service.ts, admin.service.ts)
 * TARAFINDAN paylaşılır, tek yerden bakım için.
 */

const TR_FOLD: Record<string, string> = {
  İ: "I", I: "I", ı: "I", i: "I",
  Ş: "S", ş: "S", Ğ: "G", ğ: "G",
  Ü: "U", ü: "U", Ö: "O", ö: "O",
  Ç: "C", ç: "C",
};

/** Case/aksan farklarını (İ/I/ı/i, Ş/Ğ/Ü/Ö/Ç) yok sayarak karşılaştırılabilir hale getirir —
 *  hipodromx'ten yapıştırılan aygır adı ile admin'in TJK'dan gelen "sire" alanı birebir
 *  aynı yazılmayabilir (klavye/kaynak farkı). */
export function normalizeSireName(s: string): string {
  return s
    .split("")
    .map((ch) => TR_FOLD[ch] ?? ch.toUpperCase())
    .join("")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Race.distance (metre) → hipodromx'in kullandığı 3 mesafe aralığından biri. */
export function mesafeBucket(distance: number): string {
  if (distance <= 1400) return "800-1400";
  if (distance <= 2000) return "1500-2000";
  return "2100-3200";
}

export function surfaceToPist(surface: string): string {
  if (surface === "CIM") return "Çim";
  if (surface === "KUM") return "Kum";
  return "Sentetik";
}

export function breedToIrk(breed: string): string {
  return breed === "ARAP" ? "ARAP" : "İNGİLİZ";
}

export type SireStatLite = {
  sireName: string;
  kkKazanan: number;
  kkKosulan: number;
  kkYuzde: number;
  start: number;
  birinci: number;
  kYuzde: number;
  ikinci: number;
  ucuncu: number;
  ikramiye: bigint;
  aei: number;
};

/** Verilen aygır adını (varsa) havuzdaki (aynı ırk/pist/mesafe filtresiyle çekilmiş) kayıtlarla eşleştirir. */
export function findSireStat<T extends SireStatLite>(sireName: string | null | undefined, pool: T[]): T | null {
  if (!sireName) return null;
  const norm = normalizeSireName(sireName);
  return pool.find((s) => normalizeSireName(s.sireName) === norm) ?? null;
}

/** Claude'a ve UI'a gösterilecek okunabilir tek satır özet. */
export function formatSireStatOzet(s: SireStatLite, mesafe: string, pist: string): string {
  return `${s.sireName} (${pist} ${mesafe}): yavruları ${s.kkKazanan}/${s.kkKosulan} koşuda kazandı (K/K %${s.kkYuzde}) · Start ${s.start} 1.${s.birinci}(K% ${s.kYuzde}) 2.${s.ikinci} 3.${s.ucuncu} · İkr ${s.ikramiye.toLocaleString("tr-TR")}₺ · AEI ${s.aei}${s.aei > 1 ? " (ortalama üstü)" : s.start > 0 ? " (ortalama altı)" : ""}`;
}

export type DamStatLite = {
  damName: string;
  damSireName: string;
  atSayisi: number;
  start: number;
  birinci: number;
  kYuzde: number;
  ikinci: number;
  ucuncu: number;
  ikramiye: bigint;
};

/** Kısrak eşleştirmesi ANNE + ANNE BABASI birlikte — hipodromx bu ikisini tek satırda birlikte veriyor. */
export function findDamStat<T extends DamStatLite>(
  damName: string | null | undefined,
  damSireName: string | null | undefined,
  pool: T[]
): T | null {
  if (!damName) return null;
  const normDam = normalizeSireName(damName);
  const normDamSire = damSireName ? normalizeSireName(damSireName) : null;
  const candidates = pool.filter((s) => normalizeSireName(s.damName) === normDam);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Aynı isimli birden fazla kısrak varsa (nadir), anne babasıyla ayrıştır.
  return (normDamSire && candidates.find((s) => normalizeSireName(s.damSireName) === normDamSire)) || candidates[0];
}

export function formatDamStatOzet(s: DamStatLite, mesafe: string, pist: string): string {
  return `${s.damName} / ${s.damSireName} (${pist} ${mesafe}): ${s.atSayisi} yavru · Start ${s.start} 1.${s.birinci}(K% ${s.kYuzde}) 2.${s.ikinci} 3.${s.ucuncu} · İkr ${s.ikramiye.toLocaleString("tr-TR")}₺`;
}
