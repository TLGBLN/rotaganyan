/**
 * Anormal Pist Modu v1 — ÜÇÜNCÜ (birleştirici) katman. Banko/kupon kararını YALNIZ
 * bu dosya verir — pist-dayanikliligi.ts ve gecmis-yeterliligi.ts birbirinden
 * BAĞIMSIZ iki ölçüm yapar, ikisini birleştirip operasyonel karara çeviren tek yer
 * burasıdır (2026-09-16 kullanıcı mimarisi):
 *
 *   V5.46 → Pist Duyarlılığı  ─┐
 *                              ├─→ Anormal Pist Riski → Banko/Kupon Politikası
 *   V5.46 → Geçmiş Yeterliliği ┘
 *
 * HİÇBİRİ V5.46 skoruna girmez — bunlar prediction feature değil, production
 * tahmininin GÜVENİLİRLİĞİNİ yöneten ayrı risk katmanlarıdır.
 */
import { faz2V5Sirala, type Faz1SonucV5 } from "./v5-engine";
import {
  hesaplaPistDayaniklilikSiniflandirmasi,
  kosununRejimi,
  kosuAnormalMi,
  hamZeminDetayiBul,
  surfaceRejimEtiketi,
  type ZeminRejimi,
  type SurfaceCondition,
  type PistDayaniklilikSonucu,
} from "./pist-dayanikliligi";
import { hesaplaGecmisYeterliligi, type GecmisYeterliligiSonucu } from "./gecmis-yeterliligi";

export type GecmisRiskSeviyesi = "YETERLI" | "SINIRLI" | "YETERSIZ";

// İLK SÜRÜM tahmini eşik — kullanıcının kendi örneği (%32+%18 gibi kütle birikimi)
// baz alınarak seçildi, istatistiksel olarak KALİBRE EDİLMEDİ. Veri birikince (bkz.
// proje planı gate eşiği) ayarlanabilir — "Sert Koşul Yasak" ruhuna uygun olarak
// burada AÇIKÇA bir sabit olarak duruyor, gizli bir "doğru" değer gibi sunulmuyor.
const YETERSIZLIK_KUTLESI_ESIGI = 0.3;

function gecmisRiskSeviyesiHesapla(g: GecmisYeterliligiSonucu): GecmisRiskSeviyesi {
  if (g.liderGecmisiYetersizMi) return "YETERSIZ";
  if (g.yetersizlikKutlesi >= YETERSIZLIK_KUTLESI_ESIGI) return "SINIRLI";
  return "YETERLI";
}

export type AnormalPistOperasyon = {
  bankoIzinVer: boolean;
  /** true ise kupon-optimizer'a bu ayak için minUnitCounts'ta mevcut sayının
   *  ÜZERİNE en az 1 alternatif daha zorlanmalı. */
  ekAlternatifGerekli: boolean;
  /** true ise Banko Güveni bir kademe düşürülür (Yüksek→Orta, Orta→Düşük). */
  guvenDusur: boolean;
  /** Admin/public gösterimi için kısa, sayısal detay İÇERMEYEN gerekçe
   *  (bkz. feedback_mutfagi_acma_ilkesi). */
  uyariMesaji: string;
};

export type AnormalPistRiskSonucu = {
  pistAnormalMi: boolean;
  pistRejimi: ZeminRejimi;
  // 2026-09-16 kullanıcı talebi ("Çim ağırlaşması ≠ Kum ıslanması") — shadow veri
  // setinde kaybolmaması için: pist türü + normalize rejim birleşik etiketi (ör.
  // "CIM_COK_AGIR", "KUM_NEMLI") ve TJK'nın kendi ham metni (ör. "Çok Ağır 5,4").
  // İKİSİ DE yalnız ETİKET — pistAnormalMi/pistDuyarliligi/operasyon kararına girmez,
  // V5.47 interaction test aşamasında Çim/Kum'u (ve gerekirse alt-rejimleri) AYRI
  // değerlendirebilmek için saklanıyor.
  surfaceRegimeEtiketi: string;
  hamZeminDetayi: string | null;
  pistDuyarliligi: PistDayaniklilikSonucu["siniflandirma"] | null;
  gecmisRiskSeviyesi: GecmisRiskSeviyesi | null;
  operasyon: AnormalPistOperasyon;
  /** Admin detay ekranı için ham alt-sonuçlar — public'e HİÇ gönderilmez. */
  detay: { pistDayaniklilik: PistDayaniklilikSonucu; gecmisYeterliligi: GecmisYeterliligiSonucu } | null;
};

const NORMAL_GUNUN_OPERASYONU: AnormalPistOperasyon = {
  bankoIzinVer: true,
  ekAlternatifGerekli: false,
  guvenDusur: false,
  uyariMesaji: "",
};

