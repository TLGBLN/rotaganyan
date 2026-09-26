// 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization (bkz. plan): bu dosya
// `KuponForm.tsx`'in ("use client") İÇİNDE tanımlı olan, tamamen SAF (React/tarayıcı
// bağımsız) kupon-doldurma mantığını taşır — hem istemci (Otomatik Doldur önizlemesi)
// hem sunucu (`syncHomeKupon`, fresh veriyle GERÇEK yayın) AYNI fonksiyonları
// kullanabilsin diye. Davranış (2026-09-11→2026-09-16 arası kullanıcı bulgularıyla
// oturmuş DP/bütçe/Anormal-Pist-Modu mantığı) HİÇ DEĞİŞMEDİ, yalnız taşındı.
import { optimizeKuponAllocation, ekuriBirimleriOlustur, type LegProbability } from "./kupon-optimizer";
import type { ManualOverridesMap } from "./kupon-dependency-hash";
import { KAPSAM_ESIK_ILK3, KAPSAM_ESIK_ILK6, KAPSAM_ESIK_ILK3_AMBER_UST } from "./kapsam-esikleri";

export type Width = "narrow" | "normal" | "wide";
export const WIDTHS: Width[] = ["narrow", "normal", "wide"];
export const WIDTH_LABEL: Record<Width, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };

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
export const LIMITS: Record<Width, number> = { narrow: 600, normal: 1500, wide: 3000 };
const TOLERANCE = 1.1; // %10 esneme payı (yalnız Geniş — bkz. altta)
// 2026-09-05 kullanıcı talebi: Ekonomik'te esneme payı 660₺ değil 700₺'ye kadar.
// 2026-09-26 kullanıcı talebi (Budget Frontier tartışması sonrası) — tavanlar yeniden
// ayarlandı: Ekonomik 700→900₺, Normal 1650→1700₺. Geniş (3000×1.1=3300₺) DEĞİŞMEDİ —
// zaten istenen 2000-3300₺ aralığının üst sınırıydı. KRİTİK: bu bir "harcanacak tutar"
// DEĞİL, yalnız DP'nin arayabileceği ÜST SINIR (tavan) — gerçek yayınlanan tutar hep
// olduğu gibi DP'nin bu tavan ALTINDA bulduğu kendi optimum durumu (bkz. arac ile
// doğrulanan Budget Frontier/karşı-olgusal test: DP bütçeyi zorla doldurmuyor).
export const TOLERANCES: Record<Width, number> = { narrow: 900 / LIMITS.narrow, normal: 1700 / LIMITS.normal, wide: TOLERANCE };
// 2026-09-12 kullanıcı talebi — 7'li Ganyan da Ekonomik/Normal/Geniş üçünü gösterir,
// Altılı'nın LIMITS/TOLERANCES'ından BAĞIMSIZ kendi sabitleriyle.
export const YEDILI_LIMITS: Record<Width, number> = { narrow: 500, normal: 1400, wide: 3000 };
export const YEDILI_TOLERANCES: Record<Width, number> = { narrow: 700 / 500, normal: 1500 / 1400, wide: 3200 / 3000 };

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

// 2026-09-27 — Coverage Risk-Floor v1 (kullanıcı kararı, Ankara K6/K7 vakası sonrası):
// DP tek başına Σlog(Q) maksimize ediyor ama "İlk3≥%65 / İlk6≥%80" ürün güvenlik
// eşiklerinden (kapsam-esikleri.ts) HABERSİZ — bu eşikler şimdiye kadar yalnız admin
// ekranında (KuponForm.tsx/RaceAdviceCard.tsx) GÖRÜNTÜLENİYORDU, gerçek kupon derinliğini
// hiç etkilemiyordu. K6 (MR MONK ayağı) tam olarak bu boşluğu gösterdi: İlk3 barajını
// %65.0 ile TAM sınırında geçip 3 atta kaldı, 4. sıradaki at kazandı.
//
// Çözüm: DP'nin objective'ine DOKUNMADAN (hâlâ saf Σlog(Q)), eşikleri gerçek bir
// minUnitCounts TABANI olarak DP'nin önüne koyuyoruz — optimizeKuponAllocation'ın
// kendisi bu mantıktan tamamen habersiz kalıyor (yalnız bir sayı görüyor), separation
// of concerns korunuyor (bkz. kullanıcının "optimizer Saf Model'i/coverage'ı hiç
// bilmesin" ilkesi).
//
// Öncelik sırası (kullanıcı spesifikasyonu, EXACT/unrounded olasılıkla karşılaştırılır —
// asla `Math.round(Q) >= eşik` YAPILMAZ, ekrandaki yuvarlama yalnız gösterim):
//   1. Q6 < %80  → taban = kümülatif olasılığın İLK KEZ %80'i geçtiği n (SANCAK gibi
//      çok dağınık sahalarda bu n>6 çıkabilir — matematiksel olarak her zaman >6 çıkar,
//      çünkü Q6<%80 varsayımıyla n≤6'da zaten geçilmemiş demektir).
//   2. (Q6≥%80 ama) Q3 < %65 → taban = kümülatif olasılığın İLK KEZ %65'i geçtiği n,
//      en az 4.
//   3. %65 ≤ Q3 < %70 (kullanıcının "amber/sınırda" tamponu) → taban = 4.
//   4. Q3 ≥ %70 → taban yok (DP tamamen serbest, yapay genişleme YOK).
export type KapsamOncelik = "kirmizi-ilk6" | "kirmizi-ilk3" | "amber" | "yok";
export type KapsamTabanSonucu = { taban: number; oncelik: KapsamOncelik };

