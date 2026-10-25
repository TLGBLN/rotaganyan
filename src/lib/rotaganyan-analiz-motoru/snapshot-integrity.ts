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
import type { SignalEffectRow } from "../motor-v1/engine/training";

// FAZ 3 AŞAMA 1 GENİŞLETMESİ (2026-10-25, kullanıcı talimatı — kritik bulgu): BU DOSYANIN
// ÖNCEKİ hali (RanSignalSnapshotEntry: {code, raw, observed, reliability}) explainRunner'ın
// GERÇEK ürettiği standardizedValue/learnedCoefficient/scoreContribution/missingIndicator*
// alanlarını HİÇ taşımıyordu. Bu eksikle RCA, bir snapshot'ı GERİYE dönüp açıklamak
// istediğinde (ör. "bu at neden geride kaldı, hangi katsayı ne kadar etki etti") eski ham
// veriden/eski model ağırlıklarından YENİDEN HESAPLAMA yapmak ZORUNDA kalırdı — ama o anki
// canlı veri (Accurace arşivi, galop, jokey/antrenör trend pencereleri) ZAMANLA DEĞİŞTİĞİ
// için yeniden hesaplama birebir AYNI sonucu vermeyebilir (point-in-time garantisi snapshot
// ANINDA sağlanır, GERİYE dönük yeniden kurulamaz). Şimdi explainRunner'ın ürettiği HER
// satır (SignalEffectRow) KAYIPSIZ taşınıyor — snapshot kendi kendine yeten bir kanıt.
export type RanSignalSnapshotEntry = {
  code: string;
  family: string | null;
  raw: number | null;
  observed: boolean;
  reliability: number;
  coverageState: string | null;
  /** explainRunner'ın modelVersion'u — training.ts::MODEL_VERSION, weightsFingerprint'ten
   *  FARKLI bir kavram (hesaplama FORMÜLÜNÜN sürümü, ağırlıkların KENDİSİ değil). */
  modelVersion: string;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  missingIndicatorCoefficient: number;
  missingIndicatorContribution: number;
};

/** explainRunner'ın ürettiği SignalEffectRow'dan, kayıpsız bire bir RanSignalSnapshotEntry'e
 *  çevirir — route/test/RCA'nın HEPSİ bu TEK dönüşümü kullanır, elle alan kopyalayan ikinci
 *  bir yer OLMAMALI (senkronizasyon dışı kalma riskini yapısal olarak kapatır). */
export function toRanSignalSnapshotEntry(row: SignalEffectRow<string>): RanSignalSnapshotEntry {
  return {
    code: row.code,
    family: row.family,
    raw: row.rawValue,
    observed: row.observed,
    // NOT (reliability alanı): paylaşılan SignalEntry/SignalEffectRow sürekli bir reliability
    // DEĞERİ taşımıyor — yalnız `observed` boolean'ı var. Burada 1/0 eşlemesi UYDURULMUŞ bir
    // ara değer DEĞİL, eldeki TEK gerçek veri (gözlem durumu) doğrudan yansıtılıyor (route.ts'teki
    // ÖNCEKİ davranışla AYNI, bkz. test-ran-engine/route.ts).
    reliability: row.observed ? 1 : 0,
    coverageState: row.coverageState,
    modelVersion: row.modelVersion,
    standardizedValue: row.standardizedValue,
    learnedCoefficient: row.learnedCoefficient,
    scoreContribution: row.scoreContribution,
    missingIndicatorCoefficient: row.missingIndicatorCoefficient,
    missingIndicatorContribution: row.missingIndicatorContribution,
  };
}

/** Bütünlük testi (teslim raporu madde 4, Σkatkı=totalScore): snapshot'a YAZILMIŞ
 *  değerlerden (explainRunner'ı TEKRAR ÇAĞIRMADAN, salt kayıtlı veriden) toplam skoru
 *  yeniden kurar. explainRunner'ın KENDİ totalScore hesabıyla (training.ts satır ~245)
 *  AYNI formül — kasıtlı olarak kopyalanmış TEK yer, iki formülün SESSİZCE AYRIŞMASI riski
 *  yapısal olarak ortadan kalkar. */
export function sumSnapshotSignalContributions(signals: readonly RanSignalSnapshotEntry[]): number {
  return signals.reduce((acc, s) => acc + s.scoreContribution + s.missingIndicatorContribution, 0);
}

