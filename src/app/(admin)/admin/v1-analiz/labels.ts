// ROTAGANYAN ANALİZ MOTORU v1.0 — GÖRÜNTÜLEME KATMANI ETİKETLERİ (kullanıcı talimatı,
// 2026-10-21: "yalnız görüntüleme gruplaması değişsin — ham sinyal, katsayı, toplam skor
// veya at sıralaması değiştirilmemeli"). Bu dosya HİÇBİR hesaplama İÇERMEZ, yalnız
// unified-family-engine.ts'in ürettiği HAM aile/kod etiketlerini (GEN_PEDIGRI, HIZ, SINIF,
// TMP, TEMPO_STYLE, JOKEY, JOK, ...) kullanıcıya gösterilecek 10 STANDART aileye ve
// Türkçe sinyal adlarına eşler.

/** Motorun KENDİ ürettiği family string'i -> standart 10 aileden biri (veya INTERACTION). */
export const FAMILY_TO_STANDARD: Record<string, string> = {
  GEN_PEDIGRI: "GENETIK",
  HIZ: "YETENEK", SINIF: "YETENEK",
  FORM: "FORM",
  PIST_MESAFE_ZEMIN: "PIST_MESAFE",
  TMP: "TEMPO", TEMPO_STYLE: "TEMPO",
  JOKEY: "JOKEY", JOK: "JOKEY",
  ANT: "ANTRENOR",
  KILO: "KILO",
  DAV: "TAKI_DAVRANIS",
  RAK: "RAKIP",
  INTERACTION: "INTERACTION",
};

/** Standart 10 aile (+ INTERACTION, 11. aile SAYILMAZ — ayrı gösterilir) — sabit sıra. */
export const STANDARD_FAMILY_ORDER = [
  "GENETIK", "YETENEK", "FORM", "PIST_MESAFE", "TEMPO",
  "JOKEY", "ANTRENOR", "KILO", "TAKI_DAVRANIS", "RAKIP",
] as const;

export const STANDARD_FAMILY_LABEL: Record<string, string> = {
  GENETIK: "Genetik ve Pedigri",
  YETENEK: "Yetenek, Hız ve Sınıf",
  FORM: "Güncel Form ve Kondisyon",
  PIST_MESAFE: "Pist, Mesafe ve Zemin",
  TEMPO: "Yarış Stili, Tempo ve Kulvar",
  JOKEY: "Jokey Performansı",
  ANTRENOR: "Antrenör Performansı",
  KILO: "Kilo ve Dayanıklılık",
  TAKI_DAVRANIS: "Takı ve Yarış Davranışı",
  RAKIP: "Rakip Gücü ve Göreli Üstünlük",
  INTERACTION: "Aileler Arası İlişkiler",
};

/** Teknik kod -> kısa Türkçe açıklama. Yalnız GÖSTERİM amaçlı — formülü/katsayıyı taşımaz. */
export const SIGNAL_LABEL_TR: Record<string, string> = {
  FORM_01: "Güncel Form (zaman ağırlıklı)",
  FORM_02: "Form Eğilimi",
  FORM_03: "Yarış Arası Süre",
  HIZ_01: "Hız Derecesi (popülasyona göre)",
  SINIF_01: "Yarış Sınıfı Gücü",
  PMZ_01: "Pist Türü Uygunluğu",
  PMZ_02: "Mesafe Uygunluğu",
  FORM_x_ZEMIN: "Form × Zemin Etkileşimi",
  TEMPO_01: "Liderlik Eğilimi",
  TEMPO_02: "Rakip Tempo Baskısı",
  TEMPO_03: "Tek Liderlik Göstergesi",
  TEMPO_04: "Tempo-Stil Uyumu",
  KULVAR_01_HAM: "Kulvar Konumu",
  JOKEY_01: "Jokey Son 30 Gün Formu",
  JOKEY_02: "Jokey Uzun Dönem Formu",
  JOKEY_03: "At-Jokey Uyumu",
  JOKEY_04: "Jokey-Stil Uyumu",
  JOKEY_TREND30: "Jokey Performans Trendi",
  KILO_01: "Rakiplere Göre Kilo",
  KILO_02: "Geçmişe Göre Kilo Değişimi",
  KILO_03: "Kilo × Mesafe Etkileşimi",
  KILO_04: "Kilo × Handikap Etkileşimi",
  GEN_SIRE_01: "Baba Hattı Başarı Oranı",
  GEN_DAM_01: "Anne Hattı Başarı Oranı",
  GEN_DAMSIRE_01: "Anne Babası Hattı Başarı Oranı",
  GEN_SIRE_PMZ_01: "Baba Hattı × Pist Uyumu",
  ANT_TREND30: "Antrenör Performans Trendi",
  DAV_TAKI_EKLENDI: "Takı Eklendi",
  DAV_TAKI_CIKARILDI: "Takı Çıkarıldı",
  RAK_H2H_01: "Doğrudan Karşılaşma Üstünlüğü",
  RAK_GAP_01: "Rakiplere Göre Güç Farkı",
  IDMAN_01: "Galop Performansı",
  GEN_PMZ_YET_01: "Baba Hattı × Pist × Sınıf",
  YET_PMZ_01: "Hız × Pist Uyumu",
  FRM_GEN_01: "Form Eğilimi × Baba Hattı",
  FRM_IDMAN_DINLENME_01: "Form × Galop × Dinlenme",
  JOK_FRM_TMP_01: "Jokey Trendi × Form × Tempo",
  ANT_FRM_01: "Antrenör Trendi × Form Eğilimi",
  TMP_DAV_01: "Tempo × Takı Değişikliği",
  FRM_GALOP_ANT_01: "Form × Galop × Antrenör",
  YET_PMZ_RAK_01: "Hız × Pist × Rakip Üstünlüğü",
  KIL_PMZ_YET_01: "Kilo × Pist × Hız",
  RAK_YET_TMP_01: "Rakip Üstünlüğü × Hız × Tempo",
  TMP_KULVAR_01: "Tempo × Kulvar",
};

export function signalLabel(code: string): string {
  return SIGNAL_LABEL_TR[code] ?? code;
}

/** Kullanıcı talimatı: "nadir ikili özelliklerin ve çarpım ilişkilerinin çok yüksek
 *  standartlaştırılmış değerler üretmesi halinde bilgilendirici uyarı göster" — eşik
 *  burada AÇIKÇA belgelenir, yalnız UI'da kullanılır, hiçbir hesaplamayı etkilemez. */
export const EXTREME_Z_THRESHOLD = 3;
