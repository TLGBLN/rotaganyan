// RESCUE — SHADOW (prospektif doğrulama, 2026-10-10 kullanıcı kararı). DONDURULMUŞ kural —
// VALIDATION_START_DATE'ten SONRA eşikler/ağırlıklar DEĞİŞTİRİLMEYECEK, "en iyi eşiği" aramak
// için veri üzerinde tekrar gezilmeyecek. Production'a (V5.46.1 scorer/weights, kupon
// optimizer, kullanıcıya gösterilen HİÇBİR ekran) etkisi yok — yalnız rescue-shadow.service.ts'
// teki GÖLGE (paralel, salt gözlem) hesaplamada kullanılır.
//
// Arka plan (2026-10-10 AGF Dominance Audit + İki-Katman Stacking + RESCUE düzeltme turu):
// AGF_GROUP (agfSirasi/agfPayi/agfPayi2) V5.46.1'in en baskın sinyali (medyan dominance 4.46x,
// p75=10.5x — bkz. audit). Ama AGF'nin düşük gördüğü (marketRank>6) havuzun İÇİNDE, kalan 16
// özellikten (FUNDAMENTALS) kurulan AYRI bir modelin yüksek gördüğü atlar, AYNI havuzdaki
// emsallerine göre anlamlı daha fazla kazanıyor: RESCUE3 win=%4.47 vs NON_RESCUE=%2.52
// (race-cluster CI=[+0.98,+3.49]pp, gün-kümeli CI=[+0.77,+3.41]pp, risk ratio CI=[1.37,2.35],
// ikisi de sıfırı/1'i dışlıyor); RESCUE6 win=%3.62 vs %2.31 (CI=[+0.83,+1.83]pp). Koşullu
// lojistik regresyon (marketRank/fieldSize/segment kontrollü) da fundScoreZ'yi bağımsız anlamlı
// buldu (β=+0.126, CI=[+0.075,+0.200]). KRİTİK UYARI: bu sonuç Nisan-Eylül 2026 OOS penceresinde
// bulundu — bu pencere artık (jokey/TEMP_CAL/AGF-ablation/stacking/RESCUE) defalarca kullanıldı,
// teknik olarak development set'e dönüştü. Prospektif (hiç dokunulmamış) doğrulama ZORUNLU —
// bu dosya/servis o doğrulamanın altyapısıdır, henüz KANIT değildir.
import marketWeights from "@/lib/methodology/weights/rescue-market-weights.json";
import fundWeights from "@/lib/methodology/weights/rescue-fundamentals-weights.json";

export const RESCUE_VERSION = "rescue-shadow-v1";
// RESCUE3/6 TANIMI — DONDURULDU, eşiklerle bir daha oynanmayacak (kullanıcı talebi).
export const RESCUE3_FUND_ESIK = 3;
export const RESCUE6_FUND_ESIK = 6;
export const MARKET_RANK_ESIK = 6; // marketRank > 6

// Prospektif (gerçek ileri-doğrulama) penceresinin başlangıcı — kural dondurulduktan SONRAKİ
// ilk gün. Bu tarihten ÖNCEKİ shadow kayıtları (varsa backfill/smoke-test) karar metriklerine
// KATILMAZ (validationEligible=false) — TEMP_CAL shadow'daki AYNI güvenlik kilidi.
export const VALIDATION_START_DATE = "2026-10-10";

export function hesaplaRuleHash(): string {
  const payload = `${RESCUE_VERSION}|rescue3<=${RESCUE3_FUND_ESIK}|rescue6<=${RESCUE6_FUND_ESIK}|market>${MARKET_RANK_ESIK}|marketW=${marketWeights.version}|fundW=${fundWeights.version}`;
  let h = 0;
  for (let i = 0; i < payload.length; i++) { h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0; }
  return `rh_${(h >>> 0).toString(16)}`;
}
export const RESCUE_RULE_HASH = hesaplaRuleHash();

type Sinyal = { kod: string; hamDeger: number };

/** Pick.featureSnapshot.tumSinyaller'den (scoreV461'in GERÇEK üretim çıktısı, yayın anında
 *  kaydedilmiş — bkz. test-v5-engine/route.ts p.features) MARKET/FUNDAMENTALS skorunu
 *  DONDURULMUŞ ağırlıklarla hesaplar. Canlı yeniden-skorlama YOK — yalnız o anda yayınlanmış
 *  hamDeger'ler okunur (RCA/TEMP_CAL shadow ile AYNI PIT disiplini). */
export function hesaplaMarketVeFundamentalSkor(tumSinyaller: Sinyal[]): { marketScore: number; fundamentalScore: number } | null {
  const hamByKod = new Map(tumSinyaller.map((s) => [s.kod, s.hamDeger]));
  const agfSirasi = hamByKod.get("agfSirasi");
  const agfPayi = hamByKod.get("agfPayi");
  if (agfSirasi == null || agfPayi == null) return null; // temel AGF verisi yoksa hesaplanamaz

  const N = marketWeights.norm as Record<string, { m: number; sd: number }>;
  const w = marketWeights.weights as number[];
  const agfPayi2 = agfPayi * agfPayi;
  const marketZ = [
    (agfSirasi - N.agfSirasi.m) / (N.agfSirasi.sd || 1),
    (agfPayi - N.agfPayi.m) / (N.agfPayi.sd || 1),
    (agfPayi2 - N.agfPayi2.m) / (N.agfPayi2.sd || 1),
  ];
  const marketScore = marketZ.reduce((s, z, i) => s + z * w[i], 0);

  const NF = fundWeights.norm as Record<string, { m: number; sd: number } | { m: number[]; sd: number[] }>;
  const wF = fundWeights.weights as number[];
  const temelKodlar = ["idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani"];
  let fundamentalScore = 0;
  let idx = 0;
  for (const kod of temelKodlar) {
    const ham = hamByKod.get(kod) ?? 0;
    const n = NF[kod] as { m: number; sd: number };
    fundamentalScore += ((ham - n.m) / (n.sd || 1)) * wF[idx];
    idx++;
  }
  // ACC_CLOSE_RES/ACC_LATE/ACC_SPEED — tumSinyaller'de bu kod'larla GELMİŞ reliability-ağırlıklı
  // z değeri zaten (standartDeger) V5.46.1'in KENDİ hesabı — RESCUE kendi reliability'sini
  // yeniden hesaplamıyor (Pick.featureSnapshot ham Accurace reliability taşımıyor), bunun
  // yerine V5.46.1'in standartDeger'ini (zaten reliability-ağırlıklı) GİRDİ olarak kullanıp
  // KENDİ frozen β'sıyla çarpıyor — ayrı bir norm katmanı GEREKMİYOR (standartDeğer zaten z-skor).
  for (const kod of ["ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED"]) {
    const z = tumSinyaller.find((s) => s.kod === kod);
    if (z && "standartDeger" in (z as object)) fundamentalScore += (z as unknown as { standartDeger: number }).standartDeger * wF[idx];
    idx++;
  }
  // PS_0/1/2 (pace) — V5.46.1'in kendi PS_front/PS_lone/PS_closerFit standartDeger'i (zaten
  // reliability-ağırzlıklı z) kullanılıyor, AYNI gerekçeyle.
  const paceKodlar = ["PS_front", "PS_lone", "PS_closerFit"];
  for (const kod of paceKodlar) {
    const z = tumSinyaller.find((s) => s.kod === kod);
    if (z && "standartDeger" in (z as object)) fundamentalScore += (z as unknown as { standartDeger: number }).standartDeger * wF[idx];
    idx++;
  }
  return { marketScore, fundamentalScore };
}
