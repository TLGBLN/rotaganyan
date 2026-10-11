// 2026-10-11 — KuponForm.tsx'in "⚡ Otomatik Doldur" mantığı buraya taşındı (DAVRANIŞ
// DEĞİŞMEDİ, birebir aynı sabitler/fonksiyonlar). Neden: publish-time RCA snapshot
// (rca-publish-snapshot.service.ts) sunucu tarafında AYNI optimizer girdisini/bütçe
// kademelerini yeniden üretip "optimizer bu girdide ne seçerdi?" sorusuna cevap vermek
// zorunda — mantığı KOPYALAMAK (iki ayrı kopya, biri client biri server) zamanla
// birbirinden sapabilir (bkz. proje kuralı "Eski Ret Pipeline Kontrolü"). Tek kaynak:
// KuponForm.tsx (client) ve rca-publish-snapshot.service.ts (server) ikisi de BURADAN
// import eder. Bu dosyanın kendisi DB içermez (hem client hem server güvenle import
// edebilir) — tıpkı engine-versions.data.ts'in aynı nedenle db importu taşımaması gibi.
import { optimizeKuponAllocation, type LegProbability, type OptimizeResult } from "./kupon-optimizer";

export type Width = "narrow" | "normal" | "wide";
export const WIDTHS: Width[] = ["narrow", "normal", "wide"];

export const ALTILI_STAKE_PER_COMBINATION = 1.25;
// 2026-09-12 kullanıcı talebi: Diyarbakır/Şanlıurfa/Elazığ'ın Altılı kombinasyon başı
// ücreti diğer hipodromlardan farklı, 1₺ — race.service.ts'teki stakeForHippodromeLabel
// ile AYNI ayrım burada da uygulanıyor.
export const DUSUK_UCRETLI_HIPODROMLAR = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
export const ALTILI_STAKE_DUSUK = 1;
export function stakeForHippodrome(hippodromeName: string): number {
  return DUSUK_UCRETLI_HIPODROMLAR.some((h) => hippodromeName.includes(h)) ? ALTILI_STAKE_DUSUK : ALTILI_STAKE_PER_COMBINATION;
}
// v6.111 — 7'li Ganyan'ın kombinasyon başı ücreti Altılı'dan (1.25₺) farklı, TJK'da 2₺.
export const YEDILI_GANYAN_STAKE_PER_COMBINATION = 2;
export const YEDILI_GANYAN_SLOT = 7; // Altılı slotları (1, en fazla 2) ile asla çakışmaz

export const LIMITS: Record<Width, number> = { narrow: 600, normal: 1500, wide: 3000 };
const TOLERANCE = 1.10; // %10 esneme payı
export const TOLERANCES: Record<Width, number> = { narrow: 700 / LIMITS.narrow, normal: TOLERANCE, wide: TOLERANCE };
// 2026-09-12 — 7'li Ganyan kendi hedef aralıkları: Eko 500-700₺, Normal 1400-1500₺, Geniş 3000-3200₺.
export const YEDILI_LIMITS: Record<Width, number> = { narrow: 500, normal: 1400, wide: 3000 };
export const YEDILI_TOLERANCES: Record<Width, number> = { narrow: 700 / 500, normal: 1500 / 1400, wide: 3200 / 3000 };

export type AutoFillRunner = { no: number; scratched: boolean; ekuriGroup: number | null; score: number | null; scoreExact: number | null };
export type AutoFillRace = { raceNo: number; runners: AutoFillRunner[] };
export type GroupSelections = Record<number, Record<Width, Set<number>>>;

export function emptySelection(): Record<Width, Set<number>> {
  return { narrow: new Set(), normal: new Set(), wide: new Set() };
}

export function emptyGroupSelections(races: { raceNo: number }[]): GroupSelections {
  const sel: GroupSelections = {};
  races.forEach((r) => { sel[r.raceNo] = emptySelection(); });
  return sel;
}

/**
 * 1. Altılı her zaman ilk 6 koşu (1-6); 2. Altılı her zaman son 6 koşu.
 * Günde 9 koşu varsa: 1. Altılı = 1-6, 2. Altılı = 4-9 (4-5-6 ortak/üst üste biner).
 * 12 koşu varsa üst üste binme olmaz (1-6 / 7-12). 6 veya daha az koşu varsa tek grup.
 */
export function chunkIntoAltili<T>(races: T[]): T[][] {
  if (races.length <= 6) return races.length > 0 ? [races] : [];
  return [races.slice(0, 6), races.slice(races.length - 6)];
}

