import { db } from "@/lib/db";
import { ENGINE_VERSIONS, type EngineVersionTanimi } from "@/lib/methodology/engine-versions.data";
export { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
export type { EngineVersionTanimi } from "@/lib/methodology/engine-versions.data";

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
 *
 * 2026-08-27: ENGINE_VERSIONS'ın kendisi artık @/lib/methodology/engine-versions.data'da
 * yaşıyor (client-safe, db importu yok) — burada yalnız re-export ediliyor, aşağıdaki
 * getVersiyonKarsilastirmasi hâlâ burada çünkü db'ye ihtiyacı var.
 */

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
