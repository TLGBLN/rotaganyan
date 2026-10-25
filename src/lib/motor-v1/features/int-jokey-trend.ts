// ROTAGANYAN ANALİZ MOTORU v1.0 — JOKEY TRENDİ (İLİŞKİ #3'ün düzeltmesi, 2026-10-18 kullanıcı
// geri bildirimi): "JOKEY_01 son 30 günlük performansı ölçüyorsa bu, yükseliş/düşüş
// TRENDİYLE AYNI ŞEY DEĞİLDİR." JOKEY_01 bir SEVİYE (son 30 gün), bu dosya bir FARK
// (son 30 gün − önceki 30 gün) üretir — registry'nin JOK_T02 formülüyle (logit farkı) TUTARLI.
//
// Mevcut computeJokeySon30Form (jokey.ts) YENİDEN YAZILMADI — AYNI fonksiyon İKİ farklı
// cutoff'la (bugün, bugün-30g) çağrılarak "önceki 30 gün" penceresi elde edilir (cutoff'u
// 30 gün geri almak = [cutoff-60g, cutoff-30g] penceresini verir, computeJokeySon30Form'un
// KENDİ iç mantığı — windowStart=cutoff-30g — sabit).
//
// MOUNT KALİTESİ KISITI (kullanıcı talebi "mümkünse atların gücünü de dikkate al" — AÇIKÇA
// KARŞILANAMADI): JOKEY_01/02 ile AYNI naif p=1/saha-büyüklüğü referansını kullanır — model-
// tabanlı (FORM/HIZ/SINIF/PMZ/TEMPO'dan out-of-fold) "bindiği atların gücü" düzeltmesi HENÜZ
// YOK (JOKEY_01'in modelBasedExpectedWins alanı zaten HER ZAMAN null) — bu TREND hesabı da
// AYNI kısıtı miras alır, dürüstçe `mountQualityControlled:false` ile işaretlenir.

import { computeJokeySon30Form } from "./jokey";
import { logit, shrinkageFactor } from "./common";

const TREND_SHRINKAGE_K = 15; // GEÇİCİ — eğitimden doğrulanana kadar (SINIF_SHRINKAGE_K ile AYNI dürüstlük ilkesi)
const MIN_BINIS_ICIN_GUVENILIR = 5; // her iki pencerede de bu sayının altı -> trend 0'a küçültülür

export type JokeyTrendResult = {
  son30: { wins: number; observed: number; p: number | null };
  onceki30: { wins: number; observed: number; p: number | null };
  rawTrend: number | null; // logit(p_son30) - logit(p_onceki30), Laplace-düzeltmeli
  value: number | null; // shrinkage uygulanmış (az binişte 0'a küçültülür)
  observed: boolean;
  mountQualityControlled: false; // AÇIKÇA sabit — kullanıcı bu kısıtı bilsin, gizlenmesin
  missingReason: string | null;
};

function laplaceP(wins: number, n: number): number {
  // n=0 ise tanımsız (çağıran taraf ayrıca kontrol eder) — Laplace/Beta(1,1) düzeltmesi,
  // logit(0) veya logit(1)'in ±Infinity vermesini önler.
  return (wins + 1) / (n + 2);
}

export async function computeJokeyTrend30(jockeyName: string | null, cutoff: Date): Promise<JokeyTrendResult> {
  const empty = (missingReason: string): JokeyTrendResult => ({
    son30: { wins: 0, observed: 0, p: null }, onceki30: { wins: 0, observed: 0, p: null },
    rawTrend: null, value: null, observed: false, mountQualityControlled: false, missingReason,
  });
  if (jockeyName == null) return empty("jokey adı bilinmiyor");

  const oncekiCutoff = new Date(cutoff.getTime() - 30 * 86_400_000);
  const [son30, onceki30] = await Promise.all([
    computeJokeySon30Form(jockeyName, cutoff),
    computeJokeySon30Form(jockeyName, oncekiCutoff),
  ]);
  if (son30 == null || onceki30 == null) return empty("jokey adı bilinmiyor");

  const n1 = son30.observedCount, n2 = onceki30.observedCount;
  if (n1 === 0 || n2 === 0) {
    return {
      son30: { wins: son30.wins, observed: n1, p: n1 > 0 ? son30.wins / n1 : null },
      onceki30: { wins: onceki30.wins, observed: n2, p: n2 > 0 ? onceki30.wins / n2 : null },
      rawTrend: null, value: null, observed: false, mountQualityControlled: false,
      missingReason: n1 === 0 && n2 === 0 ? "iki pencerede de hiç gözlemli biniş yok" : n1 === 0 ? "son 30 günde gözlemli biniş yok" : "önceki 30 günde gözlemli biniş yok",
    };
  }

  const p1 = laplaceP(son30.wins, n1);
  const p2 = laplaceP(onceki30.wins, n2);
  const rawTrend = logit(p1) - logit(p2);
  const combinedN = Math.min(n1, n2); // ZAYIF pencere belirleyici — tek pencere az ise GÜVEN DÜŞÜK
  const shrink = combinedN < MIN_BINIS_ICIN_GUVENILIR ? shrinkageFactor(combinedN, TREND_SHRINKAGE_K) : shrinkageFactor(combinedN, TREND_SHRINKAGE_K);
  const value = rawTrend * shrink;

  return {
    son30: { wins: son30.wins, observed: n1, p: son30.wins / n1 },
    onceki30: { wins: onceki30.wins, observed: n2, p: onceki30.wins / n2 },
    rawTrend, value, observed: true, mountQualityControlled: false,
    missingReason: combinedN < MIN_BINIS_ICIN_GUVENILIR ? `düşük örneklem (min(n1,n2)=${combinedN}) — ağır küçültüldü, UYDURULMADI` : null,
  };
}
