// ROTAGANYAN ANALİZ MOTORU — /api/admin/test-ran-engine route testleri.
//
// NE KANITLIYOR (kullanıcı talimatı madde 8 + ek kurallar):
//  1) PARİTE: route'un ürettiği score/probability/rank, `scoreRace(vectors, loadTrainedModel())`
//     DOĞRUDAN çağrıldığında üretilenle BİREBİR aynı — route HİÇBİR ek dönüşüm/yuvarlama
//     yapmıyor (aynı GERÇEK loadTrainedModel()/scoreRace/explainRunner, sahte bir kopya DEĞİL).
//  2) explainRunner İZLENEBİLİRLİĞİ route yanıtına BİREBİR taşınıyor.
//  3) İDEMPOTENT: aynı raceId iki kez çağrılır → generatedAt dışında TÜM alanlar aynı (DB'ye
//     yazma olmadığı için yan etki YOK).
//  4) YETKİLENDİRME: oturumsuz/EDITOR-altı rol → 401, skor HİÇ hesaplanmaz (feature-build
//     fonksiyonu çağrılmaz).
//  5) MODEL YÜKLEME HATASI: loadTrainedModel() throw ederse route 500 + açık Türkçe mesajla
//     döner — yutulmaz/200'e düşmez (madde 4).
//  6) RACE NOT FOUND: feature-build boş vektör dönerse 404.
//
// buildUnifiedFeatureVectorsForRace (DB'ye bağlı) burada MOCK'lanır — gerçek DB'ye bağlı
// uçtan-uca parite kanıtı (gerçek bir yarışla) AYRI bir script'te:
// arac-ran-route-parite-testi.mts (bkz. teslim raporu).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  // Basitleştirilmiş mock — gerçek hasRole/ROLE_ORDER'ın kendi mantığı değil, bu izole
  // route'un "EDITOR eşiği" dalını test etmek için yeterli (next-auth config'ini gerçekten
  // import etmek test ortamında gereksiz env bağımlılığı yaratır).
  hasRole: (userRole: string, minRole: string) => {
    const order: Record<string, number> = { USER: 0, EDITOR: 1, ADMIN: 2 };
    return (order[userRole] ?? -1) >= (order[minRole] ?? 99);
  },
}));

vi.mock("@/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector")
  >("@/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector");
  return { ...actual, buildUnifiedFeatureVectorsForRace: vi.fn() };
});

vi.mock("@/lib/rotaganyan-analiz-motoru/load-trained-model", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/rotaganyan-analiz-motoru/load-trained-model")
  >("@/lib/rotaganyan-analiz-motoru/load-trained-model");
  return { ...actual, loadTrainedModel: vi.fn(actual.loadTrainedModel) };
});

import { auth } from "@/lib/auth";
import { buildUnifiedFeatureVectorsForRace, UNIFIED_MODEL_CODES } from "@/lib/rotaganyan-analiz-motoru/feature-calculators/unified-feature-vector";
import { loadTrainedModel } from "@/lib/rotaganyan-analiz-motoru/load-trained-model";
import { scoreRace, explainRunner } from "@/lib/motor-v1/engine/training";
import { computeWeightsFingerprint, sumSnapshotSignalContributions } from "@/lib/rotaganyan-analiz-motoru/snapshot-integrity";
import { getCurrentRanEngineVersion } from "@/lib/rotaganyan-analiz-motoru/engine-versions";
import type { RunnerFeatureVector, SignalEntry } from "@/lib/motor-v1/engine/feature-vector";

const RACE_ID = "race-parity-test";

function buildVector(no: number): RunnerFeatureVector {
  const signals: SignalEntry[] = UNIFIED_MODEL_CODES.map((code, i) => {
    const observed = (i + no) % 5 !== 0;
    const raw = observed ? Math.sin(no * 13 + i) * 10 : null;
    return {
      code,
      family: "TEST",
      rawValue: raw,
      observed,
      coverageState: null,
      asOfSafe: true,
      missingReason: observed ? null : "test-missing",
    };
  });
  return { raceId: RACE_ID, no, name: `At ${no}`, tjkAtId: null, jockey: null, signals };
}

