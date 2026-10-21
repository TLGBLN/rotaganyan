// ROTAGANYAN ANALİZ MOTORU v1.0 — Ortak Matematiksel Sözleşme (Sinyal Eğitim Kılavuzu §1).
//
// Bu dosyadaki HER fonksiyon saf (pure) — DB'ye dokunmaz, yan etkisi yok, test edilebilir.
// Hiçbir fonksiyon eksik veriyi SESSİZCE 0/nötr bir sayıya çevirmez — eksiklik `null` ile
// AÇIKÇA taşınır, çağıran taraf bunu görmezden gelemez (TypeScript null-check zorunlu kılar).

/**
 * 2026-10-17 — kullanıcı talimatı: "TRUE_DEBUTANT yalnızca geçmiş kaydı bulunmadığı için
 * verilmemeli. At kimliği ve resmi geçmişinin gerçekten doğrulandığı durumda kullanılmalı."
 * FORM ve SINIF ailelerinin PAYLAŞTIĞI tek bir kapsam-durumu sözlüğü — aynı at için ikisi
 * FARKLI bir sınıflandırma ÜRETEMEZ.
 */
export type CoverageState =
  | "IDENTITY_UNRESOLVED" // tjkAtId yok/eşleşmedi — geçmişe HİÇ erişilemedi, DEBUTANT İDDİA EDİLMEZ
  | "TRUE_DEBUTANT" // tjkAtId doğrulandı, geçmiş sorgulandı, GERÇEKTEN 0 satır
  | "HISTORICAL_COVERAGE_GAP" // geçmiş var ama ilgili sinyal için yetersiz gözlem
  | "OBSERVED_HISTORY"; // yeterli, güvenilir gözlem var

export function classifyCoverage(
  identityKnown: boolean,
  totalHistoryRows: number,
  observationCount: number,
  minObservations = 5
): CoverageState {
  if (!identityKnown) return "IDENTITY_UNRESOLVED";
  if (totalHistoryRows === 0) return "TRUE_DEBUTANT";
  if (observationCount >= minObservations) return "OBSERVED_HISTORY";
  return "HISTORICAL_COVERAGE_GAP";
}

/**
 * Bir yarışın bitiş sonucu — "N=1, koşmaz, diskalifiye ve derecesiz bitirişler için açık
 * veri sözleşmesi oluşturulmalı" (kullanıcı kuralı §1.1) talimatının TİP SİSTEMİNDEKİ
 * karşılığı. Her durum AYRI bir etiket taşır — hiçbiri "son sıra" ya da "eksik veri" ile
 * KARIŞTIRILAMAZ, çünkü finishRatio() yalnız `kind:"finished"` kabul eder.
 */
export type RaceOutcome =
  // confidence: N'in kaynağı (Runner sayımı) ile çapraz-doğrulama kaynağının
  // (Result.actualOrder) uyuşup uyuşmadığını taşır — bkz. history-source.ts
  // resolveFieldSize. "low" güvenli satırlar çağıran tarafça dışlanabilir/ağırlık
  // düşürülebilir (kullanıcı kuralı: "Geçerli rakip sayısı azsa/güvenilmezse referansın
  // güven düzeyi düşürülecek").
  | { kind: "finished"; position: number; fieldSize: number; confidence: "high" | "low" }
  // 2026-10-17 — gerçek veri denetiminde bulundu: HorseRaceHistoryCache'in geçmiş
  // satırları bitiriş SIRASINI taşıyor ama o yarışın TOPLAM saha büyüklüğünü (N)
  // taşımıyor — N yalnız BİZİM kendi Race/Runner tablomuzda o yarış varsa çapraz-
  // sorgulanabiliyor (resolveFieldSize). Bu, "hiç kayıt yok" (missing) İLE
  // KARIŞTIRILAMAZ — pozisyonu BİLİYORUZ, yalnız oranı (R) hesaplayamıyoruz.
  | { kind: "finished-unknown-field-size"; position: number }
  | { kind: "dnf" } // yarışı tamamlamadı
  | { kind: "dq" } // diskalifiye
  | { kind: "no-time" } // derecesiz bitiriş (TJK kaynağı DNF/DQ/koşmadı'yı AYIRMIYOR, hepsi boş hücre)
  | { kind: "missing" }; // bu yarışa dair hiç kayıt yok (veri eksikliği, SONUÇ değil)

/**
 * R = (N-p)/(N-1) — bitiriş-oranı. Yalnız GERÇEKTEN bitirilmiş (kind:"finished") ve
 * N>=2 olan yarışlar için bir sayı döner; aksi halde null. Çağıran taraf dnf/dq/no-time/
 * missing durumlarını KENDİ BAĞLAMINDA (ör. "geçerli yarış sayısına dahil et/etme")
 * ayrıca ele almalı — bu fonksiyon o kararı GİZLİCE vermez.
 */
