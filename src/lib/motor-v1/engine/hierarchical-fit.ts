// ROTAGANYAN V1.0 — KOŞULA UYARLANMIŞ, TEK-AŞAMALI HİYERARŞİK KOŞULLU-LOGİT (deneysel,
// 2026-10-22). Mevcut `src/lib/v5461/conditional-logit.ts`'e (V5.46.1'in de paylaştığı
// saf matematik) HİÇ DOKUNULMAZ — yalnız `raceGradient`/`dot` salt-okunur import edilir,
// AYRI bir fonksiyon burada tanımlanır. V5.46.1'in kendisi bu dosyadan ETKİLENMEZ.
//
// TASARIM (kullanıcının 4 düzeltmesiyle, TEK aşamalı, iyi-tanımlı):
//   skor_i = Σ_k (β_k + η_k,koşul(i)) · z_k,i   — ama η yalnız AİLE düzeyinde tanımlı:
//   özellik vektörü = [38 temel z-skor (30+8 ilişki, TEK kez)] + [10 aile × N koşul
//   etkileşim sütunu = ham (AĞIRLIKSIZ) aile-temel-z-toplamı × koşul-göstergesi].
//   η'ler öğrenilen β'larla ÇARPILMAZ — doğrudan, ham z-skorların toplamına eklenen YENİ
//   sütunlardır (standart doğrusal etkileşim-terimi, β×δ tanımlanamazlığı YOK).
//   Yalnız bu yeni sütunlara TEK paylaşılan λ_etkileşim uygulanır (ridge — BÜZER, tam
//   sıfırlamaz). Orijinal 38 sütun, mevcut β'lara (prior) hafif bir λ_temel ile çekilir
//   (GEN/DAV'ın standardizasyonu değiştiği için prior'ın KENDİSİ de yeniden hesaplanmalı —
//   bu dosya yalnız FIT MEKANİZMASINI sağlar, veri hazırlığı ayrı script'lerin işi).
import { raceGradient, type TrainingRunner } from "../../v5461/conditional-logit";

export type HierarchicalFitOptions = {
  lambdaVector: number[]; // HER özellik için AYRI düzenlileştirme gücü (aynı uzunlukta özellik vektörü)
  priorVector: number[]; // HER özellik için düzenlileştirmenin çektiği hedef değer (genelde 0, temel 38'de mevcut β)
  learningRate: number;
  iterations: number;
};

/** fitConditionalLogit İLE AYNI gradyan-inişi iskeleti, YALNIZ düzenlileştirme skaler
 *  değil VEKTÖR — her özellik kendi λ'sı ve kendi hedefiyle çekilir. */
export function fitConditionalLogitHierarchical(
  races: TrainingRunner[][],
  featureCount: number,
  opts: HierarchicalFitOptions
): number[] {
  if (opts.lambdaVector.length !== featureCount || opts.priorVector.length !== featureCount) {
    throw new Error(`lambdaVector/priorVector uzunluğu featureCount (${featureCount}) ile eşleşmiyor`);
  }
  const beta = [...opts.priorVector];
  for (let step = 0; step < opts.iterations; step++) {
    const grad: number[] = Array(featureCount).fill(0);
    for (const race of races) {
      const rg = raceGradient(race, beta);
      for (let j = 0; j < featureCount; j++) grad[j] += rg[j];
    }
    const scale = 1 / Math.max(1, races.length);
    for (let j = 0; j < featureCount; j++) {
      const g = grad[j] + 2 * opts.lambdaVector[j] * (beta[j] - opts.priorVector[j]);
      beta[j] -= opts.learningRate * g * scale;
    }
  }
  return beta;
}

/** Yarış-tipine göre 5 kaba koşul kategorisi — model geliştirme kararında sabit
 *  (Pist/Mesafe/Irk çaprazları bu turda VERİ YETERSİZ bulundu, DAHİL EDİLMEDİ). */
export const KOSUL_KATEGORILERI = ["HANDİKAP", "ŞARTLI", "MAIDEN", "KV", "DİĞER"] as const;
export type KosulKategorisi = (typeof KOSUL_KATEGORILERI)[number];

