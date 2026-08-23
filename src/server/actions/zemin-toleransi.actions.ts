"use server";

/**
 * "Zemin toleransı" — bir atın Normal-dışı (Islak/Sulu/Nemli/Yumuşak/Ağır) pist
 * koşullarındaki, popülasyona göre GÖRELİ hızının, kendi geçmiş Normal-dışı koşularına
 * göre ortalaması. 2026-08-23 kullanıcı hipotezi: kış geldiğinde gerçek yağmurlu/ıslak
 * pist koşulları oluşacak, atların bu tip pistlerdeki performansı gerçek bir sinyal olabilir.
 *
 * DOĞRULAMA (2026-08-23, TjkDereceKaydi arşivinde, split-half güvenilirlik testi):
 * bir atın İLK Normal-dışı koşusundaki göreli performansı ile SONRAKİ Normal-dışı
 * koşusundaki göreli performansı arasında r=0.467 (n=286 at) korelasyon bulundu — yani
 * "zemin toleransı" GERÇEKTEN at-bazlı, tekrarlanabilir bir özellik (gürültü değil).
 * Popülasyon genelinde ortalama etki küçük (%0.46 daha yavaş) ama BİREYSEL farklılık
 * (bazı atlar ıslak pistte nispeten öne çıkıyor) asıl değerli olan kısım.
 *
 * HENÜZ V5 MODELİNE EKLENMEDİ — canlı Prediction/Result verimiz neredeyse tamamen
 * "Normal" koşullar altında (yaz) olduğu için gerçek geçerlilik testi (bu sinyal V5'in
 * gerçek tahmin doğruluğunu artırıyor mu) ancak kışın ilk yağmurlu koşular kendi
 * verimizde birikince yapılabilir. Bu dosya yalnız HESAPLAMA MANTIĞINI hazır tutar.
 *
 * TjkDereceKaydi'de tjkAtId YOK, yalnız atAdi (isim) var — sireOrani/pistUzmani gibi
 * kodun diğer yerlerindeki isim-eşleştirme deseniyle aynı risk profili (kabul edilebilir).
 *
 * 2026-08-23 kullanıcı sorusu — İSİM EŞLEŞME KAPSAMI: 500 rastgele Runner ismi test
 * edildi, %70,2'si TjkDereceKaydi'de birebir bulundu (büyük/küçük harf farkı sıfır —
 * yazım sorunu yok). Eşleşmeyen örnekler (DIRAXTER, ATAERİ, FORLORN, KOCAHANIM...) tek
 * tek incelendi: bunlar bizim veritabanımızda GERÇEK, tjkAtId'si olan, düzenli koşan
 * atlar — sayfa-hatası/ağ sorunu da DEĞİL (retry mantığı eklenip hata oranı %26'dan
 * %0,6'ya düşürüldükten SONRA bile bu atlar hâlâ arşivde yok). Sonuç: TJK'nın bu arşivi
 * muhtemelen yalnız resmi bir "derece" (bitiş süresi) kaydedilmiş koşuları tutuyor —
 * bazı koşularda derece kaydı hiç oluşmamış olabilir (yapısal bir kaynak sınırı, bizim
 * tarafımızdaki bir hata değil). Eşleşmeyen ~%30 için bu fonksiyon SESSİZCE 0 (nötr)
 * döner — hata vermez ama bu atlar için sinyal fiilen "veri yok" demektir.
 *
 * 2026-08-23 kullanıcı notu — MEVSİM ŞARTI YOK: yağmur/ıslak pist yalnız kışa özgü
 * değil, yazın da olabilir. sync-derece-ist cron'u (vercel.json, her gece 23:00) zaten
 * mevsimden bağımsız her gün çalışıyor — "kışı bekleme" yalnız yeterli ÖRNEKLEM birikmesi
 * beklentisiydi, veri toplama zaten sürekli/koşulsuz devam ediyor.
 */
import { db } from "@/lib/db";

