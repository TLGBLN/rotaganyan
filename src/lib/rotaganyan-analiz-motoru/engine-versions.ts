// ROTAGANYAN ANALİZ MOTORU — motor sürüm kimliği kaydı.
//
// NEDEN BU DOSYA VAR: production'daki v546-1-engine.ts/ENGINE_VERSIONS (bkz.
// src/lib/methodology/engine-versions.data.ts) deseniyle AYNI fikir — "bir tahmin/pick
// kaydı GERÇEKTEN hangi motor sürümüyle, hangi λ/eğitim-seti ile üretildi?" sorusunun
// TEK doğru kaynağı. V5.46.1 için bu kayıt daha önce başka bir oturumda TASARLANDI ama
// hiçbir yere YAZILMADI (yalnız öneri) — yeni motor (Rotaganyan Analiz Motoru, KASITLI
// OLARAK V'SİZ isim — kullanıcı kararı, V5.46.1/V1.0 ile karıştırılmasın) için bu dosya
// GERÇEKTEN var.
//
// Bu dosya hiçbir route'a BAĞLANMAZ (henüz hiçbir canlı akış bu motoru çağırmıyor —
// kullanıcı kuralı, bkz. teslim raporu "Geri dönüş mekanizması" bölümü). Yalnız:
//  1) snapshot-integrity.ts'in STALE denetimi için "şu an geçerli kabul edilen sürüm
//     hangisi" referansını taşır,
//  2) ileride (route bağlanınca) Prediction/Pick'e yazılacak `engineVersion` string'inin
//     KAYNAĞI budur — elle farklı bir string yazılmaz.
//
// DÜZELTME (2026-10-25, PR#12 ağırlık-sabitleme turu): bu dosyanın ÖNCEKİ hali (commit
// 93c77cc) YANLIŞ modele (C:/tmp/ran-trained-model-FINAL.json, 93 yarış/λ=60 — küçük
// örneklem, dosya adı yanıltıcı şekilde "FINAL") işaret ediyordu. GERÇEKTEN kabul edilen
// model 238 yarışla/λ=90 ile eğitilen, bağımsız kabul testinde (n=60, 2026-10-22/24,
// eğitimden TAMAMEN ayrı) Top-1=%35.0/Top-3=%66.7/Top-6=%90.0/LogLoss=1.879 veren modeldir
// (C:/tmp/ran-trained-model.json — kullanıcının KABUL ETTİĞİ rakamlar, 2026-10-25). Bu
// dosyadaki tüm sayılar o doğru modele göre DÜZELTİLDİ ve artık git-tracked artifact'tan
// (artifacts/ran-trained-model.json, bkz. load-trained-model.ts) GERÇEKTEN taşınıyor —
// ağırlıkların KENDİSİ artık repoda, yalnız meta bilgi DEĞİL.
//
// Gerçek sayılar NEREDEN geliyor (uydurulmadı):
//  - trainedAt/lambda/learningRate/iterations/nTrainRaces/nHoldoutRaces/splitDate:
//    arac-ran-egit-ve-degerlendir.mts'in GERÇEK çalıştırılmış çıktısı (RAN_LAMBDA=90,
//    RAN_IN=C:/tmp/ran-egitim-verisi.json, 300 yarış → gün-sınırlı ayrım: train=238
//    (2026-08-16..2026-08-25), dev-holdout=62 (2026-08-26..2026-08-28), λ seçimi için) —
//    bu oturumda BİT-BİREBİR YENİDEN ÜRETİLDİ (aynı beta/names/stats, bkz. teslim raporu).
//  - acceptance test (n=60, hiç eğitim/λ-seçiminde kullanılmamış, kronolojik olarak DAHA
//    SONRAKİ 2026-10-22/24 tarihli yarışlar): arac-ran-bagimsiz-kabul-testi.mts BU OTURUMDA
//    GERÇEKTEN ÇALIŞTIRILDI (RAN_MODEL=C:/tmp/ran-trained-model.json) — çıktı: Top-1=%35.0,
//    Top-3=%66.7, Top-6=%90.0, LogLoss=1.8794 (yuvarlanmış: 1.879) — görev başında bildirilen
//    rakamlarla BİREBİR EŞLEŞTİ.
//  - weightsFingerprintAtAcceptance: computeWeightsFingerprint(doğru model: beta+names,
//    artifacts/ran-trained-model.json'dan) — bu oturumda gerçekten hesaplandı. NOT: bu,
//    load-trained-model.ts::computeArtifactFingerprint'ten (codes+names+beta+muSigma
//    kapsar, "dosya bozulmadı mı" sorusu için) FARKLI bir hash — ikisi KARIŞTIRILMAMALI,
//    bu alan yalnız snapshot-integrity.ts'in STALE kontrolü için (beta+names drift).

import { UNIFIED_MODEL_CODES } from "./unified-model-codes";

