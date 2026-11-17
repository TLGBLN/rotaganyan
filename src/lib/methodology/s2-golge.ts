// S2 GÖLGE KIYAS — SAF modül (DB'siz). Aynı yarış-öncesi snapshot üzerinde CANLI varsayılan modeli (24) ve S2 (17, GÖLGE) yeniden puanlar.
// Canlı tahmin/ağırlık/segmentler DEĞİŞMEZ; bu yalnız bir ÖLÇÜM. Hem cron servisi (DB snapshot'ları) hem araçlar bu tek uygulamayı kullanır.
//
// GEÇERLİLİK KURALLARI (kıyas yalnız GEÇERLİ yarışlarda yapılır; geçersizler nedeniyle kaydedilir, sayılmaz):
//  KAPSAM_DISI : Handikap / ŞARTLI 1/27 segmentleri (S2 yalnız varsayılan modele aittir)
//  GECERSIZ    : canlı 24 sinyalden biri snapshot'ta yok (v2-öncesi kayıt) | gözlemli sinyalin reliability'si bilinmiyor (null → tam güven SAYILMAZ)
//                | kayıtlı olasılık (Pick.scoreExact) eksik | herhangi bir atın yeniden hesaplanan canlı olasılığı kayıtlı olasılıktan TOLERANS'tan fazla sapıyor (TÜM atlar kontrol edilir) | kazanan atlar arasında değil
import canliJson from "./weights/v546-1-saf-weights.json";
import s2Json from "./weights/v546-1-saf-weights-s2-golge.json";

export type AgirlikDosyasi = { featureNames: string[]; weights: number[]; means: number[]; stds: number[] };
export const CANLI_AGIRLIK = canliJson as unknown as AgirlikDosyasi;
export const S2_AGIRLIK = s2Json as unknown as AgirlikDosyasi;
/** Kayıtlı olasılıkla yeniden hesaplanan arasında izin verilen en büyük mutlak fark (yüzde puan). */
export const OLASILIK_TOLERANSI_PP = 0.1;

export type SnapSinyal = { kod: string; hamDeger: number | null; observed: boolean; reliability: number | null };
export type KiyasGirdi = { tip: string; kazananlar: number[]; atlar: { no: number; kayitliP: number | null; sinyaller: SnapSinyal[] }[] };
export type KiyasNeden = "SEGMENT" | "ESKI_SINYAL_KAYDI" | "RELIABILITY_BILINMIYOR" | "OLASILIK_UYUSMUYOR" | "KAYITLI_OLASILIK_YOK" | "KAZANAN_YOK" | "BOS_YARIS";
export type KiyasSonuc =
  | { durum: "KAPSAM_DISI" | "GECERSIZ"; neden: KiyasNeden; ayrinti?: string; maxFarkPp?: number }
  | { durum: "GECERLI"; maxFarkPp: number; kazananNo: number; atlar: { no: number; kayitliP: number; canliP: number; s2P: number }[]; canliSira: number; s2Sira: number; canliTop1: boolean; s2Top1: boolean; canliTop3: boolean; s2Top3: boolean };

/** Motorun segment yönlendirmesiyle AYNI (v546-1-engine.ts segmentAgirligiSec): yalnız 'varsayilan' S2 kapsamındadır. */
export function segmentOf(classType: string): "varsayilan" | "sartli1-27" | "handikap" {
  const c = classType.toUpperCase();
  if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return "varsayilan";
  if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return "sartli1-27";
  if (c.includes("HANDIKAP")) return "handikap";
  return "varsayilan";
}

const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const ix = (w: AgirlikDosyasi, n: string) => w.featureNames.indexOf(n);
const ACC_C = { mu: CANLI_AGIRLIK.means[ix(CANLI_AGIRLIK, "ACC_CLOSE_RES")]!, sd: CANLI_AGIRLIK.stds[ix(CANLI_AGIRLIK, "ACC_CLOSE_RES")]! };
const ACC_L = { mu: CANLI_AGIRLIK.means[ix(CANLI_AGIRLIK, "ACC_LATE")]!, sd: CANLI_AGIRLIK.stds[ix(CANLI_AGIRLIK, "ACC_LATE")]! };

/** accBitis ham değeri = (rel_C·z_C + rel_L·z_L)/2; yalnız biri gözlemliyse o; ikisi de yoksa null. z'ler CANLI ağırlık dosyasındaki μ/σ ile. */
export function accBitis(c: SnapSinyal | undefined, l: SnapSinyal | undefined): number | null {
  const a = c && c.observed && c.hamDeger != null && c.reliability != null ? c.reliability * (c.hamDeger - ACC_C.mu) / ACC_C.sd : null;
  const b = l && l.observed && l.hamDeger != null && l.reliability != null ? l.reliability * (l.hamDeger - ACC_L.mu) / ACC_L.sd : null;
  return a != null && b != null ? (a + b) / 2 : (a ?? b);
}