function dereceyeSaniye(t: string | null): number | null {
  if (!t) return null;
  const parts = t.trim().split(".");
  if (parts.length === 3) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseInt(parts[2], 10) / 100;
  if (parts.length === 2) return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 100;
  return null;
}

function mesafeyeMetre(m: string): number {
  return parseInt(m.replace(/\./g, ""), 10);
}

type ArsivSatiri = { atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string; derece: string | null; tarih: Date | null };

// hiz-derecesi.actions.ts'teki ile aynı desen: tüm arşivi (~8000 satır) her istekte
// yeniden çekmek yavaş, modül-seviyesi 6 saatlik TTL'li bellek-içi önbellek kullanılır.
const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: ArsivSatiri[]; zaman: number } | null = null;

async function tumArsiviGetir(): Promise<ArsivSatiri[]> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;
  const veri = await db.tjkDereceKaydi.findMany({
    where: { derece: { not: null } },
    select: { atAdi: true, irk: true, pist: true, mesafe: true, pistDurumu: true, derece: true, tarih: true },
  });
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

const MIN_BUCKET_ORNEKLEM = 5;

/**
 * Verilen atların, TARİHTEN ÖNCEKİ (leak-free) Normal-dışı koşularındaki ortalama göreli
 * pace farkını (%) döner — atAdi -> yüzde (pozitif=popülasyondan hızlı, negatif=yavaş).
 * Geçmişte hiç Normal-dışı koşusu olmayan/eşleşmeyen atlar için 0 döner (nötr, "veri yok").
 */
export async function hesaplaZeminToleransiMap(atIsimleri: string[], cutoffTarihi: Date): Promise<Map<string, number>> {
  const arsiv = await tumArsiviGetir();
  const atSeti = new Set(atIsimleri);

  // Popülasyon ortalama pace (yalnız Normal koşullar, TARİHTEN ÖNCE) — bucket = irk|pist|mesafe
  const bucketToplam = new Map<string, { toplam: number; sayi: number }>();
  for (const s of arsiv) {
    if (s.pistDurumu !== "Normal") continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue; // leak-free
    const sn = dereceyeSaniye(s.derece);
    const metre = mesafeyeMetre(s.mesafe);
    if (!sn || !metre || sn <= 0) continue;
    const bucket = `${s.irk}|${s.pist}|${metre}`;
    const e = bucketToplam.get(bucket) ?? { toplam: 0, sayi: 0 };
    e.toplam += metre / sn;
    e.sayi++;
    bucketToplam.set(bucket, e);
  }
  const bucketOrt = new Map<string, number>();
  for (const [k, v] of bucketToplam.entries()) if (v.sayi >= MIN_BUCKET_ORNEKLEM) bucketOrt.set(k, v.toplam / v.sayi);

  // Her atın Normal-dışı, TARİHTEN ÖNCEKİ koşularının göreli pace ortalaması
  const atToplam = new Map<string, { toplam: number; sayi: number }>();
  for (const s of arsiv) {
    if (!atSeti.has(s.atAdi)) continue;
    if (s.pistDurumu === "Normal") continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue; // leak-free
    const sn = dereceyeSaniye(s.derece);
    const metre = mesafeyeMetre(s.mesafe);
    if (!sn || !metre || sn <= 0) continue;
    const bucket = `${s.irk}|${s.pist}|${metre}`;
    const ort = bucketOrt.get(bucket);
    if (ort == null) continue;
    const goreli = ((metre / sn - ort) / ort) * 100;
    const e = atToplam.get(s.atAdi) ?? { toplam: 0, sayi: 0 };
    e.toplam += goreli;
    e.sayi++;
    atToplam.set(s.atAdi, e);
  }

  const sonuc = new Map<string, number>();
  for (const ad of atIsimleri) {
    const e = atToplam.get(ad);
    sonuc.set(ad, e ? e.toplam / e.sayi : 0);
  }
  return sonuc;
}