/** Yarış-öncesi-veri snapshot kimliği: HANGİ ham sinyal DEĞERLERİNİN (raw) bu tahmine girdiğinin
 *  deterministik parmak izi — weightsFingerprint'ten BAĞIMSIZ bir kavram (o modelin/ağırlıkların
 *  kimliği, bu VERİNİN kimliği). Aynı yarış için aynı ham veri → aynı id; Accurace/galop/jokey-trend
 *  gibi ZAMANLA DEĞİŞEN kaynaklardan biri snapshot alındıktan SONRA güncellenirse (ör. backfill),
 *  bu id farklı çıkar — "bu snapshot HALA o anki veriyi mi yansıtıyor" sorusuna snapshot'ın
 *  KENDİSİNDEN (DB'ye geri gitmeden) kısmi bir cevap verir. code sırası da DAHİL edilir (kullanılan
 *  özellik sırası değişirse id de değişir — "Kullanılan özellik sırası" teslim maddesiyle tutarlı). */
export function computePreRaceDataSnapshotId(raceId: string, signals: readonly RanSignalSnapshotEntry[]): string {
  const payload = JSON.stringify({
    raceId,
    signals: signals.map((s) => ({ code: s.code, raw: s.raw == null ? null : Number(s.raw.toFixed(10)), observed: s.observed })),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export type RanPredictionSnapshot = {
  raceId: string;
  no: number;
  /** Runner.id (Prisma cuid) — Pick.runnerId ile AYNI alan/tip, DB'ye yazılacağında doğrudan
   *  eşlenir. tjkAtId'den FARKLI (TJK'nın dış kimliği, bu alan DEĞİL). Bazı runner'larda eşleşen
   *  Runner satırı/tjkAtId olmayabilir — null, UYDURULMAZ. */
  runnerId: string | null;
  engineVersion: string;
  weightsFingerprint: string;
  generatedAt: string; // ISO zaman damgası — üretim anı
  /** Motorun KENDİ ürettiği sıra — bir kez yazılır, applyManualOverride dahil HİÇBİR
   *  fonksiyon bunu değiştirmez. "Analiz ne dedi?" sorusunun KALICI cevabı. */
  originalRank: number;
  /** Yayınlanan/elle değiştirilmiş sıra — başlangıçta originalRank'e eşit, elle müdahale
   *  SADECE bunu değiştirir. "Kullanıcı ne gösterdi?" sorusunun cevabı. */
  publishedRank: number;
  /** softmax'tan gelen kazanma olasılığı (training.ts::scoreRace) — saha İÇİNDE toplamı
   *  matematiksel garantiyle 1.0. */
  winProbability: number;
  /** explainRunner'ın totalScore'u (= bu snapshot'taki signals'ın scoreContribution+
   *  missingIndicatorContribution toplamı, bkz. sumSnapshotSignalContributions) — scoreRace'in
   *  KENDİ score'uyla (dot(vector,beta), etkileşim terimi YOK, bkz. training.ts) BİREBİR aynı
   *  değer, İKİ BAĞIMSIZ hesap yolundan (madde 3 testinin konusu). */
  finalScore: number;
  /** Bu snapshot'ın üretildiği anda kullanılan kanonik kod sırası (UNIFIED_MODEL_CODES) —
   *  signals dizisinin SIRASI/kapsamı buna göre doğrulanabilir (validateSnapshot zaten bunu
   *  yapıyor, bu alan o karşılaştırmanın GİRDİSİNİ snapshot'ın kendisine taşır). */
  featureCodeOrder: readonly string[];
  /** bkz. computePreRaceDataSnapshotId — null İSE henüz hesaplanmamış/taşınmamış (eski
   *  snapshot'lardan geriye dönük uyumluluk, UYDURULMAZ). */
  preRaceDataSnapshotId: string | null;
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
  snapshot: Pick<RanPredictionSnapshot, "engineVersion" | "weightsFingerprint"> & {
    // SADECE `code` okunur (aşağıya bakınız) — tam RanSignalSnapshotEntry[] İSTEMEK
    // çağıranları (ör. analyze-race.ts'in STALE kapısı) ihtiyaç DUYMADIĞI standardizedValue/
    // learnedCoefficient/... gibi alanları UYDURMAYA zorlardı. Bu daralmış tip, gerçek
    // kullanımla (yalnız kod kümesi karşılaştırması) BİREBİR örtüşüyor.
    signals: readonly Pick<RanSignalSnapshotEntry, "code">[];
  },
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