export function finishRatio(outcome: RaceOutcome): number | null {
  if (outcome.kind !== "finished") return null;
  const { position, fieldSize } = outcome;
  if (fieldSize <= 1) return null; // N=1: tanımsız, "1. oldu" gibi yanıltıcı bir sayı ÜRETİLMEZ
  if (!Number.isFinite(position) || !Number.isFinite(fieldSize)) return null;
  if (position < 1 || position > fieldSize) return null;
  return (fieldSize - position) / (fieldSize - 1);
}

/**
 * GEÇİCİ/PLACEHOLDER yarı-ömür değeri — doğrulama setinden ÖĞRENİLMEDİ (kullanıcı kuralı
 * §1.2: "h elle tahmin edilerek sabitlenmemeli"). Yalnız erken geliştirme/birim testi
 * için var; gerçek eğitim tamamlanmadan ÜRETİM KARARINA sokulmaz. Her kullanım yerinde
 * bu bayrağın farkında olunmalı.
 */
export const PLACEHOLDER_HALF_LIFE_DAYS = 120;

/** w_k = exp(-ln(2)·Δt_k/h). h<=0 ise tanımsız → null (çağıran hatayı yutmamalı). */
export function timeDecayWeight(deltaDays: number, halfLifeDays: number): number | null {
  if (!Number.isFinite(deltaDays) || deltaDays < 0) return null;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return null;
  return Math.exp((-Math.LN2 * deltaDays) / halfLifeDays);
}

/** Σ(w_k·R_k)/Σw_k — null değerli (ağırlık veya değer) girdiler ATLANIR, dahil edilmez. */
export function weightedAverage(points: { value: number | null; weight: number | null }[]): number | null {
  let sumW = 0;
  let sumWV = 0;
  let n = 0;
  for (const p of points) {
    if (p.value == null || p.weight == null || !Number.isFinite(p.value) || !Number.isFinite(p.weight)) continue;
    sumW += p.weight;
    sumWV += p.weight * p.value;
    n++;
  }
  if (n === 0 || sumW === 0) return null;
  return sumWV / sumW;
}

/**
 * z = (x-μ)/σ. μ/σ YALNIZ eğitim bölümünden hesaplanmış olmalı (kullanıcı kuralı §1.3) —
 * bu fonksiyon bunu DENETLEYEMEZ, yalnız uygular; μ/σ'nın doğru (test verisi sızdırmamış)
 * kaynaktan geldiğinden çağıran taraf sorumludur (bkz. registry'deki asOfPolicy alanları).
 */
export function zScore(x: number | null, mu: number, sigma: number): number | null {
  if (x == null || !Number.isFinite(x)) return null;
  if (!Number.isFinite(sigma) || sigma === 0) return null;
  return (x - mu) / sigma;
}

/** Robust ölçek: median absolute deviation, 1.4826 ile normal-dağılım-eşdeğer çarpanı. */
export function medianAbsoluteDeviation(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const med = median(finite);
  const deviations = finite.map((v) => Math.abs(v - med));
  return median(deviations);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Gauss çekirdeği (mesafe-yakınlığı ağırlıklandırması, §PMZ_02). h<=0 ise null. */
export function gaussianKernel(x: number, center: number, bandwidth: number): number | null {
  if (!Number.isFinite(bandwidth) || bandwidth <= 0) return null;
  const diff = Math.log(x / center);
  return Math.exp(-(diff * diff) / (2 * bandwidth * bandwidth));
}

/** Bayesçi/shrinkage küçültme: n/(n+k) — k arttıkça küçük örneklemler sıfıra çekilir. */
export function shrinkageFactor(n: number, k: number): number {
  if (n <= 0) return 0;
  if (k < 0) return 1;
  return n / (n + k);
}

/**
 * Efektif örneklem büyüklüğü — n_eff = (Σw)²/Σw². Gauss çekirdeği gibi SÜREKLİ (hiçbir
 * zaman tam sıfır olmayan) ağırlıklarla çalışan sinyallerde (ör. PMZ_02 mesafe yakınlığı)
 * "kaç gözlem gerçekten katkı sağladı" sorusuna tamsayı bir gözlem SAYISI yoktur — bu,
 * standart istatistiksel karşılığıdır (kullanıcı kuralı: az gözlemli sonuçlara güvenilirlik/
 * küçültme uygulanmalı, bu fonksiyon o küçültmenin "n" girdisini üretir).
 */
export function effectiveSampleSize(weights: number[]): number {
  const finite = weights.filter((w) => Number.isFinite(w) && w > 0);
  if (finite.length === 0) return 0;
  const sumW = finite.reduce((a, b) => a + b, 0);
  const sumW2 = finite.reduce((a, b) => a + b * b, 0);
  if (sumW2 === 0) return 0;
  return (sumW * sumW) / sumW2;
}

/** logit(p) = ln(p/(1-p)). p, sayısal güvenlik için [eps, 1-eps] aralığına kırpılır. */
export function logit(p: number, eps = 1e-6): number {
  const clamped = Math.min(1 - eps, Math.max(eps, p));
  return Math.log(clamped / (1 - clamped));
}
