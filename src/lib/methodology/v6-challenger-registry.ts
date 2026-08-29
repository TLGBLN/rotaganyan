import { faz2V5Sirala, type Faz1RunnerV5Sirali, type Faz1SonucV5 } from "./v5-engine";
import { hesaplaGecmisPistleriMap } from "@/server/actions/yuzey-degisikligi.actions";
import { ilkKezBuPisteMi } from "@/lib/yuzey-degisikligi";
import { surfaceToPist } from "@/lib/sire-stat-match";

// 2026-08-29 — V6 Aşama 3 (bkz. plan): champion/challenger gölge-testi altyapısının
// kayıt defteri. Her girdi, AYNI gatherFaz1V5 çıktısını (faz1) girdi alıp kendi
// sıralı/olasılıklı çıktısını üreten bir fonksiyon — canlı `olasilik`/sıralamayı HİÇ
// etkilemez, yalnız ChallengerRun'a kaydedilip gelecekte (n>=250-300 sonuçlanmış
// koşu birikince) arac-challenger-degerlendir.mjs ile B=500 bootstrap FARK testine
// tabi tutulur. Yeni bir aday eklemek için buraya yeni bir { key, label, scoreFn }
// eklemek yeterli — cron/servis/araç kodunun HİÇBİRİNE dokunmaya gerek yok.
//
// scoreFn ASYNC — bazı adaylar (örn. yüzey-değişikliği, TjkDereceKaydi arşivine gidiyor)
// kendi veri kaynağına ihtiyaç duyabilir, tıpkı gatherFaz1V5'in kendisi gibi.
export type ChallengerScoreFn = (faz1: Faz1SonucV5) => Promise<Faz1RunnerV5Sirali[]>;

export type ChallengerDef = {
  key: string;
  label: string;
  scoreFn: ChallengerScoreFn;
};

// 2026-08-30 — kullanıcı talebi: "at ilk defa bir pistte çıkacaksa (hep çim koşmuş,
// bu sefer kum gibi), bütün kategorilerde kullanılsın" — TjkDereceKaydi arşivinden
// (zeminToleransi ile AYNI kaynak) atın bugüne kadar HİÇ koşmadığı bir pist tipinde
// koşacağı durumu yakalar. HENÜZ HİÇ TEST EDİLMEDİ — bu yüzden A ya da B katmanına
// DEĞİL, yalnız gölge-teste (C katmanı) ekleniyor. Katsayı (-0.15, log-skor uzayında,
// olasılığı ~%14 azaltır) KANITLANMAMIŞ bir başlangıç varsayımı — "bilinmeyen yüzey
// riskli olabilir" hipotezini gölge-veride test edilebilir kılmak için seçildi, gerçek
// yönü/büyüklüğü yalnız arac-challenger-degerlendir.mjs'in B=500 sonucuyla belirlenecek.
const YUZEY_DEGISIKLIGI_KATSAYI = -0.15;

async function yuzeyDegisikligiScoreFn(faz1: Faz1SonucV5): Promise<Faz1RunnerV5Sirali[]> {
  const baseline = faz2V5Sirala(faz1);
  const bugunkuPist = surfaceToPist(faz1.race.surface);
  const gecmisPistlerByAd = await hesaplaGecmisPistleriMap(faz1.runners.map((r) => r.ad), new Date());

  const carpanlar = baseline.map((r) => {
    const gecmisPistler = gecmisPistlerByAd.get(r.ad) ?? new Set<string>();
    return ilkKezBuPisteMi(gecmisPistler, bugunkuPist) ? Math.exp(YUZEY_DEGISIKLIGI_KATSAYI) : 1;
  });
  const agirlikliToplam = baseline.reduce((s, r, i) => s + r.olasilik * carpanlar[i], 0);
  return baseline.map((r, i) => ({ ...r, olasilik: (r.olasilik * carpanlar[i]) / agirlikliToplam }));
}

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
    scoreFn: async (faz1) => faz2V5Sirala(faz1),
  },
  {
    key: "v6-yuzey-degisikligi",
    label: "Yüzey Değişikliği (ilk kez bu pist tipinde koşuyor — deneysel, kanıtlanmamış)",
    scoreFn: yuzeyDegisikligiScoreFn,
  },
];
