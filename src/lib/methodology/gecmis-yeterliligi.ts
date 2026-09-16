/**
 * Anormal Pist Modu v1 — İKİNCİ risk boyutu (2026-09-16 kullanıcı talebiyle
 * pist-dayanikliligi.ts'ten AYRI tutuldu): "Pist Duyarlılığı ≠ Veri Yeterliliği".
 *
 * KÖK NEDEN: bugünkü İstanbul K1'de hem modelin favorisi hem gerçek kazanan İLK
 * yarışını koşuyordu — zeminToleransi=0 idi ama bu "zeminden etkilenmez" DEĞİL,
 * "zemine nasıl tepki vereceğini bilmiyoruz" demek. pist-dayanikliligi.ts'in
 * ölçtüğü şey yalnızca "zeminToleransi katsayısına duyarlılık" — bu dosya AYRI
 * olarak "modelin bu at için yeterli geçmiş kanıtı var mı" sorusuna cevap verir.
 * missing (geçmiş yok) ile neutral (geçmiş var ama etkisiz) KARIŞTIRILMAZ — aynı
 * ayrım idmJokey/sonIdmanSprint'te de gerekliydi (bkz. proje hafızası).
 *
 * Bu dosya da SAF/senkron — V5.46 skoruna hiçbir şekilde girmez, yalnız RİSK
 * değerlendirmesi için okunur (bkz. anormal-pist-risk.ts).
 */
import type { Faz1RunnerV5Sirali } from "./v5-engine";

export type GecmisDurumu = "YOK" | "SINIRLI" | "YETERLI";

/** recentForm ("Son 5 Yarış" string, ProgramView.tsx'teki AYNI ayrıştırma kuralı:
 *  her karakter [0-9] veya "K" bir geçmiş kayıt) uzunluğuna göre: 0 kayıt=YOK,
 *  1 kayıt=SINIRLI, 2+=YETERLI. */
export function gecmisDurumuHesapla(recentForm: string | null | undefined): GecmisDurumu {
  const sayi = (recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).length;
  if (sayi === 0) return "YOK";
  if (sayi === 1) return "SINIRLI";
  return "YETERLI";
}

export type AtGecmisDurumu = { no: number; durum: GecmisDurumu; olasilik: number };

export type GecmisYeterliligiSonucu = {
  /** U = Σ P_i^prod × I_i — modelin olasılık kütlesinin ne kadarı geçmişi
   *  yetersiz (YOK veya SINIRLI) atların üzerinde. Saf saha oranından (kaç at
   *  debutant) daha isabetli: model zaten düşük olasılık veriyorsa saf oran
   *  yüksek olsa da gerçek risk düşük kalır. */
  yetersizlikKutlesi: number;
  /** Kullanıcı talebi: "modelin liderinin debutant olması saha oranından
   *  BAĞIMSIZ olarak kritik" — bu yüzden ayrı bir flag. */
  liderGecmisiYetersizMi: boolean;
  top3YetersizSayisi: number;
  atDurumlari: AtGecmisDurumu[];
};

/** `faz2V5Sirala`'nın (ÜRETİM) çıktısını alır — yeniden hesaplama yapmaz, yalnız
 *  zaten var olan `recentForm`/`olasilik` alanlarını okur. */
export function hesaplaGecmisYeterliligi(sirali: Faz1RunnerV5Sirali[]): GecmisYeterliligiSonucu {
  const atDurumlari = sirali
    .map((r) => ({ no: r.no, durum: gecmisDurumuHesapla(r.recentForm), olasilik: r.olasilik }))
    .sort((a, b) => b.olasilik - a.olasilik);

  const yetersizlikKutlesi = atDurumlari.reduce(
    (s, a) => s + (a.durum !== "YETERLI" ? a.olasilik : 0),
    0
  );
  const liderGecmisiYetersizMi = atDurumlari.length > 0 && atDurumlari[0].durum !== "YETERLI";
  const top3YetersizSayisi = atDurumlari.slice(0, 3).filter((a) => a.durum !== "YETERLI").length;

  return { yetersizlikKutlesi, liderGecmisiYetersizMi, top3YetersizSayisi, atDurumlari };
}
