import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import safWeights from "@/lib/methodology/weights/v546-1-saf-weights.json";

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
 * 2026-10-09 — V5.46.1 (bkz. engine-versions.data.ts'teki aynı tarihli girdi): eski V5.46'nın
 * A/B katman ayrımı + segment-bazlı iki model mimarisi TAMAMEN kaldırıldı (tek skor + tek
 * softmax, src/lib/methodology/v546-1-engine.ts). Etiket artık ESKİ v5-weights-diger.json'dan
 * DEĞİL, v546-1-weights.json'ın featureNames'inden türetiliyor — B_KATMANI_SINYAL_SAYISI ve
 * "segment-bazlı iki model" ifadesi kaldırıldı, çünkü artık doğru değiller.
 *
 * 2026-11-10 — V5.46.1-SAF15 (bkz. engine-versions.data.ts'teki aynı tarihli girdi): V5.46.1
 * (19 özellik, AGF dahil) TAMAMEN KALDIRILDI, resmi motor artık scoreV461Saf (AGF'siz, 15
 * özellik). Etiket artık v546-1-weights.json'dan DEĞİL, v546-1-saf-weights.json'ın
 * featureNames'inden türetiliyor — bu dosyanın KENDİ geçmişinde bu etiketin ikinci kez
 * güncellenmeyi unutulduğu not düşülmüştü (2026-08-22), üçüncü kez olmasın diye.
 */
const AKTIF_SINYAL_SAYISI = safWeights.featureNames.length;
export const CURRENT_ENGINE_LABEL = `${ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1].versiyon} — Koşullu Logit Modeli (${AKTIF_SINYAL_SAYISI} aktif sinyal, AGF'siz — tek skor + softmax, segment override yok — atları doğrudan kıyaslar, Claude yok, maliyet sıfır)`;
