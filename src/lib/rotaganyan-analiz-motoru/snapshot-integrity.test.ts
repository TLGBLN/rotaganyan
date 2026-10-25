import { describe, it, expect } from "vitest";
import {
  computeWeightsFingerprint,
  computePreRaceDataSnapshotId,
  sumSnapshotSignalContributions,
  toRanSignalSnapshotEntry,
  validateSnapshot,
  applyManualOverride,
  applyManualOverrideBatch,
  type RanPredictionSnapshot,
  type RanSignalSnapshotEntry,
} from "./snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./feature-calculators/unified-feature-vector";
import type { SignalEffectRow } from "../motor-v1/engine/training";

const FAKE_MODEL = { beta: [0.1, -0.2, 0.3], names: ["A_z", "A_missing", "B_z"] };

function makeSignal(code: string, overrides: Partial<RanSignalSnapshotEntry> = {}): RanSignalSnapshotEntry {
  return {
    code,
    family: "TEST",
    raw: 1,
    observed: true,
    reliability: 1,
    coverageState: null,
    modelVersion: "ran-v1",
    standardizedValue: 0.5,
    learnedCoefficient: 0.2,
    scoreContribution: 0.1,
    missingIndicatorCoefficient: 0,
    missingIndicatorContribution: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<RanPredictionSnapshot> = {}): RanPredictionSnapshot {
  return {
    raceId: "race-1",
    no: 1,
    runnerId: "runner-cuid-1",
    engineVersion: "1.0",
    weightsFingerprint: computeWeightsFingerprint(FAKE_MODEL),
    generatedAt: "2026-10-24T20:00:00.000Z",
    originalRank: 1,
    publishedRank: 1,
    winProbability: 0.25,
    finalScore: 1.23,
    featureCodeOrder: UNIFIED_MODEL_CODES,
    preRaceDataSnapshotId: "fake-pre-race-id",
    signals: UNIFIED_MODEL_CODES.map((code) => makeSignal(code)),
    ...overrides,
  };
}

describe("computeWeightsFingerprint", () => {
  it("aynı model için deterministiktir (iki ayrı çağrı aynı hash'i üretir)", () => {
    expect(computeWeightsFingerprint(FAKE_MODEL)).toBe(computeWeightsFingerprint({ ...FAKE_MODEL }));
  });

  it("tek bir katsayı değişirse farklı hash üretir (yeniden eğitim algılanabilir)", () => {
    const degisik = { ...FAKE_MODEL, beta: [0.1, -0.2, 0.30001] };
    expect(computeWeightsFingerprint(degisik)).not.toBe(computeWeightsFingerprint(FAKE_MODEL));
  });

  it("float serileştirme gürültüsünü (1e-11 altı) görmezden gelir ama gerçek farkı korur", () => {
    const neredeyseAyni = { ...FAKE_MODEL, beta: [0.1 + 1e-12, -0.2, 0.3] };
    expect(computeWeightsFingerprint(neredeyseAyni)).toBe(computeWeightsFingerprint(FAKE_MODEL));
  });
});

describe("validateSnapshot — STALE denetimi", () => {
  const fp = computeWeightsFingerprint(FAKE_MODEL);

  it("kod kümesi + fingerprint + engineVersion hepsi eşleşirse OK döner", () => {
    const snap = makeSnapshot();
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp, expectedEngineVersion: "1.0" });
    expect(result.status).toBe("OK");
    expect(result.reasons).toHaveLength(0);
  });

  it("sinyal kod kümesi UNIFIED_MODEL_CODES ile TAM eşleşmiyorsa (bir kod eksik) STALE döner", () => {
    const snap = makeSnapshot({ signals: makeSnapshot().signals.slice(1) }); // bir kod eksik
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp });
    expect(result.status).toBe("STALE");
    expect(result.reasons.some((r) => r.includes("kod kümesi"))).toBe(true);
  });

  it("snapshot'ta FAZLA bir kod varsa (eski bir motor sürümünden kalma ek sinyal) STALE döner", () => {
    const snap = makeSnapshot({ signals: [...makeSnapshot().signals, makeSignal("ARTIK_SILINMIS_KOD")] });
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp });
    expect(result.status).toBe("STALE");
    expect(result.reasons.some((r) => r.includes("fazla=[ARTIK_SILINMIS_KOD]"))).toBe(true);
  });

  it("weightsFingerprint güncel modelle UYUŞMUYORSA (model yeniden eğitilmiş) STALE döner", () => {
    const snap = makeSnapshot({ weightsFingerprint: "eski-bir-fingerprint-degeri" });
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp });
    expect(result.status).toBe("STALE");
    expect(result.reasons.some((r) => r.includes("weightsFingerprint"))).toBe(true);
  });

  it("engineVersion verilip uyuşmuyorsa (eski motor sürümü) STALE döner", () => {
    const snap = makeSnapshot({ engineVersion: "0.9-eski" });
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp, expectedEngineVersion: "1.0" });
    expect(result.status).toBe("STALE");
    expect(result.reasons.some((r) => r.includes("engineVersion"))).toBe(true);
  });

  it("BİRDEN FAZLA ihlal varsa hepsini reasons'da listeler (ilk hatada durmaz)", () => {
    const snap = makeSnapshot({ weightsFingerprint: "bozuk", signals: makeSnapshot().signals.slice(1) });
    const result = validateSnapshot(snap, { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fp });
    expect(result.status).toBe("STALE");
    expect(result.reasons.length).toBe(2);
  });
});