/** DAV DUZELTMESI, DUZELTILMIS TANI (2026-10-22): ilk denemem (Laplace-duzeltmeli sigma)
 *  YANLIS cikti — n=1161 gibi buyuk orneklemde Laplace'in +1 sozde-gozlemi ihmal edilebilir
 *  kaliyor (13.87 -> 12.86, pratikte degisiklik yok). GERCEK teshis: sigma zaten DOGRU
 *  hesaplaniyor (olay gercekten nadir, kucuk sigma MATEMATIKSEL olarak beklenen) — sorun
 *  sigma'nin kendisi DEGIL, bu dogru-ama-kucuk sigma'dan dogan ASIRI BUYUK z'nin skora
 *  dogrudan tasinmasi. Dogru duzeltme: z'yi SINIRLAMAK (sigma'yi degil).
 *
 *  Z_CAP, TRAIN'in KENDI verisinden, 8 iliski kodu HARIC tutularak (onlar da bagimli bir
 *  ikili bilesen tasiyabilir — ornek: TMP_DAV_01, DAV_TAKI_EKLENDI'yi miras alir ve z=28.36
 *  uretir, referansi bozar) SAF 30 temel koddaki en buyuk dogal |z| olarak turetilir
 *  (bu TRAIN setinde: RAK_GAP_01, |z|=10.83 -> yuvarlanarak 11). Yani "hicbir sinyal,
 *  gercekten surekli olan sinyallerin dogal olarak ulastigi en uc noktadan daha asiri
 *  standartlastirilmis olamaz" ilkesi — keyfi bir sayi degil, veriden turetilmis.
 */
export const INTERACTION_CODES = new Set([
  "GEN_PMZ_YET_01", "YET_PMZ_01", "FRM_GEN_01", "ANT_FRM_01",
  "TMP_DAV_01", "YET_PMZ_RAK_01", "KIL_PMZ_YET_01", "RAK_YET_TMP_01",
]);

export function isIkiliKod(values: number[]): boolean {
  if (values.length < 2) return false;
  const distinctSet = new Set(values);
  return [...distinctSet].every((v) => v === 0 || v === 1) && distinctSet.size <= 2;
}

/** TRAIN'in SAF (iliski-kodu olmayan) kodlarindan dogal Z_CAP turetir. */
export function turetZCap(rawByCode: Map<string, number[]>): number {
  let maxZ = 0;
  for (const [code, values] of rawByCode) {
    if (INTERACTION_CODES.has(code)) continue;
    if (isIkiliKod(values)) continue;
    if (values.length < 2) continue;
    const mu = values.reduce((a, b) => a + b, 0) / values.length;
    const sigma = Math.sqrt(values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length) || 1;
    for (const v of values) maxZ = Math.max(maxZ, Math.abs((v - mu) / sigma));
  }
  return Math.ceil(maxZ);
}

/** Z_CAP'i yalniz ikili kodlara (+ ikili bir bileseni miras alan TMP_DAV_01'e) uygular —
 *  surekli kodlarin z'si DEGISMEZ. Kod ADINA gore degil YAPISINA (ikili mi) gore sececek
 *  sekilde GENEL bir kural — DAV_TAKI_EKLENDI/CIKARILDI'ye ozel yazilmadi. */
export function zKirp(z: number, code: string, ikiliMi: boolean, zCap: number): number {
  if (!ikiliMi && code !== "TMP_DAV_01") return z;
  return Math.max(-zCap, Math.min(zCap, z));
}

export function kosulKategorisiCoz(classType: string | null): KosulKategorisi {
  if (classType == null || classType === "—") return "DİĞER";
  const c = classType.toUpperCase();
  if (c.includes("KISA VADE HANDİKAP") || c.includes("KISA VADE HANDIKAP") || c.startsWith("HANDİKAP") || c.startsWith("HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("MAIDEN")) return "MAIDEN";
  if (c.startsWith("ŞARTLI") || c.startsWith("SARTLI")) return "ŞARTLI";
  if (c.startsWith("KV-") || c.startsWith("KV ")) return "KV";
  return "DİĞER";
}
