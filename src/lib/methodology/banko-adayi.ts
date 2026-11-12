// BANKO ADAYI — tip-bazlı KALİBRE olasılığa göre (2026-11-12 kullanıcı kararı: "sistemin hangi
// koşu tipi için olursa olsun banko adayı dediği at gerçekten bu adaylığı hak etmeli").
//
// Gerekçe: Saf Model'in ham olasılığı tipe göre ÇOK farklı güvenilir — 827 yarışlık 5 katlı zaman
// CV'sinde Handikap'ta model %40-50 derken gerçek isabet ~%25 (3 atlık %50+ kümesi 0/3), Maiden/Şartlı'da
// ise eşikler 1-4 puan içinde tuttu. Bu yüzden ham olasılığa tek bir eşik uygulamak yerine her tip
// için CV tahminlerinden Platt kalibrasyonu (a·logit(p)+b) öğrenildi ve banko KALİBRE olasılığa göre
// verilir. Handikap'ın kalibre olasılığı hiçbir zaman eşiğe ulaşmaz (CV'de 0 yarış) — kural olarak
// kapatılmadı, VERİ kapatıyor.
//
// KAPSAM SINIRI: Maiden / ŞARTLI 19 / ŞARTLI 1 / ŞARTLI 27 yarışları ayrı segment modeliyle
// puanlanıyor; o modellerin olasılıklarının kalibrasyonu ölçülmedi (ŞARTLI 1/27 eğitimi yalnız 59 yarış).
// Kanıtsız banko vermemek için bu segmentlerde banko adayı VERİLMEZ.
//
// Kalibrasyon: arac-banko-kalibrasyon.mts (CV tahminleri C:/tmp/kalibrasyon-cv-tahminleri.json),
// segment-dışı 589 yarışta, model 22 özellik. 2 parametre/tip, örnek-içi — eşiği geçen küme: n≈44, isabet ≈%50.

export const BANKO_KALIBRE_ESIGI = 0.4;

export type BankoGrup = "Handikap" | "KV/Satış" | "Şartlı" | "Genel";
const KALIBRASYON: Record<BankoGrup, { a: number; b: number }> = {
  Handikap: { a: 0.56, b: -0.81 },
  "KV/Satış": { a: 0.83, b: -0.29 },
  Şartlı: { a: 0.88, b: -0.08 },
  Genel: { a: 0.93, b: -0.16 },
};

export function segmentModeliMi(classType: string): boolean {
  const c = classType.toUpperCase();
  return c.includes("MAIDEN") || c.includes("ŞARTLI 19") || c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27");
}

export function bankoGrubu(classType: string): BankoGrup {
  const c = classType.toUpperCase();
  if (c.includes("HANDIKAP")) return "Handikap";
  if (c.startsWith("KV") || c.includes("SATIŞ") || c.includes("SATIS")) return "KV/Satış";
  if (c.includes("ŞARTLI") || c.includes("SARTLI")) return "Şartlı";
  return "Genel";
}

export function kalibreOlasilik(p: number, grup: BankoGrup): number {
  const { a, b } = KALIBRASYON[grup];
  const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return 1 / (1 + Math.exp(-(a * Math.log(q / (1 - q)) + b)));
}

export type BankoSonuc = { bankoAdayi: boolean; sebep: string; kalibreOlasilik?: number };

/** `siraliPicks`: model sırasına göre (rank 1 ilk) { no, ad, probability }. */
export function bankoAdayiTespit(
  classType: string,
  siraliPicks: { no: number; ad: string; probability: number }[],
): BankoSonuc {
  const birinci = siraliPicks[0];
  if (!birinci) return { bankoAdayi: false, sebep: "Veri yok." };
  const etiket = `#${birinci.no} ${birinci.ad}`;
  if (segmentModeliMi(classType)) {
    return { bankoAdayi: false, sebep: `${etiket} — bu koşu tipi (${classType}) ayrı segment modeliyle puanlanıyor ve olasılık kalibrasyonu ölçülmedi; kanıtsız banko verilmez.` };
  }
  const grup = bankoGrubu(classType);
  const kal = kalibreOlasilik(birinci.probability, grup);
  const ham = `ham %${(birinci.probability * 100).toFixed(1)}, ${grup} tipi için kalibre %${(kal * 100).toFixed(1)}`;
  if (kal >= BANKO_KALIBRE_ESIGI) {
    return { bankoAdayi: true, kalibreOlasilik: kal, sebep: `${etiket} — ${ham} (eşik %${BANKO_KALIBRE_ESIGI * 100}). Geçmiş CV'de bu eşiği geçen koşularda isabet ≈%50 (n≈44). Yalnız bir işaret — riskleri kendiniz teyit edin.` };
  }
  return { bankoAdayi: false, kalibreOlasilik: kal, sebep: `${etiket} — ${ham}; banko eşiğinin (%${BANKO_KALIBRE_ESIGI * 100}) altında${grup === "Handikap" ? " (Handikap'ta model aşırı güvenli, geçmişte hiçbir koşu eşiği geçmedi)" : ""}.` };
}