// v6.110 — "7'li Ganyan": günün SON 7 koşusu, tek sabit pencere. 7'den az koşu varsa null.
export function sonYediKosu<T>(races: T[]): T[] | null {
  return races.length >= 7 ? races.slice(races.length - 7) : null;
}

/**
 * Sabit bütçeyi TÜM ayaklar arasında en yüksek toplam-isabet olasılığını verecek şekilde
 * dağıtan DP optimizer çağrısını üç kademe (Ekonomik/Normal/Geniş) için ayrı ayrı çalıştırıp
 * TEK bir GroupSelections'ta birleştirir — bkz. kupon-optimizer.ts. Her kademe bir öncekinin
 * seçtiği birim sayısını TABAN alır (yalnız üzerine ekler, hiç eksiltmez).
 */
export function otomatikGroupSelections(
  races: AutoFillRace[],
  stakePerCombination: number,
  limits: Record<Width, number> = LIMITS,
  tolerances: Record<Width, number> = TOLERANCES
): GroupSelections {
  const legs: LegProbability[] = races.map((race) => ({
    raceNo: race.raceNo,
    runners: race.runners
      .filter((r) => !r.scratched)
      .map((r) => ({ no: r.no, olasilik: (r.scoreExact ?? r.score ?? 0) / 100, ekuriGroup: r.ekuriGroup })),
  }));
  const sel = emptyGroupSelections(races);
  let oncekiBirimSayilari: Record<number, number> | undefined;
  for (const width of WIDTHS) {
    const effectiveLimit = limits[width] * tolerances[width];
    const maxCombinations = Math.max(1, Math.floor(effectiveLimit / stakePerCombination));
    const { secimler, birimSayilari } = optimizeKuponAllocation(legs, maxCombinations, oncekiBirimSayilari);
    oncekiBirimSayilari = birimSayilari;
    for (const race of races) {
      sel[race.raceNo][width] = new Set(secimler[race.raceNo] ?? []);
    }
  }
  return sel;
}

export type AllocatorTierResult = {
  width: Width;
  budget: number;
  effectiveLimit: number;
  unitPrice: number;
  combinationLimit: number;
  selectedK: Record<number, number>; // raceNo -> seçilen birim sayısı (OptimizeResult.birimSayilari)
  selections: Record<number, number[]>; // raceNo -> at no'ları (OptimizeResult.secimler)
  coverageProbability: number; // OptimizeResult.kapsamaOlasiligi
};

/**
 * otomatikGroupSelections ile AYNI zincirleme DP çağrısını yapar, ama her kademenin TAM
 * OptimizeResult'ını (kombinasyon/kapsama/birim sayıları dahil) döner — publish-time RCA
 * snapshot'ının ALLOCATOR bölümü için (bkz. rca-publish-snapshot.service.ts). İki
 * fonksiyon KASITLI OLARAK aynı girdiden aynı DP çağrısını yapıyor — otomatikGroupSelections
 * yalnız Set'e indirgiyor, bu fonksiyon tüm OptimizeResult'ı koruyor.
 */
export function computeAllocatorTiers(
  races: AutoFillRace[],
  stakePerCombination: number,
  limits: Record<Width, number> = LIMITS,
  tolerances: Record<Width, number> = TOLERANCES
): AllocatorTierResult[] {
  const legs: LegProbability[] = races.map((race) => ({
    raceNo: race.raceNo,
    runners: race.runners
      .filter((r) => !r.scratched)
      .map((r) => ({ no: r.no, olasilik: (r.scoreExact ?? r.score ?? 0) / 100, ekuriGroup: r.ekuriGroup })),
  }));
  const tiers: AllocatorTierResult[] = [];
  let oncekiBirimSayilari: Record<number, number> | undefined;
  for (const width of WIDTHS) {
    const effectiveLimit = limits[width] * tolerances[width];
    const combinationLimit = Math.max(1, Math.floor(effectiveLimit / stakePerCombination));
    const result: OptimizeResult = optimizeKuponAllocation(legs, combinationLimit, oncekiBirimSayilari);
    oncekiBirimSayilari = result.birimSayilari;
    tiers.push({
      width,
      budget: limits[width],
      effectiveLimit,
      unitPrice: stakePerCombination,
      combinationLimit,
      selectedK: result.birimSayilari,
      selections: result.secimler,
      coverageProbability: result.kapsamaOlasiligi,
    });
  }
  return tiers;
}
