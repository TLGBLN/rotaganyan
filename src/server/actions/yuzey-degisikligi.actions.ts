"use server";

/**
 * "Yüzey değişikliği" — bir at bugüne kadar hep TEK bir pist tipinde (çim/kum/sentetik)
 * koşmuşsa ve bugünkü koşusu FARKLI bir pist tipindeyse (örn. hep çim koşmuş, bugün kum) —
 * kullanıcı hipotezi (2026-08-30): bu, atın yüzey uyumunun hiç test edilmediği, riskli/
 * bilinmeyen bir durum. TjkDereceKaydi arşivi (zemin-toleransi.actions.ts ile AYNI kaynak,
 * kullanıcı tarafından /admin/derece-istatistikleri üzerinden işaret edildi) zaten Pist
 * alanını satır satır tutuyor — ayrı bir veri toplama gerekmiyor.
 *
 * HENÜZ CANLI SKORA EKLENMEDİ — yalnız V6 Aşama 3 (challenger) altyapısıyla sessizce
 * gölge-test ediliyor (bkz. v6-challenger-registry.ts, "v6-yuzey-degisikligi"). n≥250-300
 * sonuçlanmış gölge-koşu birikip B=500 ile gerçek katkısı kanıtlanmadan A/B katmanına
 * ASLA eklenmeyecek — bu oturumun temel disiplini (bkz. sireOrani/pedigri/budama dersleri).
 *
 * TjkDereceKaydi'de tjkAtId YOK, yalnız atAdi (isim) var — zeminToleransi/sireOrani ile
 * AYNI isim-eşleştirme risk profili (kabul edilebilir, oralarda da aynı yöntem kullanılıyor).
 */
import { db } from "@/lib/db";

type ArsivSatiri = { atAdi: string; pist: string; tarih: Date | null };

const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: ArsivSatiri[]; zaman: number } | null = null;

async function tumArsiviGetir(): Promise<ArsivSatiri[]> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;
  const veri = await db.tjkDereceKaydi.findMany({ select: { atAdi: true, pist: true, tarih: true } });
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

/**
 * Verilen atların, TARİHTEN ÖNCE (leak-free) koştuğu TÜM pist tiplerinin kümesini döner.
 * Geçmişi olmayan/eşleşmeyen atlar için boş küme (çağıran taraf bunu "veri yok" — DEBUT
 * DEĞİL, sadece bilinmiyor — sayıp sinyali uygulamaz, "ilk kez pist değişikliği" iddiası
 * ancak GERÇEK geçmişi bilinen bir at için anlamlı).
 */
export async function hesaplaGecmisPistleriMap(atIsimleri: string[], cutoffTarihi: Date): Promise<Map<string, Set<string>>> {
  const arsiv = await tumArsiviGetir();
  const atSeti = new Set(atIsimleri);
  const sonuc = new Map<string, Set<string>>();
  for (const ad of atIsimleri) sonuc.set(ad, new Set());
  for (const s of arsiv) {
    if (!atSeti.has(s.atAdi)) continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue; // leak-free
    sonuc.get(s.atAdi)!.add(s.pist);
  }
  return sonuc;
}