describe("applyManualOverride / originalRank-publishedRank ayrımı (P0 bug TEKRARLANMIYOR)", () => {
  it("publishedRank'i değiştirir ama originalRank'e HİÇ dokunmaz", () => {
    const snap = makeSnapshot({ originalRank: 4, publishedRank: 4 });
    const guncellenmis = applyManualOverride(snap, 1);
    expect(guncellenmis.publishedRank).toBe(1);
    expect(guncellenmis.originalRank).toBe(4); // motorun kendi sırası KORUNDU
  });

  it("girdi snapshot'ı MUTATE ETMEZ (yeni obje döner, orijinal değişmeden kalır)", () => {
    const snap = makeSnapshot({ originalRank: 2, publishedRank: 2 });
    const guncellenmis = applyManualOverride(snap, 7);
    expect(snap.publishedRank).toBe(2); // orijinal obje dokunulmamış
    expect(guncellenmis).not.toBe(snap);
  });

  it("geçersiz (0, negatif, ondalık) sıra verilirse fırlatır", () => {
    const snap = makeSnapshot();
    expect(() => applyManualOverride(snap, 0)).toThrow();
    expect(() => applyManualOverride(snap, -1)).toThrow();
    expect(() => applyManualOverride(snap, 1.5)).toThrow();
  });

  it("applyManualOverrideBatch: bir yarışın N atından yalnız rankMap'te olanların publishedRank'i değişir, HİÇBİRİNİN originalRank'i değişmez", () => {
    // Motor kendi sırasını üretti: 1,2,3 (no=1,2,3 sırasıyla). Kullanıcı 1. ile 3.'yü
    // yayında yer değiştiriyor (ör. veteriner raporu / manuel bilgi) — ama "motor ne dedi"
    // sorusu HER ZAMAN cevaplanabilir kalmalı.
    const snapshots: RanPredictionSnapshot[] = [1, 2, 3].map((no) => makeSnapshot({ no, originalRank: no, publishedRank: no }));
    const rankMap = new Map([[1, 3], [3, 1]]);
    const sonuc = applyManualOverrideBatch(snapshots, rankMap);

    const byNo = new Map(sonuc.map((s) => [s.no, s]));
    expect(byNo.get(1)!.publishedRank).toBe(3);
    expect(byNo.get(3)!.publishedRank).toBe(1);
    expect(byNo.get(2)!.publishedRank).toBe(2); // rankMap'te yok, dokunulmadı

    // KRİTİK ASSERTION: originalRank'lar override'dan TAMAMEN bağımsız, motorun kendi
    // ürettiği sıra her zaman geri okunabilir.
    expect(byNo.get(1)!.originalRank).toBe(1);
    expect(byNo.get(2)!.originalRank).toBe(2);
    expect(byNo.get(3)!.originalRank).toBe(3);
  });

  it("applyManualOverride GENİŞLETİLMİŞ snapshot'ın TÜM alanlarını (sinyal katkıları DAHİL) korur — publishedRank DIŞINDA HİÇBİR ŞEY değişmez", () => {
    // Teslim raporu Faz 1 madde 4: override sırasında yalnız publishedRank'in değiştiğini,
    // explainRunner'ın ürettiği HER sinyal satırının (standardizedValue/learnedCoefficient/
    // scoreContribution/missingIndicator*) ve diğer tüm kimlik alanlarının (winProbability,
    // finalScore, featureCodeOrder, preRaceDataSnapshotId, runnerId) BİREBİR aynı kaldığını
    // kanıtlar — "sinyal katkıları" yalnız originalRank gibi AYRI bir alan değil, override
    // AYNI zamanda bu alanları SESSİZCE bozmuyor/sıfırlamıyor.
    const snap = makeSnapshot({
      originalRank: 5,
      publishedRank: 5,
      winProbability: 0.137,
      finalScore: -0.482,
      runnerId: "runner-cuid-XYZ",
      preRaceDataSnapshotId: "abc123",
      signals: [makeSignal("idmJokey", { raw: 3.3, standardizedValue: 1.1, learnedCoefficient: 0.44, scoreContribution: 0.484 })],
    });
    const guncellenmis = applyManualOverride(snap, 1);

    expect(guncellenmis.publishedRank).toBe(1); // TEK değişen alan
    expect(guncellenmis.originalRank).toBe(5);
    expect(guncellenmis.winProbability).toBe(0.137);
    expect(guncellenmis.finalScore).toBe(-0.482);
    expect(guncellenmis.runnerId).toBe("runner-cuid-XYZ");
    expect(guncellenmis.preRaceDataSnapshotId).toBe("abc123");
    // Sinyal katkıları — kayıpsız korunum:
    expect(guncellenmis.signals).toEqual(snap.signals);
    expect(guncellenmis.signals[0].scoreContribution).toBe(0.484);
    expect(guncellenmis.signals[0].standardizedValue).toBe(1.1);
    expect(guncellenmis.signals[0].learnedCoefficient).toBe(0.44);
  });
});

