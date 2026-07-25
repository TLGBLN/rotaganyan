/**
 * ROTAGANYAN — Hipodrom fiziksel özellikleri (statik referans veri)
 *
 * Kaynak: TJK resmi "Hipodromlar" sayfası (https://www.tjk.org/TR/Kurumsal/Static/Page/Hipodromlar),
 * 2026-07-25'te elle toplandı. Pist uzunluğu/genişliği TJK'nin kendi yayınladığı ölçülerdir.
 * Mesafe diyagramı (hangi mesafenin pistin neresinden başladığı — viraj/düz yol) da yine TJK'nin
 * kendi görselidir (medya-cdn.tjk.org/medyaftp/mesafeler/{HIPODROM}_2023.PNG), doğrudan gömülü
 * gösterilir — biz ayrıca metne dökmüyoruz (görselden hatalı okuma riski, TJK'nin kendi çizimi
 * en güvenilir kaynak).
 *
 * Bu veri NADİREN değişir (pist yeniden inşa edilmedikçe) — otomatik senkronize edilmiyor,
 * elle güncellenmesi gerekir.
 */

export type HipodromOzellik = {
  ad: string;
  diyagramUrl: string;
  cimPist: string | null;
  kumPist: string | null;
  antrenmanPisti: string | null;
  not?: string;
};

export const HIPODROM_OZELLIKLERI: Record<string, HipodromOzellik> = {
  istanbul: {
    ad: "İstanbul Veliefendi",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/ISTANBUL_2023.PNG",
    cimPist: "2020m × 27-36m",
    kumPist: "1870m × 17.5-19m",
    antrenmanPisti: "1720m × 14-16m",
  },
  ankara: {
    ad: "Ankara 75. Yıl Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/ANKARA_2023.PNG",
    cimPist: "2200m × 30-35m",
    kumPist: "2055m × 20m",
    antrenmanPisti: "1900m × 13.5m",
  },
  izmir: {
    ad: "İzmir Şirinyer Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/IZMIR_2023.PNG",
    cimPist: "1570m × 25m",
    kumPist: "1750m × 20m",
    antrenmanPisti: "1480m × 12m",
  },
  bursa: {
    ad: "Bursa Osmangazi Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/BURSA_2023.PNG",
    cimPist: "1830m × 29m",
    kumPist: "1684m × 20m",
    antrenmanPisti: "1542m × 16m",
  },
  adana: {
    ad: "Adana Yeşiloba Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/ADANA_2023.PNG",
    cimPist: "1614m × 29m",
    kumPist: "1816m × 21.5m",
    antrenmanPisti: "1430m × 12m",
  },
  diyarbakir: {
    ad: "Diyarbakır Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/DIYARBAKIR_2023.PNG",
    cimPist: null,
    kumPist: "1600m × 20m",
    antrenmanPisti: null,
    not: "Kum pist \"doğal dere kumu\" — TJK'nin kendi tanımı.",
  },
  elazig: {
    ad: "Elazığ Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/ELAZIG_2023.PNG",
    cimPist: null,
    kumPist: "1550m × 20m",
    antrenmanPisti: null,
    not: "Kum pist \"doğal dere kumu\" — TJK'nin kendi tanımı.",
  },
  kocaeli: {
    ad: "Kocaeli Kartepe Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/KOCAELI_2023.PNG",
    cimPist: null,
    kumPist: "1600m × 20m",
    antrenmanPisti: null,
  },
  sanliurfa: {
    ad: "Şanlıurfa Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/SANLIURFA_2023.PNG",
    cimPist: null,
    kumPist: "1700m × 20m",
    antrenmanPisti: "1570m × 17m",
  },
  antalya: {
    ad: "Antalya Hipodromu",
    diyagramUrl: "https://medya-cdn.tjk.org/medyaftp/mesafeler/ANTALYA_2023.PNG",
    cimPist: null,
    kumPist: "1980m × 20m (Sentetik/Polytrack)",
    antrenmanPisti: "1835m × 20m (kum)",
  },
};
