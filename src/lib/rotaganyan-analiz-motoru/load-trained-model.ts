// ROTAGANYAN ANALİZ MOTORU — eğitilmiş modeli (238 yarış, λ=90; bağımsız kabul testinde
// n=60, 2026-10-22/24 — eğitimde/λ-seçiminde HİÇ kullanılmamış — Top-1=%35.0, Top-3=%66.7,
// Top-6=%90.0, LogLoss=1.879) git-tracked artifact'tan (artifacts/ran-trained-model.json)
// yükler.
//
// DİSİPLİN (motor-v1/engine/load-trained-model.ts'teki desenle TUTARLI — git-tracked JSON
// import'u, Vercel'in çalışma anında erişebileceği TEK yer, ayrı bir C:/tmp yolu DEĞİL —
// ama kullanıcı talimatı madde 4 gereği DAHA SIKI): dosya eksik/bozuk/yanlış sürümse SESSİZCE
// eski/varsayılan bir modele DÜŞMEZ, THROW eder. Kontrol edilenler:
//   1) artifact.engineVersion, engine-versions.ts::getCurrentRanEngineVersion().surum ile
//      BİREBİR eşleşmeli.
//   2) artifact.codes, UNIFIED_MODEL_CODES ile AYNI UZUNLUK + AYNI SIRADA olmalı.
//   3) artifact.codes'taki HER kod için muSigma girdisi bulunmalı.
//   4) beta/names dizileri aynı uzunlukta ve codes.length*2 (her kod için z+missing) olmalı.
//   5) weightsFingerprint, dosyadaki codes/names/beta/muSigma'dan YENİDEN hesaplandığında
//      BİREBİR aynı çıkmalı (dosya elle değiştirilmemiş/bozulmamış kanıtı).
//
// `validateAndBuildModel` kasıtlı olarak `loadTrainedModel()`'den AYRI export edilir — test
// dosyası (load-trained-model.test.ts) GERÇEK artifact'ı VE kasıtlı bozulmuş kopyalarını bu
// fonksiyona verip THROW davranışını doğrudan sınar.
import { createHash } from "node:crypto";
import type { FittedModel, FeatureStats } from "../motor-v1/engine/training";
import { UNIFIED_MODEL_CODES } from "./feature-calculators/unified-feature-vector";
import { getCurrentRanEngineVersion } from "./engine-versions";
import rawArtifact from "./artifacts/ran-trained-model.json";

export type RanTrainedModelArtifact = {
  engineVersion: string;
  trainedAt: string;
  lambda: number;
  learningRate: number;
  iterations: number;
  nRacesTrain: number;
  nRacesHoldout: number;
  trainDateRange: [string, string];
  holdoutDateRange: [string, string];
  devHoldoutMetrics: { top1: number; top3: number; top6: number; logLoss: number; avgFieldSize: number };
  codes: string[];
  names: string[];
  beta: number[];
  muSigma: Record<string, { mu: number; sigma: number; nObserved: number }>;
  weightsFingerprint: string;
};

/** Artifact'ın İÇERİĞİNDEN (codes+names+beta+muSigma) deterministik sha256 — dosya elle
 *  değiştirilirse (tek bir beta/mu/sigma değeri dahi) hash DEĞİŞİR. toFixed(10) ile float
 *  serileştirme gürültüsü elenir, gerçek bir değer değişikliğini GİZLEMEZ (10 ondalık,
 *  modelin anlamlı hassasiyetinin çok üstünde — snapshot-integrity.ts::computeWeightsFingerprint
 *  ile AYNI teknik, burada ayrıca muSigma'yı da kapsar çünkü bu fonksiyonun amacı FARKLI:
 *  "dosya bozulmadı mı" — o fonksiyonun amacı "canlıdaki model snapshot alındığından beri
 *  değişti mi", ikisi KARIŞTIRILMAMALI). */
