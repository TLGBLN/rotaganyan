/**
 * ROTAGANYAN — Hipodrom "Mesafe/Start Noktası Diyagramı" (TJK resmi PNG) üzerindeki
 * her mesafe/pist etiketinin yaklaşık konumu (görselin genişlik/yükseklik yüzdesi, 0-100).
 *
 * Elle, TJK'nin kendi görselini 3x büyütüp inceleyerek çıkarıldı (2026-07-25). Küçük
 * (~±3%) sapmalar olabilir — işaretleyici (bkz. HipodromOzellikleriModal) bunu tolere
 * edecek büyüklükte bir halka/nokta olarak çiziliyor. Bazı hipodromlarda aynı mesafe
 * hem ana pistte hem de bir yan/kısa şerit (chute) üzerinde tekrar ediyordu — bu tür
 * çakışmalarda ana pistteki (daha güvenilir okunan) konum tercih edildi.
 *
 * NOT (İstanbul/Antalya): TJK'nin bu diyagramlardaki kendi renk lejantı — hipodrom-
 * ozellikleri.ts'teki "kumPist" alan adıyla birebir örtüşmeyebilir (İstanbul'da iç pist
 * görselde "Sentetik" olarak etiketli, Antalya'da hem "Sentetik" hem "Yan Sentetik" var).
 * Bu dosyadaki anahtarlar site şemasındaki Surface enum'una (CIM/KUM/SENTETIK) göre,
 * diyagramın KENDİ yazılı lejantına bakılarak eşlendi — antrenman pisti hariç.
 */

export type MesafeKoordinat = { x: number; y: number };
export type YuzeyKoordinatlari = Partial<Record<"CIM" | "KUM" | "SENTETIK", Record<number, MesafeKoordinat>>>;

