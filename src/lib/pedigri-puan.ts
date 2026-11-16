// PEDİGRİ PUANLAMA (0–100) — SAF (DB'siz). Kullanıcı tasarımı 2026-11-16. Yalnız GÖSTERİM: ana skora/kupona GİRMEZ (827 yarışlık testte katkı sağlamadı).
// Üç AYRI değer (karıştırılmaz):
//   PED_KALITE      — soy hattının kendi KATEGORİSİNDEKİ diğer soy hatlarına göre yüzdelik konumu (0–100), örnek sayısı düzeltmeli.
//   PED_UZMANLASMA  — açıklayıcı: bağlam (yaş/pist) oranı − aynı atanın bağlam DIŞI kendi oranı (pp). Kalite DEĞİLDİR.
//   VERİ GÜVENİ     — C = n_etkin/(n_etkin + k), 0–1. "Tahminin doğru çıkma ihtimali" DEĞİL; ham oranın kategori ortalamasına ne kadar az çekildiğini gösterir.
//
// Örnek sayısı düzeltmesi TEK KEZ uygulanır:  P* = P0 + C·(P_ham − P0).
//   P0 : aynı kategorideki (aynı rol + yaş/pist bağlamı) tüm soy hatlarının koşu-ağırlıklı kazanma oranı.
//   C  : n_etkin/(n_etkin + k); k kategori başına VERİDEN (beta-binom. moment / DerSimonian-Laird) kestirilir — sabit uydurma değil.
//   n_etkin = n / (1 + ρ·(m − 1)), m = koşu/yavru: aynı yavrunun koşuları bağımsız değildir (ρ = ICC_YAVRU, arac-pedigri-icc.mts ile atlardan kestirildi).
// Puan:  S = 100 · F(P*)   — F: kategorideki soy hatlarının P* dağılımının koşu-ağırlıklı yüzdelik fonksiyonu (eşitlikte yarım sıra).

/** Aynı yavrunun koşuları arasındaki korelasyon (ICC). arac-pedigri-icc.mts: 6.985 at, 117.505 koşu → 0.050 (≥3 koşu 0.052, ≥5 koşu 0.052). */
export const ICC_YAVRU = 0.05;
/** Kategori uyumsuzluğunda (istenen yaş/pist verisi yok, genel istatistiğe düşüldü) veri güveni bu çarpanla düşürülür. */
export const GENEL_YEDEK_CARPAN = 0.5;
/** k üst sınırı (kategoride gerçek yayılım ≈ 0 ise C → 0 olur ama sayısal taşma olmasın). */
export const K_UST = 5000;

export type Akran = { starts: number; wins: number; yavru: number };

/** Etkin örnek sayısı: yavru başına ortalama koşu m = starts/yavru; n_etkin = n/(1+ρ(m−1)). Yavru sayısı bilinmiyorsa (≤0) n aynen kalır. */
export function etkinOrnek(starts: number, yavru: number, icc: number = ICC_YAVRU): number {
  if (starts <= 0) return 0;
  if (!(yavru > 0)) return starts;
  const m = Math.max(1, starts / yavru);
  return starts / (1 + icc * (m - 1));
}

export type EbSonuc = { p0: number; k: number; tau2: number; akranSayisi: number };
/** Kategorideki akranlardan P0 ve k'nın (beta-binom. önsel gücü) kestirimi — DerSimonian-Laird. */
export function ebKestir(akranlar: Akran[], icc: number = ICC_YAVRU): EbSonuc | null {
  const a = akranlar.filter((x) => x.starts > 0);
  const N = a.reduce((s, x) => s + x.starts, 0);
  if (a.length < 3 || N <= 0) return null;
  const p0 = a.reduce((s, x) => s + x.wins, 0) / N;
  if (p0 <= 0 || p0 >= 1) return null;
  const v0 = p0 * (1 - p0);
  const ne = a.map((x) => etkinOrnek(x.starts, x.yavru, icc));
  const w = ne.map((n) => n / v0); // 1 / Var(p_i), Var = p0(1−p0)/n_etkin
  const sw = w.reduce((s, x) => s + x, 0), sw2 = w.reduce((s, x) => s + x * x, 0);
  const Q = a.reduce((s, x, i) => s + w[i]! * (x.wins / x.starts - p0) ** 2, 0);
  const tau2 = Math.max(0, (Q - (a.length - 1)) / (sw - sw2 / sw));
  const k = tau2 > 1e-12 ? Math.min(K_UST, v0 / tau2) : K_UST;
  return { p0, k, tau2, akranSayisi: a.length };
}

export type DuzeltilmisOran = { ham: number; pYildiz: number; C: number; nEtkin: number };
export function duzelt(wins: number, starts: number, yavru: number, eb: Pick<EbSonuc, "p0" | "k">, icc: number = ICC_YAVRU): DuzeltilmisOran | null {
  if (starts <= 0) return null;
  const nEtkin = etkinOrnek(starts, yavru, icc);
  const C = nEtkin / (nEtkin + eb.k);
  const ham = wins / starts;
  return { ham, pYildiz: eb.p0 + C * (ham - eb.p0), C, nEtkin };
}

/** Kategorinin akran dağılımı (P* değerleri, koşu-ağırlıklı) — yüzdelik puan için. */
export type AkranDagilim = { pYildiz: number; agirlik: number }[];
export function akranDagilimi(akranlar: Akran[], eb: Pick<EbSonuc, "p0" | "k">, icc: number = ICC_YAVRU): AkranDagilim {
  return akranlar.filter((x) => x.starts > 0).map((x) => ({ pYildiz: duzelt(x.wins, x.starts, x.yavru, eb, icc)!.pYildiz, agirlik: x.starts }));
}
/** 0–100 yüzdelik: koşu-ağırlıklı payın (altında + eşitin yarısı). */
export function yuzdelikPuan(pYildiz: number, dagilim: AkranDagilim): number | null {
  const toplam = dagilim.reduce((s, x) => s + x.agirlik, 0);
  if (toplam <= 0) return null;
  const alt = dagilim.reduce((s, x) => s + (x.pYildiz < pYildiz - 1e-12 ? x.agirlik : Math.abs(x.pYildiz - pYildiz) <= 1e-12 ? x.agirlik / 2 : 0), 0);
  return (100 * alt) / toplam;
}

/** Üç soy hattının ortalaması: puanı olanların ortalaması (eksik hat SIFIR yapılmaz, "VERİ YOK" ayrıca bildirilir); hiçbiri yoksa null. */
export function pedigriKalite(puanlar: (number | null)[]): number | null {
  const v = puanlar.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
/** Veri güveni ortalaması (0–100): eksik hattın güveni 0 sayılır (güven eksik veriyle yüksek görünmesin). */
export function pedigriGuven(C: (number | null)[]): number {
  return (C.reduce<number>((s, x) => s + (x ?? 0), 0) / Math.max(1, C.length)) * 100;
}

/** Bağlam − bağlam DIŞI kendi oranı (yüzde puan). Referans yeterli değilse (<minRef koşu) null. */
export function uzmanlasma(ctx: { starts: number; wins: number }, toplam: { starts: number; wins: number }, minRef = 20): { farkPp: number; refK: number; refStarts: number } | null {
  if (ctx.starts <= 0) return null;
  const refStarts = toplam.starts - ctx.starts, refWins = toplam.wins - ctx.wins;
  if (refStarts < minRef || refWins < 0) return null;
  const refK = refWins / refStarts;
  return { farkPp: (ctx.wins / ctx.starts - refK) * 100, refK, refStarts };
}