export function computeArtifactFingerprint(
  a: Pick<RanTrainedModelArtifact, "codes" | "names" | "beta" | "muSigma">
): string {
  const payload = JSON.stringify({
    codes: a.codes,
    names: a.names,
    beta: a.beta.map((b) => Number(b.toFixed(10))),
    muSigma: Object.fromEntries(
      Object.entries(a.muSigma)
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([k, v]) => [k, { mu: Number(v.mu.toFixed(10)), sigma: Number(v.sigma.toFixed(10)), nObserved: v.nObserved }])
    ),
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** Ham artifact objesini doğrular ve training.ts'in beklediği FittedModel<string> şekline
 *  çevirir. Herhangi bir doğrulama BAŞARISIZ olursa THROW eder — sessiz fallback YOK. */
export function validateAndBuildModel(a: unknown): FittedModel<string> {
  if (a == null || typeof a !== "object") {
    throw new Error("loadTrainedModel: artifact dosyası okunamadı/boş değer döndü — sessiz fallback YOK.");
  }
  const artifact = a as RanTrainedModelArtifact;

  const expectedVersion = getCurrentRanEngineVersion().surum;
  if (artifact.engineVersion !== expectedVersion) {
    throw new Error(
      `loadTrainedModel: artifact.engineVersion="${artifact.engineVersion}" beklenen="${expectedVersion}" ile UYUŞMUYOR — eski/yanlış ağırlık dosyası olabilir, sessiz fallback YOK.`
    );
  }

  if (!Array.isArray(artifact.codes) || artifact.codes.length !== UNIFIED_MODEL_CODES.length) {
    throw new Error(
      `loadTrainedModel: artifact.codes uzunluğu (${artifact.codes?.length}) UNIFIED_MODEL_CODES.length (${UNIFIED_MODEL_CODES.length}) ile uyuşmuyor.`
    );
  }
  for (let i = 0; i < UNIFIED_MODEL_CODES.length; i++) {
    if (artifact.codes[i] !== UNIFIED_MODEL_CODES[i]) {
      throw new Error(
        `loadTrainedModel: artifact.codes[${i}]="${artifact.codes[i]}" UNIFIED_MODEL_CODES[${i}]="${UNIFIED_MODEL_CODES[i]}" ile AYNI SIRADA değil.`
      );
    }
  }

  for (const code of artifact.codes) {
    if (!artifact.muSigma || !artifact.muSigma[code]) {
      throw new Error(`loadTrainedModel: muSigma["${code}"] eksik.`);
    }
  }

  if (!Array.isArray(artifact.beta) || !Array.isArray(artifact.names) || artifact.beta.length !== artifact.names.length) {
    throw new Error("loadTrainedModel: beta/names dizileri eksik veya uzunlukları uyuşmuyor.");
  }
  if (artifact.beta.length !== artifact.codes.length * 2) {
    throw new Error(
      `loadTrainedModel: beta.length=${artifact.beta.length} beklenen=${artifact.codes.length * 2} (codes.length*2, her kod için z+missing sütunu) ile uyuşmuyor.`
    );
  }

  const recomputed = computeArtifactFingerprint(artifact);
  if (recomputed !== artifact.weightsFingerprint) {
    throw new Error(
      `loadTrainedModel: weightsFingerprint uyuşmuyor (dosya=${artifact.weightsFingerprint?.slice(0, 12)}…, yeniden-hesaplanan=${recomputed.slice(0, 12)}…) — dosya bozulmuş veya elle değiştirilmiş olabilir, sessiz fallback YOK.`
    );
  }

  const stats: FeatureStats<string> = new Map(artifact.codes.map((code) => [code, artifact.muSigma[code]]));
  return {
    beta: artifact.beta,
    names: artifact.names as FittedModel<string>["names"],
    stats,
    nRacesUsed: artifact.nRacesTrain,
    nRacesSkipped: 0,
    opts: { lambda: artifact.lambda, learningRate: artifact.learningRate, iterations: artifact.iterations },
  };
}

let cached: FittedModel<string> | null = null;

/** Her çağrıda AYNI nesneyi döner (idempotent, motor-v1/engine/load-trained-model.ts'teki
 *  loadTrainedV1Model ile AYNI desen) — artifact yalnız BUILD zamanında (static import)
 *  okunur. Doğrulama (engineVersion/codes/muSigma/fingerprint) İLK çağrıda GERÇEKTEN çalışır
 *  — dosya bozuksa/yanlış sürümse bu çağrı THROW eder. */
export function loadTrainedModel(): FittedModel<string> {
  if (cached) return cached;
  cached = validateAndBuildModel(rawArtifact as unknown as RanTrainedModelArtifact);
  return cached;
}

/** Eğitim/kabul-testi meta bilgisi (ağırlıkların KENDİSİ hariç) — ileride tahmin
 *  route'unda/admin panelinde "bu motor hangi veriyle eğitildi" gösterimi için. */
export function trainedModelMeta(): Omit<RanTrainedModelArtifact, "beta" | "names" | "muSigma"> {
  const a = rawArtifact as unknown as RanTrainedModelArtifact;
  const { beta, names, muSigma, ...meta } = a;
  return meta;
}
