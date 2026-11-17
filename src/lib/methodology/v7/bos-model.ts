// V7 SIFIRDAN MOTOR — BAŞLANGIÇ (sinyalsiz) MODEL. SAF, DB'siz, canlı koddan HİÇBİR ŞEY import etmez.
// Sinyalsiz motor atları ayıramaz: her atın olasılığı 1/N. Bu çıktı HİÇBİR ZAMAN kullanıcıya "tahmin" diye sunulmaz (yayınlanabilir = false); yalnız doğrulanmış özellik kümesi
// (ozellik-kabul.ts protokolünden geçmiş) varken yayınlanabilir hale gelebilir.
export type V7Durum = { yayinlanabilir: boolean; neden: string; kabulEdilenOzellikSayisi: number };
/** Her ata eşit olasılık. */
export function bosModelOlasiliklari(n: number): number[] { if (!Number.isInteger(n) || n < 1) return []; return Array.from({ length: n }, () => 1 / n); }
/** Yayınlanabilirlik: yalnız en az 1 kabul edilmiş özellik VE nihai (dokunulmamış) dönemde doğrulama varsa. Sinyalsiz motor asla yayınlanmaz. */
export function v7Durum(kabulEdilenOzellikSayisi: number, nihaiDogrulamaGecti: boolean): V7Durum {
  if (kabulEdilenOzellikSayisi <= 0) return { yayinlanabilir: false, neden: "Sinyalsiz motor atları ayıramaz (1/N); tahmin olarak sunulmaz.", kabulEdilenOzellikSayisi };
  if (!nihaiDogrulamaGecti) return { yayinlanabilir: false, neden: "Özellikler seçim döneminde kabul edildi ama nihai (dokunulmamış) dönemde doğrulanmadı.", kabulEdilenOzellikSayisi };
  return { yayinlanabilir: true, neden: "Kabul edilmiş özellikler nihai dönemde doğrulandı.", kabulEdilenOzellikSayisi };
}
