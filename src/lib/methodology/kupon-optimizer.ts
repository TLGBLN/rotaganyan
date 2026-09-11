// 2026-09-11 kullanıcı bulgusu ("bir 600 TL'lik kupon yaparken bu mantıkla hiç kupon
// tutturamayız") — rozetler (3 AT/6 AT/GENİŞ) her ayağı TEK BAŞINA, bütçeden bağımsız
// değerlendiriyor. 6 ayağın HER birine "güvenli" 3 at bile yazsan 3⁶=729 kombinasyon
// (911₺) çıkar — Ekonomik'in (600-700₺) üstünde, tek bir ayak bile geniş istemese bile.
// Gerçek soru "her ayak kendi başına ne ister" değil, "sabit bütçeyi 6 ayak arasında NASIL
// DAĞITAYIM ki toplam isabet olasılığı en yüksek olsun" — bu ayrı, optimizasyon gerektiren
// bir problem.
//
// Matematik: bir kuponun TUTMA olasılığı P = ∏ᵢ pᵢ(nᵢ) — pᵢ(nᵢ) = i. ayakta seçilen ilk nᵢ
// atın olasılık toplamı (bağımsız koşular, çarpım kuralı). Kombinasyon sayısı da ∏ᵢ nᵢ —
// yani hem amaç hem kısıt ÇARPIMSAL. log alınca ikisi de TOPLAMSAL olur (Σ log pᵢ(nᵢ)
// maksimize, Σ log nᵢ ≤ log(maxKombinasyon) kısıtlı) — klasik ayak-ayak DP ile çözülür:
// dp[c] = "şimdiye kadarki ayaklarda TAM c kombinasyon kullanılarak ulaşılabilen en yüksek
// toplam log-olasılık". Devlet uzayı c ∈ [1, maxKombinasyon] ile sınırlı kalır (bütçeyi
// aşan hiçbir dal saklanmaz), pratikte birkaç bin durumda milisaniyeler içinde biter.
export type LegProbability = {
  raceNo: number;
  /** Bu ayaktaki (çekilenler hariç) her atın no'su ve kazanma olasılığı (0-1 arası, kesir). */
  runners: { no: number; olasilik: number }[];
};

export type OptimizeResult = {
  /** raceNo -> seçilen at no'ları (olasılığa göre en iyi ilk n). */
  secimler: Record<number, number[]>;
  toplamKombinasyon: number;
  /** Kuponun TAMAMININ tutma olasılığı (∏ᵢ pᵢ(nᵢ)) — 0-1 arası. */
  kapsamaOlasiligi: number;
};

export function optimizeKuponAllocation(legs: LegProbability[], maxCombinations: number): OptimizeResult {
  if (legs.length === 0 || maxCombinations < 1) {
    return { secimler: {}, toplamKombinasyon: 0, kapsamaOlasiligi: 0 };
  }

  const legOptions = legs.map((leg) => {
    const sirali = [...leg.runners].sort((a, b) => b.olasilik - a.olasilik);
    const kumulatif: number[] = [];
    let toplam = 0;
    for (const r of sirali) {
      toplam += r.olasilik;
      kumulatif.push(toplam);
    }
    return { raceNo: leg.raceNo, sirali, kumulatif };
  });

  type Durum = { logOlasilik: number; secimSayilari: number[] };
  let dp = new Map<number, Durum>([[1, { logOlasilik: 0, secimSayilari: [] }]]);

  for (const opt of legOptions) {
    const yeniDp = new Map<number, Durum>();
    for (const [c, durum] of dp) {
      for (let n = 1; n <= opt.kumulatif.length; n++) {
        const yeniC = c * n;
        if (yeniC > maxCombinations) break; // n arttıkça c*n de artar — erken kesilebilir
        const p = opt.kumulatif[n - 1];
        if (p <= 0) continue;
        const yeniLog = durum.logOlasilik + Math.log(p);
        const mevcut = yeniDp.get(yeniC);
        if (!mevcut || mevcut.logOlasilik < yeniLog) {
          yeniDp.set(yeniC, { logOlasilik: yeniLog, secimSayilari: [...durum.secimSayilari, n] });
        }
      }
    }
    dp = yeniDp;
  }

  let enIyi: Durum | null = null;
  let enIyiC = 0;
  for (const [c, durum] of dp) {
    if (!enIyi || durum.logOlasilik > enIyi.logOlasilik) {
      enIyi = durum;
      enIyiC = c;
    }
  }
  if (!enIyi) return { secimler: {}, toplamKombinasyon: 0, kapsamaOlasiligi: 0 };

  const secimler: Record<number, number[]> = {};
  legOptions.forEach((opt, i) => {
    const n = enIyi!.secimSayilari[i];
    secimler[opt.raceNo] = opt.sirali.slice(0, n).map((r) => r.no);
  });

  return { secimler, toplamKombinasyon: enIyiC, kapsamaOlasiligi: Math.exp(enIyi.logOlasilik) };
}
