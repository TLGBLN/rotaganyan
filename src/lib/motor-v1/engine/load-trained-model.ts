// ROTAGANYAN ANALİZ MOTORU v1.0 — EĞİTİLMİŞ MODELİ UYGULAMAYA BAĞLAMA (kullanıcı talimatı,
// 2026-10-20: "artık çalıştır"). Bu dosya C:/tmp/rotaganyan-v1-full-training-artifact.json
// içindeki ÖĞRENİLMİŞ katsayıları (120 train/30 holdout, λ=1 birincil) DEĞİŞTİRMEDEN,
// git-tracked bir kopyadan (artifacts/v1-trained-model.json — Vercel'in erişebileceği tek
// yer, yerel C:/tmp YOLU DEĞİL) FittedModel<C> şekline dönüştürür. Yeni fitModel() ÇAĞRISI
// YOK — yalnız kayıtlı beta/names/muSigma'yı training.ts'in beklediği Map şekline taşır.

import type { FittedModel, FeatureStats } from "./training";
import trainedArtifact from "../artifacts/v1-trained-model.json";

type ArtifactShape = {
  modelVersion: string;
  beta: number[];
  names: string[];
  muSigma: Record<string, { mu: number; sigma: number; nObserved: number }>;
  nTrainRaces: number;
  nHoldoutRaces: number;
  fitOpts: { lambda: number; learningRate: number; iterations: number };
  candidateCodeCount: number;
  trainedCodeCount: number;
  excludedCodes: { code: string; observedRate: number | undefined }[];
};

let cached: FittedModel<string> | null = null;

/** Her çağrıda AYNI nesneyi döner (idempotent) — eğitim artefaktı yalnız BUILD zamanında
 *  (import) okunur, istek başına dosya okuma/parse YOK. */
export function loadTrainedV1Model(): FittedModel<string> {
  if (cached) return cached;
  const a = trainedArtifact as unknown as ArtifactShape;
  const stats: FeatureStats<string> = new Map(Object.entries(a.muSigma));
  cached = {
    beta: a.beta,
    names: a.names as FittedModel<string>["names"],
    stats,
    nRacesUsed: a.nTrainRaces,
    nRacesSkipped: 0,
    opts: a.fitOpts,
  };
  return cached;
}

export function trainedModelVersion(): string {
  return (trainedArtifact as unknown as ArtifactShape).modelVersion;
}

/** Eğitim artefaktının meta bilgisi (kaç yarışla eğitildi, kaç kod kapsam-yetersizliği
 *  nedeniyle dışarıda kaldı ve hangileri) — AnalysisPanel'in "model bilgilendirmesi"
 *  bölümü için, artefaktın KENDİSİNDEN okunur, uydurulmaz. */
export function trainedModelMeta() {
  const a = trainedArtifact as unknown as ArtifactShape;
  return {
    modelVersion: a.modelVersion,
    nTrainRaces: a.nTrainRaces,
    nHoldoutRaces: a.nHoldoutRaces,
    candidateCodeCount: a.candidateCodeCount,
    trainedCodeCount: a.trainedCodeCount,
    excludedCodes: a.excludedCodes,
  };
}
