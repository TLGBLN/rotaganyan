// 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization (bkz. plan): bu dosya
// `KuponForm.tsx`'in ("use client") İÇİNDE tanımlı olan, tamamen SAF (React/tarayıcı
// bağımsız) kupon-doldurma mantığını taşır — hem istemci (Otomatik Doldur önizlemesi)
// hem sunucu (`syncHomeKupon`, fresh veriyle GERÇEK yayın) AYNI fonksiyonları
// kullanabilsin diye. Davranış (2026-09-11→2026-09-16 arası kullanıcı bulgularıyla
// oturmuş DP/bütçe/Anormal-Pist-Modu mantığı) HİÇ DEĞİŞMEDİ, yalnız taşındı.
import { optimizeKuponAllocation, type LegProbability } from "./kupon-optimizer";
import type { ManualOverridesMap } from "./kupon-dependency-hash";

// 2026-09-26 kullanıcı talebi: Ekonomik 700-900₺'ye yeniden konumlandırıldı, altına
// (300-500₺) yeni bir "Süper Ekonomik" (micro) kademesi eklendi — WIDTHS sırası ucuzdan
// pahalıya (micro→narrow→normal→wide), her kademe bir ÖNCEKİNİN seçimini taban alıp
// üzerine ekliyor (bkz. otomatikGroupSelections aşağıda) — micro artık en ucuz taban.
export type Width = "micro" | "narrow" | "normal" | "wide";
export const WIDTHS: Width[] = ["micro", "narrow", "normal", "wide"];
export const WIDTH_LABEL: Record<Width, string> = { micro: "Süper Ekonomik", narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };

export const ALTILI_STAKE_PER_COMBINATION = 1.25;
// 2026-09-12 kullanıcı talebi: Diyarbakır/Şanlıurfa/Elazığ'ın Altılı kombinasyon başı
// ücreti diğer hipodromlardan farklı, 1₺.
export const DUSUK_UCRETLI_HIPODROMLAR = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
export const ALTILI_STAKE_DUSUK = 1;
export function stakeForHippodrome(hippodromeName: string): number {
  return DUSUK_UCRETLI_HIPODROMLAR.some((h) => hippodromeName.includes(h)) ? ALTILI_STAKE_DUSUK : ALTILI_STAKE_PER_COMBINATION;
}
// v6.111 — 7'li Ganyan'ın kombinasyon başı ücreti Altılı'dan farklı, TJK'da 2₺.
export const YEDILI_GANYAN_STAKE_PER_COMBINATION = 2;
// 2026-09-26 kullanıcı talebi: Ekonomik artık 700-900₺ (eskiden 600-700₺), Süper Ekonomik
// (micro) 300-500₺ hedefliyor — LIMITS taban, TOLERANCES*LIMITS tavan (effectiveLimit,
// bkz. otomatikGroupSelections) — DP bu tavanı AŞMAZ ama tam doldurmayı da GARANTİ ETMEZ
// (sahadaki gerçek at/ayak sayısına bağlı, narrow/normal/wide'ın da tarihsel davranışı budur).
export const LIMITS: Record<Width, number> = { micro: 300, narrow: 700, normal: 1500, wide: 3000 };
const TOLERANCE = 1.1; // %10 esneme payı
export const TOLERANCES: Record<Width, number> = { micro: 500 / LIMITS.micro, narrow: 900 / LIMITS.narrow, normal: TOLERANCE, wide: TOLERANCE };
// 2026-09-12 kullanıcı talebi — 7'li Ganyan da aynı kademeleri gösterir, Altılı'nın
// LIMITS/TOLERANCES'ından BAĞIMSIZ kendi sabitleriyle (2026-09-26: aynı ₺ hedefine hizalandı).
export const YEDILI_LIMITS: Record<Width, number> = { micro: 300, narrow: 700, normal: 1400, wide: 3000 };
export const YEDILI_TOLERANCES: Record<Width, number> = { micro: 500 / 300, narrow: 900 / 700, normal: 1500 / 1400, wide: 3200 / 3000 };

// Altılı slotları (1, en fazla 2) ile asla çakışmaz.
export const YEDILI_GANYAN_SLOT = 7;

export type RaceRunner = {
  no: number;
  name: string;
  scratched: boolean;
  ekuriGroup: number | null;
  score: number | null;
  scoreExact: number | null;
  agfSirasi: number | null;
};
export type RaceRiskInfo = {
  pistAnormalMi: boolean;
  pistDuyarliligi: string | null;
  gecmisRiskSeviyesi: string | null;
  pistUyariMesaji: string | null;
};
export type RaceDayData = {
  hippodromeName: string;
  races: ({ raceNo: number; runners: RaceRunner[] } & RaceRiskInfo)[];
};

