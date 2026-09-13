import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import v5WeightsDiger from "@/lib/methodology/weights/v5-weights-diger.json";

/**
 * 2026-08-22 kullanıcı bulgusu: panel başlığındaki sürüm/özellik-sayısı METNİ daha önce
 * İKİ KEZ sabit (hardcoded) yazılıp güncellenmeyi unutulmuştu (V5.1→V5.3, sonra V5.3→V5.5
 * arası) — kullanıcı ekranda hâlâ eski sürümü görüyordu. Artık FEATURE_NAMES.length'ten
 * (gerçek özellik sayısı) VE ENGINE_VERSIONS'ın son (bitis:null) girdisinden TÜRETİLİYOR,
 * bir daha elle güncellenmesi gerekmiyor.
 *
 * 2026-08-27 kullanıcı talebi: bu etiket "Analiz Et"e basmadan ÖNCE de görünsün — v5-engine.ts
 * db (Prisma) import ettiği için CLIENT bileşenlerinden (V5AnalysisPanel) doğrudan import
 * edilemiyordu. Bu yüzden hesaplama, db'siz bu ayrı dosyaya taşındı; v5-engine.ts ve
 * test-v5-engine/route.ts buradan re-export/import eder — tek kaynak, iki yerde tekrar yok.
 *
 * 2026-09-13 kullanıcı bulgusu: etiket yalnız A katmanını (toFeatureVector/featureNames.length)
 * sayıyordu — B katmanı (sireOrani + zeminMesafeDeneyimi, softmax'tan ÖNCE ayrı kalibre edilip
 * skora eklenen, regresyona hiç girmeyen 2 sinyal, bkz. v5-engine.ts bKatmaniUygula) hiç
 * görünmüyordu, kullanıcı "13 mü 15 mi" diye kafası karıştı. B_KATMANI_SINYAL_SAYISI elle
 * sabit (A katmanı gibi bir dosyadan türetilemiyor, yalnızca iki adet ve isim değişmiyor) —
 * bKatmaniUygula'ya yeni bir B katmanı sinyali eklenirse burada da güncellenmeli.
 */
const B_KATMANI_SINYAL_SAYISI = 2; // sireOrani + zeminMesafeDeneyimi
const A_KATMANI = v5WeightsDiger.featureNames.length;
export const CURRENT_ENGINE_LABEL = `${ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1].versiyon} — Koşullu Logit Modeli (${A_KATMANI}+${B_KATMANI_SINYAL_SAYISI} sinyal — ${A_KATMANI} A-katmanı özelliği + ${B_KATMANI_SINYAL_SAYISI} B-katmanı, segment-bazlı iki model — atları doğrudan kıyaslar, Claude yok, maliyet sıfır)`;