/** Motorla AYNI: gözlemsiz → 0 katkı; katkı = güvenirlik × (ham − μ)/σ × β. Gerekli sinyal yoksa null. */
export function skorla(w: AgirlikDosyasi, sinyaller: SnapSinyal[]): number | null {
  const m = new Map(sinyaller.map((s) => [s.kod, s]));
  let toplam = 0;
  for (let i = 0; i < w.featureNames.length; i++) {
    const n = w.featureNames[i]!; let ham: number | null, rel = 1;
    if (n === "accBitis") ham = accBitis(m.get("ACC_CLOSE_RES"), m.get("ACC_LATE"));
    else { const s = m.get(n); if (!s) return null; if (!s.observed || s.hamDeger == null) continue; if (s.reliability == null) return null; ham = s.hamDeger; rel = s.reliability; }
    if (ham == null) continue;
    toplam += rel * ((ham - w.means[i]!) / w.stds[i]!) * w.weights[i]!;
  }
  return toplam;
}

export function kiyasla(g: KiyasGirdi): KiyasSonuc {
  if (segmentOf(g.tip) !== "varsayilan") return { durum: "KAPSAM_DISI", neden: "SEGMENT", ayrinti: g.tip };
  if (!g.atlar.length) return { durum: "GECERSIZ", neden: "BOS_YARIS" };
  for (const a of g.atlar) {
    const adlar = new Set(a.sinyaller.map((s) => s.kod));
    const yok = CANLI_AGIRLIK.featureNames.find((n) => !adlar.has(n)); if (yok) return { durum: "GECERSIZ", neden: "ESKI_SINYAL_KAYDI", ayrinti: "at " + a.no + ": '" + yok + "' yok" };
    const rel = a.sinyaller.find((s) => s.observed && s.hamDeger != null && s.reliability == null && (CANLI_AGIRLIK.featureNames.includes(s.kod)));
    if (rel) return { durum: "GECERSIZ", neden: "RELIABILITY_BILINMIYOR", ayrinti: "at " + a.no + ": '" + rel.kod + "'" };
  }
  if (g.atlar.some((a) => a.kayitliP == null || !Number.isFinite(a.kayitliP))) return { durum: "GECERSIZ", neden: "KAYITLI_OLASILIK_YOK" };
  const sl = g.atlar.map((a) => skorla(CANLI_AGIRLIK, a.sinyaller)), s2 = g.atlar.map((a) => skorla(S2_AGIRLIK, a.sinyaller));
  if (sl.some((v) => v == null) || s2.some((v) => v == null)) return { durum: "GECERSIZ", neden: "RELIABILITY_BILINMIYOR", ayrinti: "skor hesaplanamadı" };
  const pl = softmax(sl as number[]), p2 = softmax(s2 as number[]);
  // TÜM atlar: yeniden hesaplanan canlı olasılık kayıtlıyla eşleşmeli (yalnız favori değil)
  const farklar = g.atlar.map((a, i) => Math.abs(a.kayitliP! - pl[i]! * 100)); const maxFarkPp = Math.max(...farklar);
  if (maxFarkPp > OLASILIK_TOLERANSI_PP) { const k = farklar.indexOf(maxFarkPp); return { durum: "GECERSIZ", neden: "OLASILIK_UYUSMUYOR", maxFarkPp, ayrinti: "at " + g.atlar[k]!.no + ": kayıtlı " + g.atlar[k]!.kayitliP!.toFixed(2) + " ≠ yeniden " + (pl[k]! * 100).toFixed(2) }; }
  const kazananNo = g.kazananlar[0]; const ki = g.atlar.findIndex((a) => a.no === kazananNo);
  if (kazananNo == null || ki < 0) return { durum: "GECERSIZ", neden: "KAZANAN_YOK", maxFarkPp };
  const sira = (p: number[]) => 1 + p.filter((v) => v > p[ki]!).length; const cs = sira(pl), ss = sira(p2);
  return { durum: "GECERLI", maxFarkPp, kazananNo, atlar: g.atlar.map((a, i) => ({ no: a.no, kayitliP: a.kayitliP!, canliP: pl[i]! * 100, s2P: p2[i]! * 100 })), canliSira: cs, s2Sira: ss, canliTop1: cs === 1, s2Top1: ss === 1, canliTop3: cs <= 3, s2Top3: ss <= 3 };
}
