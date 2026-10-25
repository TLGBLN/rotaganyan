// ROTAGANYAN ANALİZ MOTORU — Snapshot bütünlüğü + rank ayrımı (SAF FONKSİYONLAR, DB YOK).
//
// NEDEN BU DOSYA VAR (Faz 1, madde 2+4 — bkz. teslim raporu):
//
// 1) SNAPSHOT BÜTÜNLÜĞÜ: V5.46.1'in Pick.featureSnapshot'ı "bu kayıt bayat mı (stale)"
//    sorusunu CEVAPLAYAMIYOR — root-cause.service.ts bu yüzden "OLCULMEDI" (snapshot yok)
//    ile "snapshot var ama eski bir motor sürümünden kalma" durumlarını AYIRT EDEMİYOR.
//    Yeni motor için bu BAŞTAN çözülüyor: her snapshot kendi `engineVersion` +
//    `weightsFingerprint`'ini taşır, validateSnapshot() bunu "şu an geçerli" referansla
//    (engine-versions.ts::getCurrentRanEngineVersion + canlıda yüklü modelin GERÇEK
//    fingerprint'i) karşılaştırır.
//
// 2) ANALİZ-SIRALAMA-KUPON TUTARLILIĞI: V5.46.1'in Prediction.manualOverride'ı, elle
//    değiştirilen sırayı AYNI `rank` alanının ÜZERİNE yazıyor — motorun KENDİ ürettiği
//    orijinal sıra bir daha asla geri getirilemiyor (ayrı bir P0 bulgusu, bu motora özgü
//    DEĞİL). Yeni motorun snapshot tasarımı bu hatayı BAŞTAN tekrarlamıyor: `originalRank`
//    (motorun kendi ürettiği sıra) ve `publishedRank` (yayınlanan/elle değiştirilmiş sıra)
//    AYRI, birbirinin üzerine binmeyen alanlar — bkz. applyManualOverride.
//
// Bu dosya DB/network İMPORT ETMEZ — hem canlı koddan hem testten sorunsuz çağrılabilir.

import { createHash } from "node:crypto";

export type RanSignalSnapshotEntry = {
  code: string;
  raw: number | null;
  observed: boolean;
  reliability: number;
};

export type RanPredictionSnapshot = {
  raceId: string;
  no: number;
  engineVersion: string;
  weightsFingerprint: string;
  generatedAt: string; // ISO zaman damgası — üretim anı
  /** Motorun KENDİ ürettiği sıra — bir kez yazılır, applyManualOverride dahil HİÇBİR
   *  fonksiyon bunu değiştirmez. "Analiz ne dedi?" sorusunun KALICI cevabı. */
  originalRank: number;
  /** Yayınlanan/elle değiştirilmiş sıra — başlangıçta originalRank'e eşit, elle müdahale
   *  SADECE bunu değiştirir. "Kullanıcı ne gösterdi?" sorusunun cevabı. */
  publishedRank: number;
  signals: RanSignalSnapshotEntry[];
};

/** Fit edilmiş modelin (beta+names) deterministik bir "parmak izi". Aynı model → aynı hash;
 *  beta'da TEK bir katsayı değişse (yeniden eğitim) → farklı hash. toFixed(10) ile float
 *  serileştirme gürültüsü (ör. 0.1+0.2 gibi platformlar-arası farklar) elenir, gerçek bir
 *  katsayı değişikliğini GİZLEMEZ (10 ondalık, modelin anlamlı hassasiyetinin çok üstünde). */