describe("toRanSignalSnapshotEntry — explainRunner'ın SignalEffectRow'undan KAYIPSIZ dönüşüm", () => {
  it("SignalEffectRow'un HER alanını (standardizedValue/learnedCoefficient/scoreContribution/missingIndicator*/coverageState/modelVersion/family) birebir taşır", () => {
    const row: SignalEffectRow<string> = {
      code: "idmJokey",
      family: "YET",
      rawValue: 7.5,
      standardizedValue: 1.234,
      learnedCoefficient: 0.567,
      scoreContribution: 0.6998,
      missingIndicatorCoefficient: -0.1,
      missingIndicatorContribution: 0,
      observed: true,
      coverageState: "FULL",
      modelVersion: "ran-engine-v1",
    };
    const entry = toRanSignalSnapshotEntry(row);
    expect(entry).toEqual({
      code: "idmJokey",
      family: "YET",
      raw: 7.5,
      observed: true,
      reliability: 1,
      coverageState: "FULL",
      modelVersion: "ran-engine-v1",
      standardizedValue: 1.234,
      learnedCoefficient: 0.567,
      scoreContribution: 0.6998,
      missingIndicatorCoefficient: -0.1,
      missingIndicatorContribution: 0,
    });
  });

  it("observed=false satır için reliability=0 (UYDURULMUŞ bir ara değer DEĞİL, eldeki TEK gerçek veri)", () => {
    const row: SignalEffectRow<string> = {
      code: "X", family: null, rawValue: null, standardizedValue: 0, learnedCoefficient: 0.3,
      scoreContribution: 0, missingIndicatorCoefficient: 0.2, missingIndicatorContribution: 0.2,
      observed: false, coverageState: null, modelVersion: "v1",
    };
    expect(toRanSignalSnapshotEntry(row).reliability).toBe(0);
  });
});