/**
 * Kullanıcı onaylı karar tablosu (2026-09-16):
 *
 * | Pist Duyarlılığı | Geçmiş Yeterliliği | Operasyon                              |
 * |---|---|---|
 * | Stabil     | Yeterli          | Normal davran                              |
 * | Stabil     | Sınırlı          | Güveni düşür                               |
 * | Stabil     | Yetersiz         | Banko kapat                                |
 * | Hassas     | Yeterli          | +1 alternatif düşün                        |
 * | Hassas     | Sınırlı/Yetersiz | Banko yok + genişlet                       |
 * | Çok Hassas | Her durum        | Banko yok, güçlü risk uyarısı              |
 */
function operasyonBelirle(
  duyarlilik: PistDayaniklilikSonucu["siniflandirma"],
  gecmisRisk: GecmisRiskSeviyesi
): AnormalPistOperasyon {
  if (duyarlilik === "COK_HASSAS") {
    return {
      bankoIzinVer: false,
      ekAlternatifGerekli: true,
      guvenDusur: true,
      uyariMesaji: "Pist koşulları nedeniyle sıralama ciddi ölçüde duyarlı — bu ayakta kupon daha geniş tutulmuştur.",
    };
  }
  if (duyarlilik === "HASSAS") {
    if (gecmisRisk === "YETERLI") {
      return {
        bankoIzinVer: true,
        ekAlternatifGerekli: true,
        guvenDusur: false,
        uyariMesaji: "Pist koşulları normal dışı — bu ayakta bir alternatif at daha önerilir.",
      };
    }
    return {
      bankoIzinVer: false,
      ekAlternatifGerekli: true,
      guvenDusur: true,
      uyariMesaji: "Pist koşulları normal dışı ve favori adayların geçmiş verisi sınırlı — bu ayakta kupon daha geniş tutulmuştur.",
    };
  }
  // STABIL
  if (gecmisRisk === "YETERSIZ") {
    return {
      bankoIzinVer: false,
      ekAlternatifGerekli: false,
      guvenDusur: true,
      uyariMesaji: "Favori adayın bu pist koşulunda geçmiş verisi yok — banko verilmemiştir.",
    };
  }
  if (gecmisRisk === "SINIRLI") {
    return {
      bankoIzinVer: true,
      ekAlternatifGerekli: false,
      guvenDusur: true,
      uyariMesaji: "Bazı favori adayların geçmiş verisi sınırlı — güven bir kademe düşürülmüştür.",
    };
  }
  return NORMAL_GUNUN_OPERASYONU; // Stabil + Yeterli = normal davran
}

/**
 * Tek giriş noktası: bir koşunun pist rejimi NORMAL ise (büyük çoğunluk) hiçbir
 * shadow hesaplama YAPILMAZ, doğrudan "normal davran" döner — bu sistem yalnız
 * gerçekten anormal günlerde devreye girer.
 */
export function hesaplaAnormalPistRiski(
  faz1: Faz1SonucV5,
  surfaceConditions: SurfaceCondition[] | null | undefined
): AnormalPistRiskSonucu {
  const pistRejimi = kosununRejimi(faz1.race.surface, surfaceConditions);
  const surfaceRegimeEtiketi = surfaceRejimEtiketi(faz1.race.surface, pistRejimi);
  const hamZeminDetayi = hamZeminDetayiBul(faz1.race.surface, surfaceConditions);
  if (!kosuAnormalMi(pistRejimi)) {
    return {
      pistAnormalMi: false,
      pistRejimi,
      surfaceRegimeEtiketi,
      hamZeminDetayi,
      pistDuyarliligi: null,
      gecmisRiskSeviyesi: null,
      operasyon: NORMAL_GUNUN_OPERASYONU,
      detay: null,
    };
  }

  const pistDayaniklilik = hesaplaPistDayaniklilikSiniflandirmasi(faz1);
  const gecmisYeterliligi = hesaplaGecmisYeterliligi(faz2V5Sirala(faz1));
  const gecmisRiskSeviyesi = gecmisRiskSeviyesiHesapla(gecmisYeterliligi);
  const operasyon = operasyonBelirle(pistDayaniklilik.siniflandirma, gecmisRiskSeviyesi);

  return {
    pistAnormalMi: true,
    pistRejimi,
    surfaceRegimeEtiketi,
    hamZeminDetayi,
    pistDuyarliligi: pistDayaniklilik.siniflandirma,
    gecmisRiskSeviyesi,
    operasyon,
    detay: { pistDayaniklilik, gecmisYeterliligi },
  };
}
