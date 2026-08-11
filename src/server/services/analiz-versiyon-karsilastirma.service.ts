import { db } from "@/lib/db";

/**
 * v6.103 — kullanıcı kararı 2026-08-11: "bunu sistematik olarak dashboarda da ekle, analiz
 * motoru versiyonu başlık ve altında nelerin analiz edildiği hangi çaprazlamaların
 * kullanıldığı bölüm bölüm oluştur karşılaştırma yapalım, başarı oranını da belirterek."
 *
 * Versiyon sınırları UYDURULMADI — bu dosyadaki her tarih/saat, git log'daki gerçek commit
 * zaman damgasından alındı (v2-engine.ts'e dokunan commit'ler; `git log --format="%ai"
 * <hash>`). "Neyi analiz ediyor" / "çaprazlamalar" alanları o dönemde gerçekten canlı olan
 * kod-garanti fonksiyonlarını özetler, tahmini/genel bir açıklama değildir.
 *
 * Başarı oranı hesaplaması `analiz-performans.service.ts` ile AYNI kaynağı kullanır
 * (Result.hitTop1/hitInCoupon, yalnız published:true) — yalnız pencere TARİHE göre değil
 * VERSİYON aralığına göre bölünür. Ek Claude çağrısı yok.
 */

export type EngineVersionTanimi = {
  versiyon: string;
  baslangic: Date;
  bitis: Date | null; // null = hâlâ güncel
  aciklama: string;
  neyiAnalizEdiyor: string[];
  caprazlamalar: string[];
};

export const ENGINE_VERSIONS: EngineVersionTanimi[] = [
  {
    versiyon: "V2",
    baslangic: new Date("2026-08-04T06:33:39+03:00"), // 2f903ac — V2 motoru gerçek admin akışına bağlandı
    bitis: new Date("2026-08-09T22:35:09+03:00"),
    aciklama: "V1-V22 kod-garanti sistemi ilk kez gerçek admin akışına bağlandı (Faz3 yok, manuel sıralama).",
    neyiAnalizEdiyor: [
      "V1-V22: pedigri, idman/split, takı, kilo, sınıf geçişi (SKK), form dizisi, H2H, AGF, stil-popülasyon uyumu, zemin-kazanma geçmişi",
      "A-E ek kategoriler (kalite denetimi, kaçırma uyarıları)",
    ],
    caprazlamalar: [
      "V10+V12 (stil-popülasyon uyumu)",
      "V21+V4 / V21+V19 / V21+V6 (AGF hareketi + destekleyici sinyal)",
      "V13+V10 (kilo değişimi + stil)",
      "Kod-garanti mekanik enjeksiyon: V1, V4, V5, V14, V19, V20, V22",
    ],
  },
  {
    versiyon: "V2.1",
    baslangic: new Date("2026-08-09T22:35:09+03:00"), // 30f3169 — motor sürümü V2.1 etiketlendi
    bitis: new Date("2026-08-10T17:03:34+03:00"),
    aciklama: "Karar hiyerarşisi koşulsuz zorunlu kılındı; AGF trend + AGF favorisi düşüş garantileri eklendi. (Bu aralık içinde kısa ömürlü V2.2 yapılandırılmış-muhakeme denemesi de vardı, mimari nedenle geri alındı — bkz. memory, sonuç istatistiklerini etkilemez.)",
    neyiAnalizEdiyor: ["V1-V22 (V2 ile aynı kapsam)"],
    caprazlamalar: [
      "Karar hiyerarşisi: Güçlü Aday > Düşük Risk > Orta Risk > Yüksek Risk (koşulsuz)",
      "AGF trend (yükselen/düşen) + güçlü sinyal (V1/V19/V22) → ilk 2'ye koşulsuz terfi",
      "AGF trend (tek başına) → ilk 4'e terfi",
      "Sahadaki GERÇEK AGF lideri, düşüşe rağmen hâlâ favoriyse → ilk-3 garantisi (TÜRKÖREN dersi)",
    ],
  },
  {
    versiyon: "V3",
    baslangic: new Date("2026-08-10T17:03:34+03:00"), // 75f8669 — motor V2.1'den V3'e adlandırıldı
    bitis: new Date("2026-08-10T23:31:26+03:00"),
    aciklama: "X1-X7 çapraz-okuma etiketleri eklendi; V3 (takı) ve V4 (aynı jokey) AGF-trend güçlü-sinyal setine dahil edildi; V21 (AGF) iddiası yumuşatıldı.",
    neyiAnalizEdiyor: ["V1-V22 + X1-X7 çapraz-okuma etiketleri"],
    caprazlamalar: [
      "AGF-trend güçlü-sinyal seti: V1, V3 (takı), V4 (aynı jokey), V19, V22",
      "X1-X7 çapraz-okuma (birden fazla V-kodunun birlikte doğrulama/çelişki taraması)",
      "V2.1'in tüm terfi/hiyerarşi kuralları korunur",
    ],
  },
  {
    versiyon: "V3.1",
    baslangic: new Date("2026-08-10T23:31:26+03:00"), // 689e0fb — AGF statik top-3 terfi garantisi
    bitis: null,
    aciklama: "AGF statik (güncel) sıraya dayalı iki yeni kod-garanti kuralı eklendi — CEVATHAN/CANYAMAN vakalarının (AGF top-3 ama sistemde 8.sıra) geriye dönük analiziyle doğrulandı.",
    neyiAnalizEdiyor: ["V1-V22 + X1-X7 (V3 ile aynı kapsam)"],
    caprazlamalar: [
      "AGF statik top-3 (güncel AGF'ye göre) + sistemde >=7.sıra → 4-6 penceresine terfi (n=66 doğrulama: %15.2 galibiyet/%37.9 ilk-3, kontrol grubu %3.9/%13.0)",
      "1.sıra AGF top-3 kümesine sabitlenir — yalnız aday ile eski 1.sıra yer değiştirir, aradaki atlar (değer atları) yerinden oynamaz (n=104 doğrulama: top-3 içi %30.0 vs top-3 dışı %5.9 galibiyet)",
      "AGF trend + ≥2 güçlü V-kodu → ilk-3 kuralı ayrıca test edildi, eşik değiştirilmedi (veri desteklemedi)",
    ],
  },
];

export type EngineVersionSonuc = EngineVersionTanimi & {
  n: number;
  hitTop1Orani: number;
  hitInCouponOrani: number;
};

export async function getVersiyonKarsilastirmasi(): Promise<EngineVersionSonuc[]> {
  const sonuclar: EngineVersionSonuc[] = [];
  for (const v of ENGINE_VERSIONS) {
    const rows = await db.result.findMany({
      where: {
        race: {
          prediction: {
            published: true,
            createdAt: { gte: v.baslangic, ...(v.bitis ? { lt: v.bitis } : {}) },
          },
        },
      },
      select: { hitTop1: true, hitInCoupon: true },
    });
    const n = rows.length;
    const hitTop1 = rows.filter((r) => r.hitTop1).length;
    const hitInCoupon = rows.filter((r) => r.hitInCoupon).length;
    sonuclar.push({
      ...v,
      n,
      hitTop1Orani: n > 0 ? Math.round((1000 * hitTop1) / n) / 10 : 0,
      hitInCouponOrani: n > 0 ? Math.round((1000 * hitInCoupon) / n) / 10 : 0,
    });
  }
  return sonuclar;
}