const FIXED_VECTORS: RunnerFeatureVector[] = [1, 2, 3, 4, 5, 6].map(buildVector);
const FIXED_RUNNER_ID_BY_NO = new Map(FIXED_VECTORS.map((v) => [v.no, `runner-cuid-${v.no}`]));
const FIXED_RESULT = { vectors: FIXED_VECTORS, diagnostics: [], runnerIdByNo: FIXED_RUNNER_ID_BY_NO };

function makeRequest(raceId: string | undefined = RACE_ID) {
  return new NextRequest("http://localhost/api/admin/test-ran-engine", {
    method: "POST",
    body: JSON.stringify({ raceId }),
  });
}

describe("POST /api/admin/test-ran-engine", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(auth).mockResolvedValue({ user: { role: "EDITOR" } } as never);
    vi.mocked(buildUnifiedFeatureVectorsForRace).mockReset();
    vi.mocked(buildUnifiedFeatureVectorsForRace).mockResolvedValue(FIXED_RESULT);
    vi.mocked(loadTrainedModel).mockClear();
  });

  it("score/probability/rank, scoreRace+loadTrainedModel'in DOĞRUDAN hesapladığıyla BİREBİR aynıdır (parite)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    const model = loadTrainedModel();
    const direct = scoreRace(FIXED_VECTORS, model);
    const directRanked = [...direct].sort((a, b) => b.probability - a.probability);

    expect(body.atlar).toHaveLength(directRanked.length);
    directRanked.forEach((d, idx) => {
      const pick = body.atlar[idx];
      expect(pick.no).toBe(d.no);
      expect(pick.score).toBe(d.score);
      expect(pick.probability).toBe(d.probability);
      expect(pick.originalRank).toBe(idx + 1);
      expect(pick.publishedRank).toBe(idx + 1); // madde 7: henüz override yok
      expect(pick.runnerId).toBe(FIXED_RUNNER_ID_BY_NO.get(d.no)); // Faz 1 genişletmesi: AYRI DB sorgusu olmadan taşınır
      expect(pick.winProbability).toBe(d.probability);
      expect(pick.featureCodeOrder).toEqual(UNIFIED_MODEL_CODES);
      expect(typeof pick.preRaceDataSnapshotId).toBe("string");
      expect(pick.preRaceDataSnapshotId.length).toBeGreaterThan(0);
    });

    expect(body.engineVersion).toBe(getCurrentRanEngineVersion().surum);
    expect(body.weightsFingerprint).toBe(computeWeightsFingerprint(model));
  });

  it("Faz 4 madde 3 — TEK yarış için TÜM atlar AYNI weightsFingerprint+generatedAt+engineVersion+featureCodeOrder'ı taşır (tek kaynak-of-truth, analiz/sıralama/kupon AYNI snapshot'tan beslenir)", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    const body = await res.json();

    const fingerprints = new Set(body.atlar.map((a: { weightsFingerprint: string }) => a.weightsFingerprint));
    const generatedAts = new Set(body.atlar.map((a: { generatedAt: string }) => a.generatedAt));
    const engineVersions = new Set(body.atlar.map((a: { engineVersion: string }) => a.engineVersion));
    const featureCodeOrders = new Set(body.atlar.map((a: { featureCodeOrder: string[] }) => JSON.stringify(a.featureCodeOrder)));

    expect(fingerprints.size).toBe(1); // TEK değer — çakışma/sapma YOK
    expect(generatedAts.size).toBe(1);
    expect(engineVersions.size).toBe(1);
    expect(featureCodeOrders.size).toBe(1);
    // Üst-seviye body alanlarıyla da BİREBİR aynı (race-level ile pick-level AYRIŞMADI):
    expect([...fingerprints][0]).toBe(body.weightsFingerprint);
    expect([...generatedAts][0]).toBe(body.generatedAt);
    expect([...engineVersions][0]).toBe(body.engineVersion);
  });

  it("explainRunner izlenebilirliği (signals[].raw/observed) route yanıtına BİREBİR taşınır", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    const body = await res.json();

    const model = loadTrainedModel();
    for (const vec of FIXED_VECTORS) {
      const pick = body.atlar.find((a: { no: number }) => a.no === vec.no);
      const explained = explainRunner(vec, model);
      expect(pick.signals).toHaveLength(explained.rows.length);
      explained.rows.forEach((row, i) => {
        expect(pick.signals[i].code).toBe(row.code);
        expect(pick.signals[i].raw).toBe(row.rawValue);
        expect(pick.signals[i].observed).toBe(row.observed);
        // Faz 1 Aşama 1 genişletmesi — KAYIPSIZ taşınan alanlar (önceden route yanıtında YOKTU).
        // toBeCloseTo kullanılıyor (toBe DEĞİL): JSON round-trip (res.json()) -0'ı 0'a
        // normalize edebiliyor — bu float serileştirmenin BİLİNEN bir özelliği, KAYIP DEĞİL
        // (sayısal değer aynı, Object.is ayrımı gerçek bir veri kaybı GÖSTERMİYOR).
        expect(pick.signals[i].standardizedValue).toBeCloseTo(row.standardizedValue, 12);
        expect(pick.signals[i].learnedCoefficient).toBeCloseTo(row.learnedCoefficient, 12);
        expect(pick.signals[i].scoreContribution).toBeCloseTo(row.scoreContribution, 12);
        expect(pick.signals[i].missingIndicatorCoefficient).toBeCloseTo(row.missingIndicatorCoefficient, 12);
        expect(pick.signals[i].missingIndicatorContribution).toBeCloseTo(row.missingIndicatorContribution, 12);
      });
      expect(pick.explainTotalScore).toBe(explained.totalScore);
    }
  });

  it("Σ(scoreContribution+missingIndicatorContribution) üzerinden snapshot'tan YENİDEN KURULAN toplam, explainTotalScore'a ≈ eşittir (HER at için) — teslim raporu madde 3/4", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    const body = await res.json();
    for (const pick of body.atlar) {
      const reconstructed = sumSnapshotSignalContributions(pick.signals);
      expect(reconstructed).toBeCloseTo(pick.explainTotalScore, 10);
      expect(reconstructed).toBeCloseTo(pick.finalScore, 10);
    }
  });

  it("idempotent: aynı raceId iki kez çağrılır, generatedAt dışında TÜM alanlar AYNI kalır", async () => {
    const { POST } = await import("./route");
    const res1 = await POST(makeRequest());
    const body1 = await res1.json();
    const res2 = await POST(makeRequest());
    const body2 = await res2.json();

    const strip = (b: typeof body1) => ({ ...b, generatedAt: null, atlar: b.atlar.map((a: Record<string, unknown>) => ({ ...a, generatedAt: null })) });
    expect(strip(body1)).toEqual(strip(body2));
    // feature-build fonksiyonu yan etkisiz — iki kez çağrılmış olmalı (her istekte YENİDEN
    // hesaplanıyor, cache'lenmiş eski bir sonuç DÖNDÜRÜLMÜYOR) ama hiçbir DB YAZMA yapılmadı.
    expect(buildUnifiedFeatureVectorsForRace).toHaveBeenCalledTimes(2);
  });

  it("oturum yoksa 401 döner, skor HİÇ hesaplanmaz", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(buildUnifiedFeatureVectorsForRace).not.toHaveBeenCalled();
  });

  it("EDITOR altı rol (USER) için 401 döner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: "USER" } } as never);
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(buildUnifiedFeatureVectorsForRace).not.toHaveBeenCalled();
  });

  it("raceId eksikse 400 döner", async () => {
    const { POST } = await import("./route");
    const reqWithoutRaceId = new NextRequest("http://localhost/api/admin/test-ran-engine", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(reqWithoutRaceId);
    expect(res.status).toBe(400);
  });

  it("feature-build boş vektör dönerse (yarış/koşucu bulunamadı) 404 döner", async () => {
    vi.mocked(buildUnifiedFeatureVectorsForRace).mockResolvedValue({ vectors: [], diagnostics: [], runnerIdByNo: new Map() });
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("loadTrainedModel() throw ederse (yanlış sürüm/hash) route 500 + açık Türkçe mesajla döner — YUTULMAZ/200 dönmez", async () => {
    vi.mocked(loadTrainedModel).mockImplementationOnce(() => {
      throw new Error("weightsFingerprint uyuşmuyor (test)");
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("ROTAGANYAN ANALİZ MOTORU");
    expect(body.error).toContain("weightsFingerprint uyuşmuyor (test)");
  });
});
