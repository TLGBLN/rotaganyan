// ROTAGANYAN ANALİZ MOTORU v1.0 — HIZ ailesi (registry: HIZ_01 tam, HIZ_02/03 henüz yok).
//
// HIZ_01: mevcut getHizDerecesiForRace() DOĞRUDAN kullanılır — yeniden icat edilmez
// (kullanıcı kuralı: "Mevcut veri erişim yardımcıları ... yeniden kullanılabilir").
// Bu fonksiyon zaten `race.raceDay.date`'i cutoff olarak kullanıyor (point-in-time kod
// okumasıyla doğrulandı, 2026-10-17 veri envanteri) — v1.0 burada EK bir cutoff mantığı
// uygulamaz, kaynağın kendi garantisine güvenir.
//
// ÖNEMLİ FARK: V5.46.1 bu fonksiyonu yalnız CANLI (ingest edilmiş) bir Race için çağırır.
// v1.0'ın EĞİTİM verisi de yalnız Result'u olan (yani zaten Race tablomuzda) yarışlardan
// oluşacağı için bu kısıt eğitim için de SORUN DEĞİL — training/backtest örneklemi zaten
// "bizim DB'mizde Result'u olan yarış" kümesiyle sınırlı olmak ZORUNDA (aksi halde
// doğrulanacak bir sonuç yok).

import { getHizDerecesiForRace, getHizDerecesiGozlemliForRace } from "@/server/actions/hiz-derecesi.actions";

export type HizResult = {
  value: number | null;
  observed: boolean;
};

/** HIZ_01 — bir yarışın TÜM sahası için tek seferde hesaplanır (runnerNo -> sonuç). */
export async function computeSpeedRatingForRace(raceId: string): Promise<Map<number, HizResult>> {
  const [values, observed] = await Promise.all([
    getHizDerecesiForRace(raceId),
    getHizDerecesiGozlemliForRace(raceId),
  ]);
  const out = new Map<number, HizResult>();
  for (const [no, value] of values) {
    out.set(no, { value, observed: observed.get(no) ?? false });
  }
  return out;
}
