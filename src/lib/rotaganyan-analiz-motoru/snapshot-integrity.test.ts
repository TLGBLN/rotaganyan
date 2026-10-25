import { describe, it, expect } from "vitest";
import {
  computeWeightsFingerprint,
  validateSnapshot,
  applyManualOverride,
  applyManualOverrideBatch,
  type RanPredictionSnapshot,
} from "./snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./feature-calculators/unified-feature-vector";

const FAKE_MODEL = { beta: [0.1, -0.2, 0.3], names: ["A_z", "A_missing", "B_z"] };

function makeSnapshot(overrides: Partial<RanPredictionSnapshot> = {}): RanPredictionSnapshot {
  return {
    raceId: "race-1",
    no: 1,
    engineVersion: "1.0",
    weightsFingerprint: computeWeightsFingerprint(FAKE_MODEL),
    generatedAt: "2026-10-24T20:00:00.000Z",
    originalRank: 1,
    publishedRank: 1,
    signals: UNIFIED_MODEL_CODES.map((code) => ({ code, raw: 1, observed: true, reliability: 1 })),
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
    const snap = makeSnapshot({ signals: [...makeSnapshot().signals, { code: "ARTIK_SILINMIS_KOD", raw: 1, observed: true, reliability: 1 }] });
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
});
