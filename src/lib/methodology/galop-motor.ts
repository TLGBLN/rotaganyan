// GALOP ANALİZ MOTORU v1.0 — SAF (DB'siz) fonksiyonlar. Kullanıcı formülü (2026-11-16):
//   Q_i = (0.50·P_hız + 0.25·P_kapanış + 0.15·P_efor) / (mevcut ağırlıkların toplamı)         (tek galop kalitesi, 0–100)
//   P_hız      = 100·Φ((Medyan − T)/σ)             — aynı ırk × galop mesafesi × pist × tür × iç/dış grubuna göre (sağlam σ = 1.4826·MAD)
//   P_kapanış  = 100·Φ((T̂400 − T400)/σ)            — toplam dereceye göre beklenen son 400 (grup regresyonu); 400m'de HESAPLANMAZ
//   P_efor     : ÇR 90 · R 85 · HR 80 · HÇ 65 · Ç 55 (kodu yoksa bileşen atlanır)
//   Son 3 kullanılabilir galop: 0.5/0.3/0.2 (mevcut ağırlıklara normalize);  ≥2 galopta GALOP_KALITE = 0.9·Q_ort + 0.1·clip(50+1.5·(Q1−Q2),0,100);
//   tek galopta GALOP_KALITE = Q1 (trend yok, CEZA YOK). Eksik bileşen için SIFIR verilmez (ağırlık yeniden normalize).
// Bugünkü yarışın mesafesi hesaba GİRMEZ. Kenter idmanı güvenilir hız testi sayılmaz (atlanır).
// Referans dağılım: galop-referans.json (arac-galop-referans-uret.mts). Hipodrom alanı Gallop tablosunda yok → hipodromsuz.
import referans from "./galop-referans.json";
import { parseGalopSec } from "@/components/program/panels/galop-helpers";

export const GALOP_MIN_REF = 30;
export type GalopHam = { date: Date; track: string | null; form: string | null; splits: Record<string, string | null> };
const DK = ["1400", "1200", "1000", "800", "600", "400"] as const;
const EFOR: Record<string, number> = { "ÇR": 90, "ÇOK RAHAT": 90, "R": 85, "RAHAT": 85, "HR": 80, "HAFİF RAHAT": 80, "HÇ": 65, "HAFİF ÇALIŞARAK": 65, "Ç": 55, "ÇALIŞARAK": 55 };

/** σ alt sınırı (sıfıra yakın ölçek tahminlerine karşı): 400m başına 0.25 sn. */
export const galopSigmaTaban = (mesafe: string | number) => 0.25 * (Number(mesafe) / 400);

const Phi = (z: number) => { const x = Math.abs(z) / Math.SQRT2; const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return 0.5 * (1 + (z < 0 ? -y : y)); };

export type GalopOzellik = { d: string; T: number; t4: number | null; pist: string; ic: string; tur: "S" | "G" };
/** Galop kaydından: en derin geçerli mesafe (d), o mesafenin derecesi (T, sn), son 400 (t4), pist, iç/dış, tür. */
export function galopOzellik(g: { track: string | null; splits: Record<string, string | null> }): GalopOzellik | null {
  const d = DK.find((k) => parseGalopSec(g.splits[k] ?? null) != null); if (!d) return null;
  const T = parseGalopSec(g.splits[d]!)!; const t4 = parseGalopSec(g.splits["400"] ?? null);
  const pist = String(g.splits.pist ?? "") || "?"; const ic = String(g.splits.ic_dis ?? "") ? "ic" : "x"; const tur = (g.track ?? "").toUpperCase().includes("SPRINT") ? "S" : "G";
  return { d, T, t4, pist, ic, tur };
}
/** Karşılaştırma grubu anahtarı; lv 0 = en ayrıntılı, 3 = yalnız ırk×mesafe. */
export const galopGrupAnahtari = (irk: string, o: Pick<GalopOzellik, "d" | "pist" | "ic" | "tur">, lv: number) => [irk, o.d, lv <= 2 ? o.pist : "*", lv <= 1 ? o.tur : "*", lv <= 0 ? o.ic : "*"].join("|");

const GRUP = referans.gruplar as Record<string, { n: number; m: number; s: number }>;
const REG = referans.regresyon as Record<string, { n: number; a: number; b: number; s: number }>;

export type TekGalopDetay = { q: number | null; pHiz: number | null; pKapanis: number | null; pEfor: number | null; refN: number };
/** Tek galobun kalite puanı Q (0–100). Kenter / çözülemeyen / referanssız galop → q=null. */
export function tekGalopKalitesi(g: GalopHam, irk: string): TekGalopDetay {
  const bos: TekGalopDetay = { q: null, pHiz: null, pKapanis: null, pEfor: null, refN: 0 };
  if ((g.track ?? "").toUpperCase().includes("KENTER")) return bos;
  const o = galopOzellik(g); if (!o) return bos;
  let st: { n: number; m: number; s: number } | undefined; for (let lv = 0; lv <= 3 && !st; lv++) st = GRUP[galopGrupAnahtari(irk, o, lv)];
  if (!st) return bos;
  const pHiz = 100 * Phi((st.m - o.T) / st.s);
  let pKapanis: number | null = null;
  if (o.d !== "400" && o.t4 != null) { const r = REG[galopGrupAnahtari(irk, o, 2)]; if (r) pKapanis = 100 * Phi(((r.a + r.b * o.T) - o.t4) / r.s); }
  const pEfor = EFOR[(g.form ?? "").toUpperCase().trim()] ?? null;
  let sw = 0.5, sum = 0.5 * pHiz;
  if (pKapanis != null) { sw += 0.25; sum += 0.25 * pKapanis; }
  if (pEfor != null) { sw += 0.15; sum += 0.15 * pEfor; }
  return { q: sum / sw, pHiz, pKapanis, pEfor, refN: st.n };
}

export type GalopKaliteSonuc = { kalite: number | null; qler: number[]; qOrtalama: number | null; trend: number | null };
/** GALOP_KALITE (0–100). `galoplar` YARIŞ GÜNÜNDEN ÖNCEKİ kayıtlar olmalı; sıra önemli değil (yeniden en yeniye sıralanır). */
export function galopKalitesiV1(galoplar: GalopHam[], irk: string): GalopKaliteSonuc {
  const sirali = [...galoplar].sort((a, b) => b.date.getTime() - a.date.getTime());
  const qler: number[] = [];
  for (const g of sirali) { const q = tekGalopKalitesi(g, irk).q; if (q != null) qler.push(q); if (qler.length >= 3) break; }
  if (!qler.length) return { kalite: null, qler, qOrtalama: null, trend: null };
  const w = [0.5, 0.3, 0.2].slice(0, qler.length);
  const qOrt = qler.reduce((p, q, i) => p + q * w[i]!, 0) / w.reduce((p, q) => p + q, 0);
  if (qler.length < 2) return { kalite: qler[0]!, qler, qOrtalama: qOrt, trend: null };
  const trend = Math.max(0, Math.min(100, 50 + 1.5 * (qler[0]! - qler[1]!)));
  return { kalite: 0.9 * qOrt + 0.1 * trend, qler, qOrtalama: qOrt, trend };
}
