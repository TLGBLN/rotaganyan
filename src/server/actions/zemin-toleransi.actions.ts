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
 * 2026-08-23 DÜZELTME: ilk hipotez ("arşiv yalnız sabit-kilolu/Maiden koşularını
 * tutuyor, Handikap gibi değişken-kilolu koşuları hiç almıyor") YANLIŞ çıktı —
 * kontrol edildi, Handikap koşuları arşivde bol miktarda var (Handikap 15: 855,
 * Handikap 16: 611, Handikap 14: 582 kayıt). Eksik atların (DIRAXTER vb.) nedeni hâlâ
 * netleşmedi — muhtemelen kalan ~%0,6'lık kapsam boşluğu ya da o SPESİFİK koşuda TJK'nın
 * kendi sisteminde hiç derece kaydı oluşmaması, genel bir sınıf dışlaması değil.
 *
 * 2026-08-23 — KİLO DÜZELTMESİ: İLK test (TÜM koşuları karıştırarak) r=-0,057 çıkıp
 * "ihmal edilebilir" denmişti — kullanıcı haklı olarak itiraz etti ("kilo önemli, ihmal
 * edilmeyecek"). Koşu TİPİNE göre ayrı test edilince gerçek tablo ortaya çıktı:
 *   - Handikap: r=-0,165 (n=1797) — ağır kilo GERÇEKTEN yavaşlatıyor (~-19mm/sn/kg)
 *   - Maiden/Şartlı: r=-0,062 (n=1184) — daha zayıf ama hâlâ negatif
 *   - KV/Grup/Satış: r=+0,117 (n=667) — TERS yönde (kilo zaten kanıtlanmış kaliteyle
 *     iç içe, ağırlık cezası yeteneği gölgelemiyor)
 * Karıştırılınca zıt yönler birbirini götürüp "önemsiz" gibi görünüyordu (Simpson
 * paradoksu). Artık kilo, koşu tipine göre (Handikap/Diğer) AYRI eğimle düzeltiliyor —
 * her bucket'ın beklenen pace'i o kategorinin ampirik kilo-eğimine göre hesaplanıyor,
 * bir atın göreli performansı bu düzeltilmiş beklentiye göre ölçülüyor.
 *
 * SONUÇ (split-half güvenilirlik testi, düzeltme ÖNCESİ/SONRASI karşılaştırma):
 * r=0,423 (düzeltmesiz) -> r=0,427 (düzeltmeli) — kilo düzeltmesi TABANI daha doğru
 * kalibre ediyor (gerçek bir önyargıyı gideriyor, kullanıcının işaret ettiği gibi) ama
 * sinyalin at-bazlı TUTARLILIĞINI neredeyse hiç değiştirmiyor (bir at genelde benzer
 * kilo taşıdığı için). Yani düzeltme bilimsel olarak doğru ve kalıcı, ama "zemin
 * toleransı gerçek mi" sorusunun cevabını değiştirmiyor — o zaten doğruydu.
 *
 * 2026-08-23 — V5'in mevcut 20 özelliğine eklenip test edildi (arac-sinyal-lab.mjs):
 * beklendiği gibi HER İKİ segmentte de anlamsız (GA sıfırı içeriyor) — çünkü kendi
 * Prediction/Result verimizdeki koşuların neredeyse tamamı zaten "Normal" zeminde,
 * sinyalin devreye girmesi gereken durum (bugünün de Normal-dışı olması) oluşmuyor.
 * Bu, hipotezin çürütülmesi değil — gerçek geçerlilik testi ancak yeterli sayıda
 * Normal-dışı GÜNCEL koşu birikince yapılabilir.
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

type ArsivSatiri = {
  atAdi: string; irk: string; pist: string; mesafe: string; pistDurumu: string;
  derece: string | null; kilo: string | null; cinsAdi: string; tarih: Date | null;
};

// hiz-derecesi.actions.ts'teki ile aynı desen: tüm arşivi (~8000 satır) her istekte
// yeniden çekmek yavaş, modül-seviyesi 6 saatlik TTL'li bellek-içi önbellek kullanılır.
const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: ArsivSatiri[]; zaman: number } | null = null;

async function tumArsiviGetir(): Promise<ArsivSatiri[]> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;
  const veri = await db.tjkDereceKaydi.findMany({
    where: { derece: { not: null } },
    select: { atAdi: true, irk: true, pist: true, mesafe: true, pistDurumu: true, derece: true, kilo: true, cinsAdi: true, tarih: true },
  });
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

const MIN_BUCKET_ORNEKLEM = 5;
const MIN_EGIM_ORNEKLEM = 30; // kategori-bazlı kilo eğimi için asgari örneklem

/** "Handikap"/"Kısa Vade Handikap" -> "handikap", geri kalan her şey -> "diger". */
function kiloKategorisi(cinsAdi: string): "handikap" | "diger" {
  return /handikap/i.test(cinsAdi) ? "handikap" : "diger";
}

function parseKilo(kilo: string | null): number | null {
  if (!kilo) return null;
  const n = parseFloat(kilo.replace(",", "."));
  return isNaN(n) ? null : n;
}

/**
 * Verilen atların, TARİHTEN ÖNCEKİ (leak-free) Normal-dışı koşularındaki, KİLOYA GÖRE
 * DÜZELTİLMİŞ ortalama göreli pace farkını (%) döner — atAdi -> yüzde (pozitif=beklenenden
 * hızlı, negatif=yavaş). Geçmişte hiç Normal-dışı koşusu olmayan/eşleşmeyen atlar için 0
 * döner (nötr, "veri yok").
 */
export async function hesaplaZeminToleransiDetayMap(
  atIsimleri: string[],
  cutoffTarihi: Date
): Promise<Map<string, { deger: number; observed: boolean; ornekSayisi: number }>> {
  const arsiv = await tumArsiviGetir();
  const atSeti = new Set(atIsimleri);

  // 1) Kategori-bazlı (Handikap/Diğer) kilo-pace eğimi — TÜM Normal koşullar, TARİHTEN
  // ÖNCE, bucket sabit etkisini çıkarmak için her bucket kendi ortalamasına göre merkezlenir.
  type EgimToplama = { sxy: number; sxx: number; sayi: number };
  const egimToplam = new Map<"handikap" | "diger", EgimToplama>();
  {
    const bucketHam = new Map<string, { pace: number; kilo: number; kategori: "handikap" | "diger" }[]>();
    for (const s of arsiv) {
      if (s.pistDurumu !== "Normal") continue;
      if (s.tarih && s.tarih >= cutoffTarihi) continue; // leak-free
      const sn = dereceyeSaniye(s.derece);
      const metre = mesafeyeMetre(s.mesafe);
      const kilo = parseKilo(s.kilo);
      if (!sn || !metre || kilo == null || sn <= 0) continue;
      const bucket = `${s.irk}|${s.pist}|${metre}`;
      const arr = bucketHam.get(bucket) ?? [];
      arr.push({ pace: metre / sn, kilo, kategori: kiloKategorisi(s.cinsAdi) });
      bucketHam.set(bucket, arr);
    }
    for (const [, arr] of bucketHam.entries()) {
      if (arr.length < 10) continue;
      const ortKilo = arr.reduce((s, a) => s + a.kilo, 0) / arr.length;
      const ortPace = arr.reduce((s, a) => s + a.pace, 0) / arr.length;
      for (const a of arr) {
        const e = egimToplam.get(a.kategori) ?? { sxy: 0, sxx: 0, sayi: 0 };
        const dx = a.kilo - ortKilo, dy = a.pace - ortPace;
        e.sxy += dx * dy; e.sxx += dx * dx; e.sayi++;
        egimToplam.set(a.kategori, e);
      }
    }
  }
  const kiloEgimi = new Map<"handikap" | "diger", number>();
  for (const [kategori, e] of egimToplam.entries()) {
    if (e.sayi >= MIN_EGIM_ORNEKLEM && e.sxx > 0) kiloEgimi.set(kategori, e.sxy / e.sxx);
  }

  // 2) Popülasyon ortalama pace VE ortalama kilo (yalnız Normal, TARİHTEN ÖNCE) —
  // bucket = irk|pist|mesafe|kategori (kilo eğimi kategoriye göre farklı olduğu için ayrı).
  const bucketToplam = new Map<string, { paceToplam: number; kiloToplam: number; sayi: number }>();
  for (const s of arsiv) {
    if (s.pistDurumu !== "Normal") continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const sn = dereceyeSaniye(s.derece);
    const metre = mesafeyeMetre(s.mesafe);
    const kilo = parseKilo(s.kilo);
    if (!sn || !metre || sn <= 0) continue;
    const bucket = `${s.irk}|${s.pist}|${metre}|${kiloKategorisi(s.cinsAdi)}`;
    const e = bucketToplam.get(bucket) ?? { paceToplam: 0, kiloToplam: 0, sayi: 0 };
    e.paceToplam += metre / sn;
    e.kiloToplam += kilo ?? 0;
    e.sayi++;
    bucketToplam.set(bucket, e);
  }
  const bucketOrt = new Map<string, { pace: number; kilo: number }>();
  for (const [k, v] of bucketToplam.entries()) if (v.sayi >= MIN_BUCKET_ORNEKLEM) bucketOrt.set(k, { pace: v.paceToplam / v.sayi, kilo: v.kiloToplam / v.sayi });

  // 3) Her atın Normal-dışı, TARİHTEN ÖNCEKİ koşularının kilo-düzeltilmiş göreli pace ortalaması
  const atToplam = new Map<string, { toplam: number; sayi: number }>();
  for (const s of arsiv) {
    if (!atSeti.has(s.atAdi)) continue;
    if (s.pistDurumu === "Normal") continue;
    if (s.tarih && s.tarih >= cutoffTarihi) continue;
    const sn = dereceyeSaniye(s.derece);
    const metre = mesafeyeMetre(s.mesafe);
    const kilo = parseKilo(s.kilo);
    if (!sn || !metre || sn <= 0) continue;
    const kategori = kiloKategorisi(s.cinsAdi);
    const bucket = `${s.irk}|${s.pist}|${metre}|${kategori}`;
    const taban = bucketOrt.get(bucket);
    if (taban == null) continue;

    // Bu atın taşıdığı kiloya göre BEKLENEN pace — kategori eğimi biliniyorsa uygula,
    // bilinmiyorsa (örneklem azsa) düzeltmesiz taban kullanılır.
    const egim = kiloEgimi.get(kategori);
    const beklenenPace = egim != null && kilo != null ? taban.pace + egim * (kilo - taban.kilo) : taban.pace;

    const goreli = ((metre / sn - beklenenPace) / beklenenPace) * 100;
    const e = atToplam.get(s.atAdi) ?? { toplam: 0, sayi: 0 };
    e.toplam += goreli;
    e.sayi++;
    atToplam.set(s.atAdi, e);
  }

  const sonuc = new Map<string, { deger: number; observed: boolean; ornekSayisi: number }>();
  for (const ad of atIsimleri) {
    const e = atToplam.get(ad);
    sonuc.set(ad, {
      deger: e ? e.toplam / e.sayi : 0,
      observed: e != null && e.sayi > 0,
      ornekSayisi: e?.sayi ?? 0,
    });
  }
  return sonuc;
}

/** FAZ 2A (entegrasyon) öncesi davranışla BİREBİR UYUMLULUK — eski çağrıların (varsa)
 *  kırılmaması için hesaplaZeminToleransiDetayMap'in ince sarmalayıcısı. Davranış
 *  DEĞİŞMEDİ, yalnız observed/ornekSayisi bilgisini isteyenler Detay versiyonunu kullanır. */
export async function hesaplaZeminToleransiMap(
  atIsimleri: string[],
  cutoffTarihi: Date
): Promise<Map<string, number>> {
  const detay = await hesaplaZeminToleransiDetayMap(atIsimleri, cutoffTarihi);
  return new Map([...detay.entries()].map(([ad, d]) => [ad, d.deger]));
}
