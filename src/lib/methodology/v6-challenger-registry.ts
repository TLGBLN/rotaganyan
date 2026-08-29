import { faz2V5Sirala, type Faz1RunnerV5Sirali, type Faz1SonucV5 } from "./v5-engine";

// 2026-08-29 — V6 Aşama 3 (bkz. plan): champion/challenger gölge-testi altyapısının
// kayıt defteri. Her girdi, AYNI gatherFaz1V5 çıktısını (faz1) girdi alıp kendi
// sıralı/olasılıklı çıktısını üreten bir fonksiyon — canlı `olasilik`/sıralamayı HİÇ
// etkilemez, yalnız ChallengerRun'a kaydedilip gelecekte (n>=250-300 sonuçlanmış
// koşu birikince) arac-challenger-degerlendir.mjs ile B=500 bootstrap FARK testine
// tabi tutulur. Yeni bir aday eklemek için buraya yeni bir { key, label, scoreFn }
// eklemek yeterli — cron/servis/araç kodunun HİÇBİRİNE dokunmaya gerek yok.
export type ChallengerScoreFn = (faz1: Faz1SonucV5) => Faz1RunnerV5Sirali[];

export type ChallengerDef = {
  key: string;
  label: string;
  scoreFn: ChallengerScoreFn;
};

export const CHALLENGER_REGISTRY: ChallengerDef[] = [
  {
    // 2026-08-29 — gerçek bir aday DEĞİL: champion'ın birebir kopyası (A/A sağlık
    // testi). Amaç, gelecekte gerçek bir aday eklendiğinde güvenilecek olan bu
    // ÖLÇÜM HATTININ KENDİSİNİN (eşleştirme, bootstrap, metrik hesaplama) doğru
    // çalıştığını kanıtlamak — iki özdeş model karşılaştırıldığında B=500 farkının
    // top1/top3/logloss'un ÜÇÜNDE de sıfırı içermesi beklenir. İçermiyorsa altyapıda
    // bir hata var demektir, gerçek bir aday güvenilir şekilde test edilemez.
    key: "v6-aa-sanity",
    label: "A/A Sağlık Testi (champion ile birebir aynı, gerçek aday değil)",
    scoreFn: faz2V5Sirala,
  },
];