describe("sumSnapshotSignalContributions — Σ(scoreContribution+missingIndicatorContribution) ≈ totalScore", () => {
  it("snapshot'a YAZILMIŞ değerlerden (explainRunner'ı TEKRAR ÇAĞIRMADAN) toplam skor birebir yeniden kurulur", () => {
    // explainRunner'ın GERÇEK formülüyle (training.ts) AYNI örnek: 3 sinyal, bazı
    // missingIndicator katkıları sıfırdan farklı.
    const rows: SignalEffectRow<string>[] = [
      { code: "A", family: "F", rawValue: 1, standardizedValue: 0.5, learnedCoefficient: 0.2, scoreContribution: 0.1, missingIndicatorCoefficient: 0.05, missingIndicatorContribution: 0, observed: true, coverageState: null, modelVersion: "v1" },
      { code: "B", family: "F", rawValue: null, standardizedValue: 0, learnedCoefficient: 0.4, scoreContribution: 0, missingIndicatorCoefficient: -0.3, missingIndicatorContribution: -0.3, observed: false, coverageState: null, modelVersion: "v1" },
      { code: "C", family: "F", rawValue: 2, standardizedValue: -1.2, learnedCoefficient: 0.1, scoreContribution: -0.12, missingIndicatorCoefficient: 0.05, missingIndicatorContribution: 0, observed: true, coverageState: null, modelVersion: "v1" },
    ];
    const expectedTotalScore = rows.reduce((acc, r) => acc + r.scoreContribution + r.missingIndicatorContribution, 0); // explainRunner'ın KENDİ formülü (training.ts satır ~245)
    const signals = rows.map(toRanSignalSnapshotEntry);
    const reconstructed = sumSnapshotSignalContributions(signals);
    expect(reconstructed).toBeCloseTo(expectedTotalScore, 10);
    expect(reconstructed).toBeCloseTo(0.1 + 0 + -0.3 + -0.12 + 0, 10); // elle hesap: -0.32
  });

  it("boş sinyal listesi için 0 döner (uydurma yok)", () => {
    expect(sumSnapshotSignalContributions([])).toBe(0);
  });
});

describe("computePreRaceDataSnapshotId — yarış-öncesi-veri kimliği", () => {
  it("aynı raceId + aynı ham sinyal değerleri için deterministiktir", () => {
    const signals = [makeSignal("A", { raw: 1 }), makeSignal("B", { raw: 2 })];
    const id1 = computePreRaceDataSnapshotId("race-X", signals);
    const id2 = computePreRaceDataSnapshotId("race-X", [...signals]);
    expect(id1).toBe(id2);
  });

  it("ham değerlerden biri değişirse (ör. backfill/sonradan güncellenen tarihsel veri) id DEĞİŞİR", () => {
    const before = [makeSignal("A", { raw: 1 })];
    const after = [makeSignal("A", { raw: 1.0001 })];
    expect(computePreRaceDataSnapshotId("race-X", before)).not.toBe(computePreRaceDataSnapshotId("race-X", after));
  });

  it("aynı veri ama FARKLI raceId için id FARKLIDIR", () => {
    const signals = [makeSignal("A", { raw: 1 })];
    expect(computePreRaceDataSnapshotId("race-X", signals)).not.toBe(computePreRaceDataSnapshotId("race-Y", signals));
  });
});
