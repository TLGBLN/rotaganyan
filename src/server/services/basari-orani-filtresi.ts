/**
 * 2026-08-17 kullanıcı kararı: Şanlıurfa, Elazığ, Diyarbakır hipodromları düşük kalite —
 * at performansı bu pistlerde öngörülemiyor, sonuçlar modelin gerçek başarısını gürültüyle
 * bozuyor. Bu 3 hipodromdaki koşular veritabanında/analizlerde AYNEN kalır (silinmez,
 * yayından kaldırılmaz) — yalnız "ne kadar iyiyiz" ölçen başarı oranı hesaplamalarından
 * (galibiyet%, kupon-isabet%, motor versiyon karşılaştırması) hariç tutulur.
 *
 * KARIŞTIRILMAMASI GEREKEN AYRI KAVRAM: `GERCEK_OLMAYAN_HIPODROM_SLUGLARI`
 * (admin.service.ts) Karma/Perak Malezya mükerrer-kopya koşularını eler (veri bütünlüğü
 * sorunu — çift sayım). Bu dosya ise GERÇEK ama gürültülü koşuları başarı ölçümünden
 * eler (metodoloji kararı — veri bütünlüğü sorunu değil).
 */
export const DUSUK_KALITE_HIPODROM_SLUGLARI = ["sanliurfa", "elazig", "diyarbakir"];

export const BASARI_ORANI_HIPODROM_FILTRESI = { slug: { notIn: DUSUK_KALITE_HIPODROM_SLUGLARI } };