export type RanEngineVersionTanimi = {
  /** Kullanıcı kararı: motor adı KASITLI OLARAK V'siz. `surum` yalnız İÇ referans/damga. */
  motorAdi: "Rotaganyan Analiz Motoru";
  surum: string;
  trainedAt: string; // ISO — arac-ran-egit-ve-degerlendir.mts çıktısından
  egitim: {
    lambda: number;
    learningRate: number;
    iterations: number;
    nTrainRaces: number;
    nHoldoutRaces: number; // dev-holdout (λ seçimi için, AYRI, 20-21 Ağustos aralığı)
    splitDate: string;
  };
  bagimsizKabulTesti: {
    n: number;
    tarihAraligi: string;
    top1: number;
    top3: number;
    top6: number;
    logLoss: number;
    not: string;
  };
  kodSeti: {
    toplamKod: number; // UNIFIED_MODEL_CODES.length ile DOĞRULANIR (aşağıda assert)
    dSinyalSayisi: number;
    v1SinyalSayisi: number;
  };
  /** Doğru modelin (artifacts/ran-trained-model.json, 238 yarış/λ=90) computeWeightsFingerprint
   *  çıktısı (beta+names) — snapshot-integrity.ts'in STALE kontrolü BU değerle KARŞILAŞTIRILIR. */
  weightsFingerprintAtAcceptance: string;
  aciklama: string;
};

export const RAN_ENGINE_VERSIONS: RanEngineVersionTanimi[] = [
  {
    motorAdi: "Rotaganyan Analiz Motoru",
    surum: "1.0",
    trainedAt: "2026-10-24T22:04:51.458Z",
    egitim: {
      lambda: 90,
      learningRate: 0.25,
      iterations: 2500,
      nTrainRaces: 238,
      nHoldoutRaces: 62,
      splitDate: "2026-08-26",
    },
    bagimsizKabulTesti: {
      n: 60,
      tarihAraligi: "2026-10-22/2026-10-24",
      // Bu oturumda arac-ran-bagimsiz-kabul-testi.mts GERÇEKTEN çalıştırıldı
      // (RAN_MODEL=C:/tmp/ran-trained-model.json — 238 yarış/λ=90 — artık ayrıca
      // artifacts/ran-trained-model.json olarak repoda) — ölçülen GERÇEK sayılar, görev
      // başında bildirilenle BİREBİR eşleşti.
      top1: 0.35,
      top3: 0.667,
      top6: 0.9,
      logLoss: 1.8794,
      not: "Eğitimde/λ-seçiminde HİÇ kullanılmamış, kronolojik olarak train+dev-holdout'tan SONRAKİ tarihli yarışlar (arac-ran-egitim-veri-topla-son.mts, 'en-son-topla' — ters kronoloji). Kullanıcı bu PERFORMANSI yeterli kabul etti (2026-10-25) — performans geliştirme fazı KAPANDI, bu tur SADECE doğru ağırlık dosyasını sabitleyip entegre etti (yeni eğitim/araştırma YOK).",
    },
    kodSeti: {
      toplamKod: UNIFIED_MODEL_CODES.length,
      dSinyalSayisi: 15,
      v1SinyalSayisi: 21,
    },
    weightsFingerprintAtAcceptance: "f42a8975bbdf29cf8556a8c818379ad8333fb41f18c5b16801b775c19f12b40c",
    aciklama:
      "PR#12 (feature/rotaganyan-analiz-motoru-sinyal-birlestirme): Saf Model D (AGF'siz 15 sinyal) + V1.0 (10 aile, 21 sinyal dahil edildi) birleşik, çift-sayımsız 36 kanonik kod. AGF ailesi hiçbir koddan hiçbir biçimde skora girmiyor (yapısal garanti, bkz. unified-feature-vector.test.ts). Ağırlıkların KENDİSİ artık artifacts/ran-trained-model.json'da (load-trained-model.ts ile yüklenir) — henüz hiçbir route'a bağlı DEĞİL, bu kayıt yalnız kimlik/denetim amaçlı (ACTIVE_PREDICTION_ENGINE entegrasyonu AYRI bir sonraki görev).",
  },
];

/** Şu an "geçerli kabul edilen" (en son) sürüm — snapshot-integrity.ts'in varsayılan
 *  referansı. Birden fazla sürüm eklenirse bu HER ZAMAN dizinin SON elemanıdır (production
 *  deseniyle AYNI — engine-versions.data.ts'teki ENGINE_VERSIONS da kronolojik sırayla
 *  eklenir, "bitis: null" olan geçerli kabul edilir; burada tek sürüm olduğu için basitçe
 *  son eleman alınır). */
export function getCurrentRanEngineVersion(): RanEngineVersionTanimi {
  const v = RAN_ENGINE_VERSIONS[RAN_ENGINE_VERSIONS.length - 1];
  if (!v) throw new Error("RAN_ENGINE_VERSIONS boş — en az bir sürüm kaydı olmalı.");
  return v;
}

// Modül yükleme zamanında bir kere: kayıttaki toplamKod, GERÇEK UNIFIED_MODEL_CODES ile
// senkronizasyon dışı kalırsa (ör. kod eklenip registry güncellenmezse) hemen patlar.
for (const v of RAN_ENGINE_VERSIONS) {
  if (v.kodSeti.toplamKod !== UNIFIED_MODEL_CODES.length) {
    throw new Error(
      `engine-versions.ts: ${v.surum} sürümünün kodSeti.toplamKod=${v.kodSeti.toplamKod} ama UNIFIED_MODEL_CODES.length=${UNIFIED_MODEL_CODES.length} — registry senkron dışı.`
    );
  }
}