export function computeWeightsFingerprint(model: { beta: readonly number[]; names: readonly string[] }): string {
  const payload = JSON.stringify({
    names: model.names,
    beta: model.beta.map((b) => Number(b.toFixed(10))),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export type SnapshotValidation = { status: "OK" | "STALE"; reasons: string[] };

/**
 * STALE kuralları (kullanıcı talimatı, Faz 1 madde 2 — örnek kurallar BİREBİR uygulanıyor):
 *  a) snapshot'taki sinyal kod kümesi `expectedCodes` ile TAM eşleşmiyorsa → STALE
 *     (eksik VEYA fazla kod — kısmi eşleşme YETERLİ SAYILMAZ, "Sert Koşul Yasak" kuralı
 *     burada TERSİNE işliyor: bütünlük kontrolünde gevşeklik GÜVENLİK AÇIĞI olur).
 *  b) weightsFingerprint mevcut eğitilmiş modelin fingerprint'iyle uyuşmuyorsa → STALE.
 *  c) engineVersion, getCurrentRanEngineVersion().surum ile uyuşmuyorsa → STALE (motor
 *     sürümü değişmiş, snapshot eski sürümden kalma).
 * Birden fazla kural aynı anda ihlal edilebilir — reasons TÜMÜNÜ listeler (ilk hatada
 * durmaz), teşhis için.
 */
export function validateSnapshot(
  snapshot: Pick<RanPredictionSnapshot, "engineVersion" | "weightsFingerprint" | "signals">,
  opts: { expectedCodes: readonly string[]; expectedFingerprint: string; expectedEngineVersion?: string }
): SnapshotValidation {
  const reasons: string[] = [];

  const snapshotCodes = new Set(snapshot.signals.map((s) => s.code));
  const expectedCodes = new Set(opts.expectedCodes);
  const missing = [...expectedCodes].filter((c) => !snapshotCodes.has(c));
  const extra = [...snapshotCodes].filter((c) => !expectedCodes.has(c));
  if (missing.length > 0 || extra.length > 0) {
    reasons.push(
      `sinyal kod kümesi UNIFIED_MODEL_CODES ile tam eşleşmiyor (eksik=[${missing.join(",")}], fazla=[${extra.join(",")}])`
    );
  }

  if (snapshot.weightsFingerprint !== opts.expectedFingerprint) {
    reasons.push(
      `weightsFingerprint uyuşmuyor (snapshot=${snapshot.weightsFingerprint.slice(0, 12)}…, güncel=${opts.expectedFingerprint.slice(0, 12)}…) — model snapshot alındıktan sonra yeniden eğitilmiş olabilir`
    );
  }

  if (opts.expectedEngineVersion != null && snapshot.engineVersion !== opts.expectedEngineVersion) {
    reasons.push(`engineVersion uyuşmuyor (snapshot=${snapshot.engineVersion}, güncel=${opts.expectedEngineVersion})`);
  }

  return reasons.length === 0 ? { status: "OK", reasons: [] } : { status: "STALE", reasons };
}

/**
 * Elle sıra değişikliği UYGULAR ama originalRank'e ASLA dokunmaz — V5.46.1'in
 * manualOverride bug'ının (tek `rank` alanı, orijinal motor sırası geri getirilemez hale
 * geliyor) bu motorda TEKRARLANMADIĞININ somut kanıtı (bkz. snapshot-integrity.test.ts).
 * Girdi snapshot MUTATE EDİLMEZ, yeni bir obje döner.
 */
export function applyManualOverride(snapshot: RanPredictionSnapshot, newPublishedRank: number): RanPredictionSnapshot {
  if (!Number.isInteger(newPublishedRank) || newPublishedRank < 1) {
    throw new Error(`applyManualOverride: geçersiz sıra: ${newPublishedRank}`);
  }
  return { ...snapshot, publishedRank: newPublishedRank };
}

/** Bir yarışın TÜM snapshot'larına toplu elle sıra ataması — her at için originalRank
 *  korunur, yalnız o atın publishedRank'i değişir. Aynı raceId'ye ait olmayan veya
 *  rankMap'te olmayan snapshot'lar DOKUNULMADAN döner. */
export function applyManualOverrideBatch(
  snapshots: readonly RanPredictionSnapshot[],
  rankMap: ReadonlyMap<number, number> // no -> yeni publishedRank
): RanPredictionSnapshot[] {
  return snapshots.map((s) => {
    const yeni = rankMap.get(s.no);
    return yeni == null ? s : applyManualOverride(s, yeni);
  });
}
