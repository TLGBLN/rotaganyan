// SAF MODEL SÜRÜM ZAMAN ÇİZELGESİ — dashboard/izleme bir tahminin HANGİ model sürümüyle üretildiğini buradan okur.
//
// Neden zaman çizelgesi: Pick.featureSnapshot yayınlanmış tahminlerin ~%25'inde boş ve segment modellerinde
// (Maiden/ŞARTLI 19: 8, ŞARTLI 1/27: 4 sinyal) sinyal sayısı farklı — sürüm işareti olarak güvenilmez. Bir tahminin
// "son kaydedildiği an" (Prediction.updatedAt) hangi sürümün canlı olduğu aralığa düşüyorsa, o sürümle puanlanmıştır.
//
// !!! HER MODEL DEPLOY'UNDA bu listeye yeni satır ekle (baslangıç = GERÇEK deploy saati). Test
// (model-surumleri.test.ts) son satırın özellik sayısını canlı ağırlık dosyasıyla ve ENGINE_VERSIONS'ın son girdisiyle
// karşılaştırır — liste güncellenmezse test kırılır, dashboard sessizce bayatlayamaz.
//
// `cv`: o sürümün eğitim sırasındaki 5 katlı genişleyen-pencereli zaman-CV sonucu (827 test yarışı, TÜM tipler) — canlı
// sonuçların karşılaştırılacağı "beklenti".

export type CvBeklenti = { n: number; top1: number; top3: number; logLoss: number };
export type ModelSurumu = { baslangic: string; ad: string; ozellikSayisi: number; cv: CvBeklenti | null };

export const MODEL_SURUMLERI: ModelSurumu[] = [
  { baslangic: "2026-11-10T00:00:00+03:00", ad: "Saf Model 15-16 özellik", ozellikSayisi: 16, cv: { n: 827, top1: 0.191, top3: 0.507, logLoss: 2.1708 } },
  { baslangic: "2026-11-11T20:45:00+03:00", ad: "Saf Model 20 özellik", ozellikSayisi: 20, cv: { n: 827, top1: 0.232, top3: 0.578, logLoss: 2.0748 } },
  { baslangic: "2026-11-12T20:30:00+03:00", ad: "Saf Model 22 özellik", ozellikSayisi: 22, cv: { n: 827, top1: 0.249, top3: 0.584, logLoss: 2.0409 } },
  { baslangic: "2026-11-13T11:39:14+03:00", ad: "Saf Model 25 özellik", ozellikSayisi: 25, cv: { n: 827, top1: 0.262, top3: 0.614, logLoss: 2.0052 } },
  // 2026-11-14 sinyal kütüğü son hali: fiilen ölü 4 sinyal çıkarıldı (25→21), katsayılar AYNI, YENİDEN EĞİTİM/CV YOK.
  // cv = 25 sinyalli modelin CV'sinden MİRAS (çıkarılan sinyallerin ort. |katkısı| 0.009, kayıtlı koşularda sıralama değişmedi) — yeni bir ölçüm DEĞİL.
  { baslangic: "2026-11-14T14:26:00+03:00", ad: "Saf Model 21 özellik", ozellikSayisi: 21, cv: { n: 827, top1: 0.262, top3: 0.614, logLoss: 2.0052 } },
];

/** Saf (AGF'siz) resmi motor dönemi — 2026-11-10 kullanıcı kararı. */
export const SAF_ERA_BASLANGIC = MODEL_SURUMLERI[0].baslangic;
export const GUNCEL_MODEL = MODEL_SURUMLERI[MODEL_SURUMLERI.length - 1];

/** t anında canlı olan model sürümü (Saf era öncesi için null). */
export function modelSurumuAt(t: Date): ModelSurumu | null {
  let bulunan: ModelSurumu | null = null;
  for (const s of MODEL_SURUMLERI) if (new Date(s.baslangic).getTime() <= t.getTime()) bulunan = s;
  return bulunan;
}

/** Eğitim sırasındaki bootstrap z (25 özellikli model, 2026-11-13, 30 yeniden örnekleme) — model yeniden eğitilince GÜNCELLE. */
export const EGITIM_Z: Record<string, number> = {
  hpRel: 9.0, kgsLog: -8.0, fMean: -7.9, jokeyPIT: 7.8, kiloRel: -6.0, antrenorPIT: 5.2, sexE: 5.2, hizDerecesi: 3.9, sireOrani: 3.9, PS_closerFit: -3.7,
  galopKalite: 2.9, lastWon: 2.5, h2hNetSkor: 2.4, ACC_CLOSE_RES: 2.4, ACC_LATE: 2.3, zeminMesafeDeneyim: 1.6, PS_lone: 1.5, takiDegisikligi: 1.4,
  idmJokey: 1.2, yarisGidisatiSkoru: 0.7, jokeyFormuGenel: 0.4, PS_front: -0.3, ACC_SPEED: -0.3, zeminToleransi: -0.2, sonIdmanSprint: -0.1,
};
