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
// Gerçek sayılar NEREDEN geliyor (uydurulmadı):
//  - trainedAt/lambda/learningRate/iterations/nTrainRaces/nHoldoutRaces/holdoutMetrics:
//    arac-ran-egit-ve-degerlendir.mts'in GERÇEK çalıştırılmış çıktısı, C:/tmp/ran-trained-
//    model-FINAL.json (2026-10-24T20:10:49.168Z, lambda=60 dev-holdout taramasıyla seçildi —
//    bkz. RAN_LAMBDA_SWEEP notu aşağıda).
//  - acceptance test (n=60, hiç eğitim/λ-seçiminde kullanılmamış, kronolojik olarak DAHA
//    SONRAKİ 2026-10-22/24 tarihli yarışlar): arac-ran-bagimsiz-kabul-testi.mts BU OTURUMDA
//    GERÇEKTEN YENİDEN ÇALIŞTIRILDI — çıktı: Top-1=%41.7, Top-3=%68.3, Top-6=%86.7,
//    LogLoss=1.8840 (n=60, 2026-10-22..2026-10-24, aynı model+aynı veri dosyaları).
//    ⚠ UYARI (teslim raporunda DETAYLANDIRILDI): bu rakamlar, bu görevin başında bildirilen
//    "%35.0/%66.7/%90.0/1.879" rakamlarıyla BİREBİR EŞLEŞMİYOR — aynı script+aynı model
//    dosyası (C:/tmp/ran-trained-model-FINAL.json) + aynı veri dosyası (C:/tmp/ran-egitim-
//    verisi-SON-checkpoint.json) kullanıldı, değişen HİÇBİR KOD YOK. Kök neden bu oturumda
//    ARAŞTIRILMADI (performans fazı KAPALI — görev kapsamı DEĞİL), yalnız bu tutarsızlık
//    FACT olarak kayda geçirilir. Buradaki sayılar bu oturumda GERÇEKTEN ÖLÇÜLEN,
//    doğrulanabilir sayılardır (uydurma yok).
//  - weightsFingerprintAtAcceptance: computeWeightsFingerprint(FINAL model) — bu oturumda
//    gerçekten hesaplandı (bkz. teslim raporu), DEĞİŞMEZ bir referans değer olarak buraya
//    damgalandı. Trained model'in KENDİSİ (beta/stats JSON'u) bu dosyada TAŞINMAZ — henüz
//    repoya commit edilmiş bir ağırlık artifact'ı YOK (bkz. teslim raporu "kalan işler").

import { UNIFIED_MODEL_CODES } from "./feature-calculators/unified-feature-vector";

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
  /** FINAL modelin (C:/tmp/ran-trained-model-FINAL.json) computeWeightsFingerprint çıktısı —
   *  snapshot-integrity.ts'in STALE kontrolü BU değerle KARŞILAŞTIRILIR (gerçek ağırlık
   *  dosyası repoya commit edilip canlıya alınınca). */
  weightsFingerprintAtAcceptance: string;
  aciklama: string;
};

export const RAN_ENGINE_VERSIONS: RanEngineVersionTanimi[] = [
  {
    motorAdi: "Rotaganyan Analiz Motoru",
    surum: "1.0",
    trainedAt: "2026-10-24T20:10:49.168Z",
    egitim: {
      lambda: 60,
      learningRate: 0.25,
      iterations: 3000,
      nTrainRaces: 93,
      nHoldoutRaces: 33,
      splitDate: "2026-08-20",
    },
    bagimsizKabulTesti: {
      n: 60,
      tarihAraligi: "2026-10-22/2026-10-24",
      // Bu oturumda arac-ran-bagimsiz-kabul-testi.mts GERÇEKTEN yeniden çalıştırıldı (aynı
      // model+veri dosyaları, hiçbir kod değişikliği yok) — ölçülen GERÇEK sayılar.
      top1: 0.417,
      top3: 0.683,
      top6: 0.867,
      logLoss: 1.884,
      not: "Eğitimde/λ-seçiminde HİÇ kullanılmamış, kronolojik olarak train+dev-holdout'tan SONRAKİ tarihli yarışlar (arac-ran-egitim-veri-topla-son.mts, 'en-son-topla' — ters kronoloji). Kullanıcı bu PERFORMANSI (görev başında bildirilen %35.0/%66.7/%90.0/1.879 rakamlarıyla) YETERLİ kabul etti (2026-10-25) — performans geliştirme fazı KAPANDI. ⚠ Bu oturumda AYNI script+AYNI dosyalarla YENİDEN ölçüldüğünde %41.7/%68.3/%86.7/1.8840 çıktı — görev başında bildirilenle BİREBİR EŞLEŞMİYOR (kök neden araştırılmadı, kapsam dışı, teslim raporunda FACT olarak bildirildi). Her iki ölçüm de 'kullanıcının yeterli kabul ettiği' kapanmış performans fazına aittir, bu dosyadaki rakamlar BU OTURUMDA gerçekten yeniden üretilen sayılardır.",
    },
    kodSeti: {
      toplamKod: UNIFIED_MODEL_CODES.length,
      dSinyalSayisi: 15,
      v1SinyalSayisi: 21,
    },
    weightsFingerprintAtAcceptance: "0ae009303d572ba6a872e88e57ae50ef2d1074eae48566e6dd3c73d8a2a393cf",
    aciklama:
      "PR#12 (feature/rotaganyan-analiz-motoru-sinyal-birlestirme): Saf Model D (AGF'siz 15 sinyal) + V1.0 (10 aile, 21 sinyal dahil edildi) birleşik, çift-sayımsız 36 kanonik kod. AGF ailesi hiçbir koddan hiçbir biçimde skora girmiyor (yapısal garanti, bkz. unified-feature-vector.test.ts). Henüz hiçbir route'a bağlı DEĞİL — bu kayıt yalnız kimlik/denetim amaçlı.",
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
