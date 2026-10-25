// ROTAGANYAN ANALİZ MOTORU — load-trained-model.ts testleri (kullanıcı talimatı madde 6):
// eğitim/tahmin tarafında feature sırasının, normalizasyonun ve model kimliğinin BİREBİR
// eşleştiğini doğrular — UNIFIED_MODEL_CODES ile kayıtlı artifact'ın `codes` alanı AYNI
// SIRADA mı, `muSigma` her kod için var mı, `weightsFingerprint` dosyadaki
// beta/names/muSigma'dan YENİDEN HESAPLANDIĞINDA aynı çıkıyor mu (dosya bozulmamış/elle
// değiştirilmemiş kanıtı) — ve loadTrainedModel()'in madde 4 disiplinini (eksik/bozuk/yanlış
// sürüm dosyasında SESSİZ FALLBACK YOK, THROW) GERÇEKTEN uyguladığını.
import { describe, it, expect } from "vitest";
import {
  loadTrainedModel,
  validateAndBuildModel,
  computeArtifactFingerprint,
  trainedModelMeta,
  type RanTrainedModelArtifact,
} from "./load-trained-model";
import { UNIFIED_MODEL_CODES } from "./feature-calculators/unified-feature-vector";
import { getCurrentRanEngineVersion } from "./engine-versions";
import rawArtifact from "./artifacts/ran-trained-model.json";

const artifact = rawArtifact as unknown as RanTrainedModelArtifact;

describe("ran-trained-model.json artifact — kimlik/bütünlük", () => {
  it("codes alanı UNIFIED_MODEL_CODES ile AYNI UZUNLUKTA ve AYNI SIRADA", () => {
    expect(artifact.codes.length).toBe(UNIFIED_MODEL_CODES.length);
    expect(artifact.codes).toEqual([...UNIFIED_MODEL_CODES]);
  });

  it("36 kodun HER biri için muSigma girdisi var (mu/sigma/nObserved)", () => {
    for (const code of UNIFIED_MODEL_CODES) {
      expect(artifact.muSigma[code]).toBeDefined();
      expect(typeof artifact.muSigma[code].mu).toBe("number");
      expect(typeof artifact.muSigma[code].sigma).toBe("number");
      expect(typeof artifact.muSigma[code].nObserved).toBe("number");
    }
  });

  it("beta/names uzunluğu codes.length*2 (her kod için z+missing sütunu)", () => {
    expect(artifact.beta.length).toBe(artifact.codes.length * 2);
    expect(artifact.names.length).toBe(artifact.beta.length);
  });

  it("weightsFingerprint, dosyadaki beta/names/muSigma/codes'tan YENİDEN HESAPLANDIĞINDA BİREBİR aynı çıkar (dosya bozulmamış/elle değiştirilmemiş)", () => {
    const recomputed = computeArtifactFingerprint(artifact);
    expect(recomputed).toBe(artifact.weightsFingerprint);
  });

  it("engineVersion, engine-versions.ts::getCurrentRanEngineVersion().surum ile eşleşir", () => {
    expect(artifact.engineVersion).toBe(getCurrentRanEngineVersion().surum);
  });

  it("eğitim bilgileri kullanıcının kabul ettiği GERÇEK rakamlarla eşleşir (238 train/λ=90)", () => {
    expect(artifact.nRacesTrain).toBe(238);
    expect(artifact.nRacesHoldout).toBe(62);
    expect(artifact.lambda).toBe(90);
    expect(artifact.learningRate).toBe(0.25);
    expect(artifact.iterations).toBe(2500);
  });
});

describe("loadTrainedModel() — GERÇEK artifact'ı sorunsuz yükler", () => {
  it("throw ETMEDEN FittedModel<string> döner, idempotenttir (her çağrı AYNI nesne)", () => {
    const a = loadTrainedModel();
    const b = loadTrainedModel();
    expect(a).toBe(b);
    expect(a.beta.length).toBe(72);
    expect(a.names.length).toBe(72);
    expect(a.stats.size).toBe(36);
    expect(a.nRacesUsed).toBe(238);
    expect(a.opts.lambda).toBe(90);
  });

  it("trainedModelMeta() ağırlıkları İÇERMEZ ama eğitim meta bilgisini taşır", () => {
    const meta = trainedModelMeta() as unknown as Record<string, unknown>;
    expect(meta.beta).toBeUndefined();
    expect(meta.names).toBeUndefined();
    expect(meta.muSigma).toBeUndefined();
    expect(meta.nRacesTrain).toBe(238);
  });
});

describe("validateAndBuildModel() — madde 4: sessiz fallback YOK, THROW disiplini", () => {
  it("geçerli (GERÇEK) artifact ile throw ETMEZ", () => {
    expect(() => validateAndBuildModel(artifact)).not.toThrow();
  });

  it("null/boş girdide THROW eder", () => {
    expect(() => validateAndBuildModel(null)).toThrow(/okunamadı/);
    expect(() => validateAndBuildModel(undefined)).toThrow();
  });

  it("engineVersion beklenenle UYUŞMUYORSA THROW eder", () => {
    const bozuk = { ...artifact, engineVersion: "0.9-eski-bir-surum" };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/engineVersion/);
  });

  it("codes UNIFIED_MODEL_CODES ile AYNI SIRADA DEĞİLSE THROW eder", () => {
    const yerDegistirilmis = [...artifact.codes];
    [yerDegistirilmis[0], yerDegistirilmis[1]] = [yerDegistirilmis[1], yerDegistirilmis[0]];
    const bozuk = { ...artifact, codes: yerDegistirilmis };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/AYNI SIRADA/);
  });

  it("codes bir eleman EKSİKSE THROW eder", () => {
    const bozuk = { ...artifact, codes: artifact.codes.slice(0, -1) };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/uzunluğu/);
  });

  it("bir kod için muSigma EKSİKSE THROW eder", () => {
    const { [artifact.codes[0]]: _removed, ...kalanMuSigma } = artifact.muSigma;
    const bozuk = { ...artifact, muSigma: kalanMuSigma };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/muSigma/);
  });

  it("beta TEK bir elemanı elle DEĞİŞTİRİLMİŞSE (fingerprint tutmaz) THROW eder", () => {
    const bozukBeta = [...artifact.beta];
    bozukBeta[0] = bozukBeta[0] + 0.5;
    const bozuk = { ...artifact, beta: bozukBeta };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/weightsFingerprint/);
  });

  it("muSigma'da TEK bir mu değeri elle DEĞİŞTİRİLMİŞSE (fingerprint tutmaz) THROW eder", () => {
    const code = artifact.codes[0];
    const bozukMuSigma = { ...artifact.muSigma, [code]: { ...artifact.muSigma[code], mu: artifact.muSigma[code].mu + 1 } };
    const bozuk = { ...artifact, muSigma: bozukMuSigma };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/weightsFingerprint/);
  });

  it("beta.length codes.length*2 ile UYUŞMUYORSA THROW eder", () => {
    const bozuk = { ...artifact, beta: artifact.beta.slice(0, -1), names: artifact.names.slice(0, -1) };
    expect(() => validateAndBuildModel(bozuk)).toThrow(/beta\.length/);
  });
});
