// YENİ MOTOR — ONAYLI SİNYAL KAYDI. 2026-11-17 KULLANICI KARARI (kesin):
//   • (2026-11-17) Yeni motorun başlangıç sinyal kümesi BOŞTU; 2026-11-18 KULLANICI KARARIYLA beş aile eklendi (aşağıda).
//   • Sinyali YALNIZ KULLANICI belirler: tanımını, hesaplama yöntemini ve modele eklenmesini kullanıcı açıkça onaylar. Onay olmadan tek bir sinyal bile eklenmez.
//   • Otomatik sinyal geliştirme, otomatik seçim (backward/forward), katsayı öğrenimi, sinyal önerisi ve model eğitimi YASAKTIR.
//   • Eski (17/24 sinyalli) modellerden hiçbir özellik/katsayı bu motora taşınmaz.
//   • Bu dosyada model eğitimi, ağırlık, olasılık hesabı YOKTUR; yalnız "onaylı sinyal kaydı" ve doğrulaması vardır.
export type SinyalOnayi = { veren: "kullanici"; tarih: string; referans: string };
export type OnayliSinyal = { kod: string; tanim: string; hesaplamaYontemi: string; onay: SinyalOnayi };
export type KayitDogrulama = { gecerli: boolean; hatalar: string[] };

/** YENİ MOTORUN SİNYAL LİSTESİ — 2026-11-18 KULLANICI KARARIYLA beş aile (altı bileşen). SON6 YOKTUR (kullanıcı kararı). AGF sinyal değil, ayrı referans katmanıdır. Değişiklik yalnız kullanıcı onayıyla. */
export const SINYAL_KAYDI: readonly OnayliSinyal[] = [
  { kod: "ACC_HIZ", tanim: "Accurace tabanlı hız sinyali: atın son Accurace yarışlarındaki bağlam-düzeltilmiş hız (aynı ırk+zemin+hipodrom+mesafe referansında).", hesaplamaYontemi: "yeni-motor/adaylar/accurace-aday.ts (accBilesenleri.accHiz); yalnız tarih < yarış günü; dondurulmuş tanım.", onay: { veren: "kullanici", tarih: "2026-11-18", referans: "Kullanıcı kararı 2026-11-18: 'Beş sinyal ailesini RAN motoruna entegre edelim … Aktifleştirilecek' (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU Y+T; SON6 geri gelmeyecek)" } },
  { kod: "J_SEVIYE", tanim: "Jokey seviyesi: jokeyin yarış öncesi, beklenen kazanma olasılığına göre düzeltilmiş geçmiş performansı (pRef).", hesaplamaYontemi: "yeni-motor/adaylar/jokey-aday.ts (jokeyBilesenleri.seviye.pRef); yalnız tarih < yarış günü.", onay: { veren: "kullanici", tarih: "2026-11-18", referans: "Kullanıcı kararı 2026-11-18: 'Beş sinyal ailesini RAN motoruna entegre edelim … Aktifleştirilecek' (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU Y+T; SON6 geri gelmeyecek)" } },
  { kod: "GALOP_KAPASITE", tanim: "Galop kapasitesi: atın son koşusundan sonraki galoplarının hız, kapanış ve efor yüzdeliklerinin yarış-içi ortalaması.", hesaplamaYontemi: "yeni-motor/adaylar/galop-aday.ts (galopBilesenleri hiz/kapanis/efor → yarış-içi yüzdelik ortalaması); yalnız tarih < yarış günü.", onay: { veren: "kullanici", tarih: "2026-11-18", referans: "Kullanıcı kararı 2026-11-18: 'Beş sinyal ailesini RAN motoruna entegre edelim … Aktifleştirilecek' (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU Y+T; SON6 geri gelmeyecek)" } },
  { kod: "H2H_NET", tanim: "Karşılaşma net skoru: bugünkü rakiplerle geçmiş ortak yarışlardaki sıralama üstünlüğü (aynı yüzey, oransal mesafe, yarı ömür 180 gün, λ=3).", hesaplamaYontemi: "yeni-motor/adaylar/h2h-aday.ts (h2hNet, H_180_3); yalnız tarih < yarış günü.", onay: { veren: "kullanici", tarih: "2026-11-18", referans: "Kullanıcı kararı 2026-11-18: 'Beş sinyal ailesini RAN motoruna entegre edelim … Aktifleştirilecek' (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU Y+T; SON6 geri gelmeyecek)" } },
  { kod: "SON_YARIS_SONUCU", tanim: "Son yarış sonucu: Y_son (son yarışta birinci = 1) ve T_son (son yarışta ikinci veya üçüncü = 1); ikisi birlikte tek aile. Bilinmiyorsa NULL.", hesaplamaYontemi: "TJK geçmiş önbelleği finishPos (hedef günden önceki en son yarış); yalnız tarih < yarış günü.", onay: { veren: "kullanici", tarih: "2026-11-18", referans: "Kullanıcı kararı 2026-11-18: 'Beş sinyal ailesini RAN motoruna entegre edelim … Aktifleştirilecek' (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU Y+T; SON6 geri gelmeyecek)" } },
];

export const YENI_MOTOR_KURALLARI = {
  sinyalSayisi: 5,
  sinyalListesi: "kullanici-onayli-bes-aile",
  sinyalSecmeYetkisi: "kullanici",
  otomatikSinyalGelistirme: false,
  eskiSinyalTasima: false,
  modelEgitimi: "dondurulmus-katsayi", // katsayılar kullanıcı talimatıyla tek seferde eğitildi ve DONDURULDU (ran-f6-katsayilar.ts); otomatik yeniden eğitim YOK
  son6: false,
  agfModeldeSinyal: false,
  yayinlanabilir: false, // yalnız admin analiz ekranında gösterilir; banko/kupon kararlarına BAĞLI DEĞİL; kullanıcıya tahmin diye sunulmaz
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