export type GroupSelections = Record<number, Record<Width, Set<number>>>;

export function emptySelection(): Record<Width, Set<number>> {
  return { micro: new Set(), narrow: new Set(), normal: new Set(), wide: new Set() };
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

// v6.110 — "7'li Ganyan": Altılı'nın aksine tek bir sabit pencere — her zaman günün
// SON 7 koşusu. Günün 7'den az koşusu varsa bölüm hiç gösterilmez.
export function sonYediKosu<T>(races: T[]): T[] | null {
  return races.length >= 7 ? races.slice(races.length - 7) : null;
}

// 2026-09-16 — Anormal Pist Modu v1: HASSAS/ÇOK HASSAS ayaklarda "tek at yazma, en az
// bir alternatif daha bırak" kuralı — ikisi de aynı zorunlu minimuma (2) tabi.
const ANORMAL_PIST_ZORUNLU_MINIMUM = 2;
function anormalPistZorunluMinimumHesapla(races: RaceDayData["races"]): Record<number, number> {
  const zorunlu: Record<number, number> = {};
  for (const race of races) {
    if (race.pistDuyarliligi === "HASSAS" || race.pistDuyarliligi === "COK_HASSAS") {
      zorunlu[race.raceNo] = ANORMAL_PIST_ZORUNLU_MINIMUM;
    }
  }
  return zorunlu;
}

/**
 * Sabit bütçeyi ayaklar arasında en yüksek toplam-isabet olasılığını verecek şekilde
 * dağıtır (bkz. kupon-optimizer.ts). Her üç kademe (Ekonomik/Normal/Geniş) için AYRI
 * bir optimizasyon çalıştırıp TEK bir GroupSelections'ta birleştirir; her kademe bir
 * öncekinin (ucuz) seçtiği birim sayısını TABAN alır (yalnız üzerine ekler).
 *
 * 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization: `manualOverrides` verilirse
 * (admin'in HAM/kalıcı checkbox niyeti, `pruneToEligible` ile ZATEN eligible'a budanmış
 * olmalı) her (raceNo,width) için `optimizeKuponAllocation`'a `forced` kısıtı olarak
 * geçirilir — bütçe bu kısıtların ETRAFINDA yeniden çözülür (bkz. kupon-optimizer.ts'teki
 * eküri/bahis-birimi seviyesi uygulama).
 */
export function otomatikGroupSelections(
  races: RaceDayData["races"],
  stakePerCombination: number,
  limits: Record<Width, number> = LIMITS,
  tolerances: Record<Width, number> = TOLERANCES,
  manualOverrides?: ManualOverridesMap
): GroupSelections {
  const zorunluMinimum = anormalPistZorunluMinimumHesapla(races);
  const legsByWidth = (width: Width): LegProbability[] =>
    races.map((race) => {
      const entry = manualOverrides?.[race.raceNo]?.[width];
      return {
        raceNo: race.raceNo,
        runners: race.runners
          .filter((r) => !r.scratched)
          .map((r) => ({ no: r.no, olasilik: (r.scoreExact ?? r.score ?? 0) / 100, ekuriGroup: r.ekuriGroup })),
        forced: entry ? { include: entry.forceInclude, exclude: entry.forceExclude } : undefined,
      };
    });
  const sel = emptyGroupSelections(races);
  let oncekiBirimSayilari: Record<number, number> | undefined;
  for (const width of WIDTHS) {
    const effectiveLimit = limits[width] * tolerances[width];
    const maxCombinations = Math.max(1, Math.floor(effectiveLimit / stakePerCombination));
    const minUnitCounts: Record<number, number> = { ...oncekiBirimSayilari };
    for (const [raceNoStr, min] of Object.entries(zorunluMinimum)) {
      const raceNo = Number(raceNoStr);
      minUnitCounts[raceNo] = Math.max(minUnitCounts[raceNo] ?? 1, min);
    }
    const { secimler, birimSayilari } = optimizeKuponAllocation(legsByWidth(width), maxCombinations, minUnitCounts);
    oncekiBirimSayilari = birimSayilari;
    for (const race of races) {
      sel[race.raceNo][width] = new Set(secimler[race.raceNo] ?? []);
    }
  }
  return sel;
}