export function coverageFloorHesapla(units: { olasilik: number }[]): KapsamTabanSonucu {
  const n = units.length;
  if (n === 0) return { taban: 1, oncelik: "yok" };
  const kumulatif: number[] = [];
  let t = 0;
  for (const u of units) { t += u.olasilik; kumulatif.push(t); }
  const q3 = kumulatif[Math.min(2, n - 1)];
  const q6 = kumulatif[Math.min(5, n - 1)];
  const esikIlk3 = KAPSAM_ESIK_ILK3 / 100;
  const esikIlk6 = KAPSAM_ESIK_ILK6 / 100;
  const amberUst = KAPSAM_ESIK_ILK3_AMBER_UST / 100;

  if (q6 < esikIlk6) {
    let i = 0;
    while (i < n && kumulatif[i] < esikIlk6) i++;
    return { taban: Math.min(i + 1, n), oncelik: "kirmizi-ilk6" };
  }
  if (q3 < esikIlk3) {
    let i = 0;
    while (i < n && kumulatif[i] < esikIlk3) i++;
    return { taban: Math.min(Math.max(4, i + 1), n), oncelik: "kirmizi-ilk3" };
  }
  if (q3 < amberUst) {
    return { taban: Math.min(4, n), oncelik: "amber" };
  }
  return { taban: 1, oncelik: "yok" };
}

function floorlarFizibilMi(legs: LegProbability[], minUnitCounts: Record<number, number>, maxCombinations: number): boolean {
  let carpim = 1;
  for (const leg of legs) {
    const { units } = ekuriBirimleriOlustur(leg.runners, leg.forced);
    const n = Math.min(minUnitCounts[leg.raceNo] ?? 1, Math.max(units.length, 1));
    carpim *= n;
    if (carpim > maxCombinations) return false;
  }
  return true;
}

/**
 * `tabanMinUnitCounts` (Anormal Pist Modu + bir önceki (ucuz) kademenin tabanı — coverage
 * floor'dan BAĞIMSIZ, HİÇ gevşetilmez) üzerine coverage risk-floor'unu ekler. Bütçe
 * yetmezse (fail-open, kupon ASLA üretilemez hale gelmez) kullanıcı önceliğine göre
 * gevşetir: önce amber (en pahalıdan başlayarak), sonra kırmızı-İlk3, EN SON kırmızı-İlk6
 * (kullanıcı: "kırmızı ayaklar mümkün olduğunca korunur").
 */
export function coverageFloorlariUygula(
  legs: LegProbability[],
  tabanMinUnitCounts: Record<number, number>,
  maxCombinations: number
): Record<number, number> {
  const kapsamSonuclari = new Map<number, KapsamTabanSonucu>();
  for (const leg of legs) {
    const { units } = ekuriBirimleriOlustur(leg.runners, leg.forced);
    kapsamSonuclari.set(leg.raceNo, coverageFloorHesapla(units));
  }
  const minUnitCounts: Record<number, number> = { ...tabanMinUnitCounts };
  for (const [raceNo, sonuc] of kapsamSonuclari) {
    minUnitCounts[raceNo] = Math.max(minUnitCounts[raceNo] ?? 1, sonuc.taban);
  }
  if (floorlarFizibilMi(legs, minUnitCounts, maxCombinations)) return minUnitCounts;

  const gevsetmeSirasi: KapsamOncelik[] = ["amber", "kirmizi-ilk3", "kirmizi-ilk6"];
  for (const oncelik of gevsetmeSirasi) {
    const adaylar = [...kapsamSonuclari.entries()]
      .filter(([, s]) => s.oncelik === oncelik)
      .sort((a, b) => b[1].taban - a[1].taban); // en pahalı (en yüksek taban) önce gevşer
    for (const [raceNo] of adaylar) {
      minUnitCounts[raceNo] = tabanMinUnitCounts[raceNo] ?? 1;
      if (floorlarFizibilMi(legs, minUnitCounts, maxCombinations)) return minUnitCounts;
    }
  }
  return minUnitCounts;
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
    const tabanMinUnitCounts: Record<number, number> = { ...oncekiBirimSayilari };
    for (const [raceNoStr, min] of Object.entries(zorunluMinimum)) {
      const raceNo = Number(raceNoStr);
      tabanMinUnitCounts[raceNo] = Math.max(tabanMinUnitCounts[raceNo] ?? 1, min);
    }
    const legs = legsByWidth(width);
    const minUnitCounts = coverageFloorlariUygula(legs, tabanMinUnitCounts, maxCombinations);
    const { secimler, birimSayilari } = optimizeKuponAllocation(legs, maxCombinations, minUnitCounts);
    oncekiBirimSayilari = birimSayilari;
    for (const race of races) {
      sel[race.raceNo][width] = new Set(secimler[race.raceNo] ?? []);
    }
  }
  return sel;
}
