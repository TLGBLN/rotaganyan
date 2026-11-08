// RotaGanyan Analiz Motoru (RAN v2) — Sinyal Kütüğü verisi. STATİK, DB'ye dokunmaz —
// V5.46.1'in kendi sinyal-kutugu.service.ts'inden TAMAMEN BAĞIMSIZ (ayrı sistem, bkz.
// proje hafızası project_ran_v2_sade_temiz_2026_11_07). Bu dosyadaki rakamlar 2026-11-08
// tarihli B300 (n=295) + G1/G2/G3 (n=124) yerel önbellek testlerinden — production'a
// BAĞLI DEĞİL, RAN v2 hâlâ izole/salt-okunur bir araştırma motoru.

export type RanV2Pillar = { kod: string; ad: string; aciklama: string; kaynak: string };

export const RAN_V2_PILLARLAR: RanV2Pillar[] = [
  { kod: "acc", ad: "Accurace", kaynak: "v546-1-engine.ts (ACC_CLOSE_RES + ACC_SPEED ortalaması)",
    aciklama: "Bağlam-düzeltilmiş kapanış gücü ve hız artığı. ACC_LATE bilerek hariç — Tempo pillar'ının \"tempo taşıma gücü\" girdisi üzerinden zaten oraya giriyor, çift sayım önlenir. Şartlı 1/27'de SİSTEMATİK OLARAK YOK (atların henüz sektörel zaman geçmişi yok)." },
  { kod: "tempo", ad: "Tempo (Yarış Gidişatı)", kaynak: "pace-analizi.ts (hesaplaYarisGidisati)",
    aciklama: "Saha-geneli tempo senaryosu × atın stil-uyum matrisi. Atın bugünkü yüzeyde geçmişi yoksa değer yarıya küçültülür (null yapılmaz) — \"koşu stilini koru, hız güvenini azalt\"." },
  { kod: "jokey", ad: "Jokey (etkinForm)", kaynak: "jokey-form.actions.ts (getJokeyFormTablosu)",
    aciklama: "Jokeyin son 30 günlük, güvenilirlikle ağırlıklı kazanma formu. V5.46.1'in jokeyOranı/idmJokey alanlarıyla KARIŞTIRILMASIN — tamamen farklı bir hesap." },
  { kod: "pedigri", ad: "Pedigri", kaynak: "externalPedigree (sire/dam/damSire, ırk+yüzey+mesafe-bandı)",
    aciklama: "EN GÜÇLÜ VE EN TUTARLI pillar — Handikap/Üst Sınıf dahil HER kategoride güçlü. Örneklem≥3 hat ağırlıklı ortalama." },
  { kod: "kgs", ad: "KGS (Koşu Aralığı)", kaynak: "Runner.tjkKgs + ırk×bucket kazanma-oranı tablosu",
    aciklama: "Son koşudan bu yana geçen gün sayısının, ırk-bazlı (İngiliz/Arap) bucket kazanma oranına çevrilmesi. Yalnız İngiliz/Arap'ta veri var." },
  { kod: "zeminMesafe", ad: "Zemin+Mesafe Deneyimi", kaynak: "Faz1RunnerV5 (zeminMesafeDeneyim)",
    aciklama: "Atın BUGÜNKÜ (pist, zemin koşulu, mesafe) kombinasyonundaki kanıtlanmış deneyimi. Genel popülasyonda orta-zayıf ama Handikap/Üst Sınıf'ta Pedigri'yle birlikte en iyi ikili." },
];

export type RanV2Kategori = { ad: string; tanim: string; pillarKodlari: string[]; n: number; top1: number; top3: number; not?: string };