export const HIPODROM_MESAFE_KOORDINATLARI: Record<string, YuzeyKoordinatlari> = {
  izmir: {
    KUM: {
      1000: { x: 38, y: 21 }, 1100: { x: 49, y: 11 }, 1200: { x: 61, y: 8 }, 1400: { x: 87, y: 14 },
      1600: { x: 90, y: 71 }, 1900: { x: 56, y: 74 }, 2000: { x: 44, y: 74 }, 2100: { x: 32, y: 74 }, 2200: { x: 20, y: 74 },
    },
    CIM: {
      900: { x: 36, y: 28 }, 1000: { x: 49, y: 23 }, 1100: { x: 61, y: 20 }, 1200: { x: 74, y: 22 }, 1300: { x: 88, y: 29 },
      1700: { x: 57, y: 63 }, 1800: { x: 45, y: 63 }, 1900: { x: 33, y: 63 }, 2000: { x: 22, y: 63 }, 2400: { x: 28, y: 33 },
    },
  },
  istanbul: {
    CIM: {
      1600: { x: 26, y: 13 }, 1500: { x: 34, y: 10 }, 1400: { x: 43, y: 9 }, 1300: { x: 51, y: 9 },
      1200: { x: 60, y: 9 }, 1100: { x: 69, y: 9 }, 1000: { x: 78, y: 16 }, 900: { x: 86, y: 24 },
      800: { x: 89, y: 33 }, 2800: { x: 91, y: 37 }, 1800: { x: 12, y: 39 }, 1900: { x: 15, y: 54 },
      2000: { x: 21, y: 68 }, 2100: { x: 32, y: 75 }, 2200: { x: 40, y: 75 }, 2400: { x: 57, y: 75 },
    },
    SENTETIK: {
      1500: { x: 29, y: 27 }, 1400: { x: 38, y: 25 }, 1300: { x: 47, y: 23 }, 1200: { x: 56, y: 22 },
      1100: { x: 65, y: 22 }, 1000: { x: 73, y: 22 }, 2800: { x: 80, y: 25 },
      2000: { x: 39, y: 62 }, 2100: { x: 48, y: 62 }, 2200: { x: 57, y: 62 }, 2400: { x: 72, y: 62 },
    },
  },
  ankara: {
    CIM: {
      1600: { x: 22, y: 13 }, 1500: { x: 31, y: 10 }, 1400: { x: 40, y: 9 }, 1300: { x: 48, y: 9 },
      1200: { x: 57, y: 9 }, 1000: { x: 75, y: 10 }, 1900: { x: 10, y: 53 }, 2800: { x: 91, y: 68 }, 2200: { x: 51, y: 80 },
    },
    KUM: {
      1600: { x: 17, y: 30 }, 1500: { x: 25, y: 22 }, 1400: { x: 34, y: 20 }, 1300: { x: 42, y: 18 },
      1200: { x: 51, y: 17 }, 1100: { x: 61, y: 18 }, 2800: { x: 80, y: 27 },
      2000: { x: 29, y: 63 }, 2100: { x: 38, y: 63 }, 2200: { x: 46, y: 63 }, 2400: { x: 63, y: 63 },
    },
  },
  bursa: {
    CIM: {
      800: { x: 24, y: 53 }, 900: { x: 43, y: 25 }, 1000: { x: 50, y: 26 }, 1100: { x: 56, y: 28 },
      1200: { x: 62, y: 30 }, 1300: { x: 68, y: 31 }, 1400: { x: 75, y: 32 }, 1500: { x: 80, y: 33 },
      1700: { x: 92, y: 57 }, 1800: { x: 96, y: 68 }, 2000: { x: 68, y: 76 }, 2100: { x: 62, y: 76 },
      2200: { x: 55, y: 76 }, 2400: { x: 43, y: 76 },
    },
    KUM: {
      1000: { x: 57, y: 37 }, 1200: { x: 69, y: 42 }, 1300: { x: 76, y: 44 }, 1400: { x: 82, y: 45 },
      1800: { x: 68, y: 70 }, 1900: { x: 62, y: 70 }, 2000: { x: 55, y: 70 }, 2100: { x: 49, y: 70 }, 2200: { x: 43, y: 65 },
    },
  },
  adana: {
    KUM: {
      1000: { x: 64, y: 10 }, 1100: { x: 54, y: 10 }, 1200: { x: 44, y: 10 }, 1300: { x: 34, y: 10 }, 1400: { x: 22, y: 10 },
      1900: { x: 40, y: 70 }, 2000: { x: 49, y: 70 }, 2100: { x: 58, y: 70 }, 2200: { x: 67, y: 70 }, 2400: { x: 87, y: 70 },
    },
    CIM: {
      1000: { x: 57, y: 29 }, 1100: { x: 47, y: 29 }, 1200: { x: 37, y: 29 }, 1300: { x: 27, y: 29 },
      1800: { x: 42, y: 52 }, 1900: { x: 51, y: 52 }, 2000: { x: 60, y: 52 }, 2100: { x: 73, y: 52 },
    },
  },
  diyarbakir: {
    KUM: {
      900: { x: 63, y: 10 }, 1000: { x: 51, y: 10 }, 1100: { x: 39, y: 10 }, 1200: { x: 26, y: 10 },
      1700: { x: 37, y: 68 }, 1800: { x: 50, y: 68 }, 1900: { x: 63, y: 68 }, 2000: { x: 75, y: 68 },
    },
  },
  elazig: {
    KUM: {
      1200: { x: 11, y: 10 }, 1100: { x: 24, y: 10 }, 1000: { x: 39, y: 10 }, 2400: { x: 55, y: 10 },
      1500: { x: 30, y: 72 }, 1600: { x: 43, y: 72 }, 1700: { x: 54, y: 72 }, 1800: { x: 66, y: 72 },
      1900: { x: 78, y: 72 }, 2000: { x: 90, y: 72 },
    },
  },
  kocaeli: {
    KUM: {
      1000: { x: 51, y: 17 }, 1100: { x: 60, y: 17 }, 1200: { x: 69, y: 17 }, 1400: { x: 86, y: 17 }, 1500: { x: 95, y: 17 },
      1700: { x: 50, y: 72 }, 1800: { x: 41, y: 72 }, 1900: { x: 32, y: 72 }, 2000: { x: 23, y: 72 },
    },
  },
  sanliurfa: {
    KUM: {
      1000: { x: 51, y: 10 }, 1100: { x: 42, y: 10 }, 1200: { x: 31, y: 10 }, 1300: { x: 19, y: 10 }, 1400: { x: 6, y: 26 },
      1700: { x: 24, y: 70 }, 1800: { x: 35, y: 70 }, 1900: { x: 46, y: 70 }, 2000: { x: 58, y: 70 }, 2100: { x: 69, y: 70 },
    },
  },
  antalya: {
    SENTETIK: {
      1700: { x: 4, y: 7 }, 1600: { x: 14, y: 7 }, 1500: { x: 24, y: 8 }, 1400: { x: 33, y: 8 }, 1300: { x: 42, y: 8 },
      1200: { x: 52, y: 8 }, 1100: { x: 62, y: 8 }, 1000: { x: 72, y: 8 }, 900: { x: 75, y: 22 }, 800: { x: 97, y: 22 },
      1900: { x: 41, y: 62 }, 2000: { x: 37, y: 75 }, 2100: { x: 46, y: 75 }, 2200: { x: 56, y: 75 }, 2400: { x: 75, y: 75 },
    },
  },
};

/**
 * Bu mesafenin start noktası pistin virajında mı düz yolunda mı — tüm hipodromların
 * ortak "stadyum ovali" biçiminden çıkarılan bir yaklaşıklık (sol/sağ uçtaki yuvarlak
 * bölge = viraj, üst/alt yatay bant ve yan şeritler/chute'lar = düz yol). §III.2/§XX.25
 * kuralı gereği bu YALNIZ destekleyici bir bağlam notudur, kesin bir ölçüm değildir.
 */
export function kulvarBolgesi(hippodromeSlug: string, surface: "CIM" | "KUM" | "SENTETIK", distance: number): "viraj" | "düz yol" | null {
  const koordinat = HIPODROM_MESAFE_KOORDINATLARI[hippodromeSlug]?.[surface]?.[distance];
  if (!koordinat) return null;
  const { x, y } = koordinat;
  const solVeyaSagUc = x <= 18 || x >= 82;
  const ortaDikeyBant = y >= 15 && y <= 80;
  return solVeyaSagUc && ortaDikeyBant ? "viraj" : "düz yol";
}
