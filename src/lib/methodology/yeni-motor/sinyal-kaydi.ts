// YENİ MOTOR — ONAYLI SİNYAL KAYDI. 2026-11-17 KULLANICI KARARI (kesin):
//   • Yeni motorun başlangıç sinyal kümesi BOŞTUR (sinyal sayısı 0).
//   • Sinyali YALNIZ KULLANICI belirler: tanımını, hesaplama yöntemini ve modele eklenmesini kullanıcı açıkça onaylar. Onay olmadan tek bir sinyal bile eklenmez.
//   • Otomatik sinyal geliştirme, otomatik seçim (backward/forward), katsayı öğrenimi, sinyal önerisi ve model eğitimi YASAKTIR.
//   • Eski (17/24 sinyalli) modellerden hiçbir özellik/katsayı bu motora taşınmaz.
//   • Bu dosyada model eğitimi, ağırlık, olasılık hesabı YOKTUR; yalnız "onaylı sinyal kaydı" ve doğrulaması vardır.
export type SinyalOnayi = { veren: "kullanici"; tarih: string; referans: string };
export type OnayliSinyal = { kod: string; tanim: string; hesaplamaYontemi: string; onay: SinyalOnayi };
export type KayitDogrulama = { gecerli: boolean; hatalar: string[] };

/** YENİ MOTORUN SİNYAL LİSTESİ — BOŞ. Kullanıcı onayı olmadan DEĞİŞTİRİLMEZ. */
export const SINYAL_KAYDI: readonly OnayliSinyal[] = [];

export const YENI_MOTOR_KURALLARI = {
  sinyalSayisi: 0,
  sinyalListesi: "bos",
  sinyalSecmeYetkisi: "kullanici",
  otomatikSinyalGelistirme: false,
  eskiSinyalTasima: false,
  modelEgitimi: false,
  yayinlanabilir: false, // sinyalsiz motor atları ayıramaz; kullanıcıya tahmin diye sunulmaz
} as const;

/** Bir kaydın onay koşullarını doğrular: her sinyalin tanımı, hesaplama yöntemi ve KULLANICI onayı (veren=kullanici, tarih, referans) bulunmalı. */
export function sinyalKaydiDogrula(kayit: readonly unknown[]): KayitDogrulama {
  const hatalar: string[] = []; const gorulen = new Set<string>();
  kayit.forEach((k, i) => {
    const s = k as Partial<OnayliSinyal> | null; const ad = "kayıt " + i + (s?.kod ? " (" + s.kod + ")" : "");
    if (!s || typeof s !== "object") { hatalar.push(ad + ": geçersiz"); return; }
    if (!s.kod || !String(s.kod).trim()) hatalar.push(ad + ": sinyal kodu yok"); else if (gorulen.has(s.kod)) hatalar.push(ad + ": kod tekrar"); else gorulen.add(s.kod);
    if (!s.tanim || !String(s.tanim).trim()) hatalar.push(ad + ": sinyal tanımı yok");
    if (!s.hesaplamaYontemi || !String(s.hesaplamaYontemi).trim()) hatalar.push(ad + ": hesaplama yöntemi yok");
    if (!s.onay || s.onay.veren !== "kullanici" || !s.onay.tarih || !s.onay.referans) hatalar.push(ad + ": KULLANICI ONAYI yok (veren=kullanici, tarih, referans zorunlu)");
  });
  return { gecerli: hatalar.length === 0, hatalar };
}