export const RAN_V2_KATEGORILER: RanV2Kategori[] = [
  { ad: "Handikap", tanim: "classType \"Handikap\" içerir (TÜM seviyeler, 13-24 birlikte)", pillarKodlari: ["pedigri", "zeminMesafe"], n: 84, top1: 36.1, top3: 51.8,
    not: "Seviye bazlı (14/15/16 ayrı) alt testte HER SEVİYE farklı en-iyi kombinasyon istedi (14: Acc+Pedigri %42.9; 15: Pedigri TEK BAŞINA %46.2/%69.2; 16: Acc+Tempo+Pedigri+KGS %33.3/%70.8, n=21-26/seviye) — henüz kodlanmadı, kullanıcıyla tartışılıyor." },
  { ad: "Üst Sınıf (KV / Grup G1-G3)", tanim: "classType \"KV-\" veya \"G 1/2/3\" içerir", pillarKodlari: ["pedigri", "zeminMesafe"], n: 167, top1: 33.7, top3: 56.4,
    not: "G1/G2/G3 alt kümesinde (n=124) Pedigri TEK BAŞINA (%32.8) bile 5-pillar kombineden (%27.3) iyiydi — zayıf pillar'lar güçlü sinyali sulandırıyor." },
  { ad: "Düşük Deneyim", tanim: "Maiden, Şartlı 1, Şartlı 19, Şartlı 27", pillarKodlari: ["acc", "pedigri", "kgs"], n: 81, top1: 32.9, top3: 51.9,
    not: "Şartlı 1/27 alt kümesinde Accurace SİSTEMATİK OLARAK YOK — motor otomatik olarak Pedigri+KGS'ye düşüyor (null, sıfır değil)." },
  { ad: "Orta Deneyim", tanim: "Şartlı 2, 3, 4, 5", pillarKodlari: ["acc", "tempo", "jokey", "pedigri", "kgs", "zeminMesafe"], n: 74, top1: 36.5, top3: 62.2,
    not: "Tek kategori burada HEPSİ birlikte en iyisi — diğer kategorilerin tersine daraltma ZARARLI." },
  { ad: "Kanıtlanmış / Diğer", tanim: "Şartlı 6-9 ve tanınmayan tipler (örneklem yetersiz)", pillarKodlari: ["acc", "tempo", "jokey", "pedigri", "kgs"], n: 0, top1: 0, top3: 0,
    not: "Brute-force testte n<20 filtresine takıldı — spekülatif alt küme uydurulmadı, güvenli varsayılan (eski sabit 5) kullanılıyor." },
];

export type RanV2AcikMadde = { ad: string; durum: "aday" | "açık-soru"; bulgu: string; kanitSeviyesi: string };

export const RAN_V2_ACIK_MADDELER: RanV2AcikMadde[] = [
  { ad: "Antrenör Oranı", durum: "aday",
    bulgu: "İstanbul K1 Şartlı 1 (08.11.2026) vaka incelemesinde kazananı (BREAK MY HEART) ayırt eden TEK sinyaldi (%16.6, sahada en yüksek) — Pedigri ve Jokey ikisi de kazananı ayırt edemezken.",
    kanitSeviyesi: "n=1 (tek vaka) — RAN v2'ye HENÜZ EKLENMEDİ, B300 ile ayrı doğrulanmalı." },
  { ad: "idmJokey (idman jokeyi uyumu)", durum: "aday",
    bulgu: "Düşük Deneyim kategorisinde zenginleşme 1.29x (kazananda %24.7, kaybedende %19.1) — genel popülasyonda sinyal YOK (0.89x, hafif negatif).",
    kanitSeviyesi: "n=81 (Düşük Deneyim) — sınırda kanıt, henüz eklenmedi." },
  { ad: "AGF/Piyasa Kıyası", durum: "açık-soru",
    bulgu: "RAN v2'nin ~%30-34 Top1'i piyasa/AGF'ye göre GERÇEKTEN üstün mü, henüz AYNI örneklemde ölçülmedi.",
    kanitSeviyesi: "Ölçülmedi." },
];

export const RAN_V2_REDDEDILEN = [
  { ad: "Form Eğimi", neden: "HER kategoride en zayıf pillar (%0-9.5 Top1) — eşit ağırlıkta eklenince genel skoru %29.4'ten %5.9'a düşürdü (5 pillar birlikte test edildiğinde)." },
  { ad: "Galop (idman kalitesi)", neden: "Her kategoride zayıf (%0-15), Handikap'ta özellikle kötü (%4.9)." },
  { ad: "Takı Değişikliği", neden: "RAN v2'de tek başına hiç test edilmedi (V5.46.1'de B-katmanı katsayısı olarak var, ayrı sistem)." },
  { ad: "Zemin Toleransı (Islak/Ağır pist geçmişi)", neden: "Genel popülasyonda zayıf (%0-16); ZeminMesafe Deneyimi onun yerine kullanılıyor." },
];
