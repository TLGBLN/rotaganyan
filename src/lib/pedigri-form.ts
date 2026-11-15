// ROTAGANYAN Pedigri Bağlam Standardı — SAF (DB-siz, sync) mantık. jokey-form.ts'in (Son 30G / Ref K% / Form Δ / Güven / Etkin Form / Durum)
// pedigri karşılığı. V5.46.1 scorer/weights'e BAĞLANMAZ: YALNIZ GÖSTERİM/ANALİZ (skora girmesi ancak CV protokolüyle, kullanıcı kararıyla).
//
// İki ayrı soru:
//  1) SEVİYE: atanın (baba/anne/anne babası) TOPLAM kazanma oranı, popülasyon ortalamasının ne kadar üstünde/altında?
//  2) BAĞLAM: atanın YAVRULARI bu koşunun bağlamında (yaş/ırk grubu, pist) kendi geri kalan kaydına göre daha mı iyi/kötü?
//     K_ctx = bağlamdaki kazanma oranı; K_REF = aynı atanın BAĞLAM DIŞINDAKİ oranı = (toplam − bağlam)/(toplam koşu − bağlam koşu)
//     (jokeydeki "son 30 gün HARİÇ referans" ile aynı fikir). Δ = K_ctx − K_REF.
//
// GÜVEN SABİTİ jokeydeki gibi 8 DEĞİLDİR: TJK 2026 verisinden moment yöntemiyle KESTİRİLDİ (arac-pedigri-bagiam-dagilim.mts):
//   gerçek bağlam etkisinin yayılımı τ ≈ 2–3.4 pp iken örnekleme gürültüsü çok daha büyük → k = p(1−p)/τ² ≈ 77–289 koşu.
//   Jokeydeki k=8 ile pedigri Etkin Form'u neredeyse tamamen gürültü olurdu (medyan bağlam örneği yalnız 13 koşu).
// DURUM eşikleri jokeydeki ±0.75/±2.0 DEĞİL: o eşikler pedigride atların %61'ini "güçlü" yapardı; yüzdeliklerden alındı
//   (çok güçlü ≈ üst/alt %10, pozitif/negatif ≈ %10–25 arası, nötr ≈ ortadaki yarı).
// Sabitler 2026 TJK verisinden (22 gün) — veri büyüdükçe arac-pedigri-bagiam-dagilim.mts ile yeniden kestirilmelidir.

export type PedigriTur = "SIRE" | "DAM" | "DAMSIRE";
export type PedigriBaglamTur = "SIRE_GRUP_PIST" | "SIRE_GRUP" | "SIRE_PIST" | "DAMSIRE_GRUP";
export type PedigriDurum = "ÇOK GÜÇLÜ POZİTİF" | "POZİTİF" | "NÖTR" | "NEGATİF" | "ÇOK GÜÇLÜ NEGATİF";

export interface Sayim { starts: number; wins: number }

/** Popülasyon kazanma oranı (TJK 2026, tüm koşular): tür başına. */
export const POPULASYON_K: Record<PedigriTur, number> = { SIRE: 0.1003, DAM: 0.1003, DAMSIRE: 0.0989 };
/** SEVİYE için Güven sabiti k_L (atalar arası gerçek yayılımdan kestirildi). */
export const K_SEVIYE: Record<PedigriTur, number> = { SIRE: 65, DAM: 26, DAMSIRE: 85 };
/** BAĞLAM için Güven sabiti k (bağlam etkisinin gerçek yayılımından kestirildi). */
export const K_BAGLAM: Record<PedigriBaglamTur, number> = { SIRE_GRUP_PIST: 175, SIRE_GRUP: 100, SIRE_PIST: 289, DAMSIRE_GRUP: 77 };
/** Referans (bağlam dışı kayıt) için en az koşu — jokeydeki K_REF_MIN_SAMPLE karşılığı. */
export const REF_MIN_KOSU = 20;

type Esik = { cgPoz: number; poz: number; neg: number; cgNeg: number };
/** Etkin (pp) → Durum eşikleri: 2026 verisinde KOŞU SAYISINA AĞIRLIKLI p90/p75 ve p25/p10 (arac-pedigri-esik-kestir.mts). Ağırlıklı, çünkü bir koşuda
 *  karşılaşılan atalar çok koşmuş olanlardır; ataları eşit ağırlıkla saymak eşikleri çok cömert yapıp her şeyi "güçlü" gösterirdi. */
export const ESIK_SEVIYE: Record<PedigriTur, Esik> = {
  SIRE: { cgPoz: 2.82, poz: 1.39, neg: -1.39, cgNeg: -2.43 },
  DAM: { cgPoz: 4.81, poz: 1.78, neg: -2.36, cgNeg: -3.59 },
  DAMSIRE: { cgPoz: 2.8, poz: 1.31, neg: -1.22, cgNeg: -2.03 },
};
export const ESIK_BAGLAM: Record<PedigriBaglamTur, Esik> = {
  SIRE_GRUP_PIST: { cgPoz: 1.67, poz: 0.78, neg: -0.67, cgNeg: -1.49 },
  SIRE_GRUP: { cgPoz: 2.49, poz: 1.24, neg: -1.25, cgNeg: -2.39 },
  SIRE_PIST: { cgPoz: 1.42, poz: 0.79, neg: -0.33, cgNeg: -1.06 },
  DAMSIRE_GRUP: { cgPoz: 2.73, poz: 1.19, neg: -1.21, cgNeg: -2.25 },
};

/** Ülke eki ("(USA)") ve noktalama atılmış, TR-duyarsız karşılaştırma anahtarı. Çekici (TjkPedigriStat.normalizedName) ve servis AYNI fonksiyonu kullanır. */
export function pedigriAdNormalize(ad: string): string {
  return ad
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .toLocaleUpperCase("tr")
    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ")
    .trim();
}

export function guven(n: number, k: number): number { return n <= 0 ? 0 : n / (n + k); }

export function siniflandir(etkinPp: number, e: Esik): PedigriDurum {
  if (etkinPp >= e.cgPoz) return "ÇOK GÜÇLÜ POZİTİF";
  if (etkinPp >= e.poz) return "POZİTİF";
  if (etkinPp > e.neg) return "NÖTR";
  if (etkinPp > e.cgNeg) return "NEGATİF";
  return "ÇOK GÜÇLÜ NEGATİF";
}

export interface PedigriSeviye {
  start: number; win: number; k: number; // k = kazanma oranı (0-1)
  refK: number; // popülasyon
  delta: number; // k − refK (0-1)
  guven: number;
  etkinPp: number; // delta × güven × 100
  durum: PedigriDurum;
}
export function hesaplaSeviye(tur: PedigriTur, toplam: Sayim): PedigriSeviye | null {
  if (toplam.starts <= 0) return null;
  const k = toplam.wins / toplam.starts, refK = POPULASYON_K[tur], delta = k - refK, g = guven(toplam.starts, K_SEVIYE[tur]);
  const etkinPp = delta * g * 100;
  return { start: toplam.starts, win: toplam.wins, k, refK, delta, guven: g, etkinPp, durum: siniflandir(etkinPp, ESIK_SEVIYE[tur]) };
}

export interface PedigriBaglam {
  tur: PedigriBaglamTur;
  ctxStart: number; ctxWin: number; ctxK: number;
  refStart: number; refWin: number; refK: number; // bağlam DIŞI kayıt
  delta: number; guven: number; etkinPp: number; durum: PedigriDurum;
}
/** Bağlam yoksa (ctx boş) ya da referans örneği yetersizse (<REF_MIN_KOSU) null. */
export function hesaplaBaglam(tur: PedigriBaglamTur, ctx: Sayim, toplam: Sayim): PedigriBaglam | null {
  if (ctx.starts <= 0) return null;
  const refStart = toplam.starts - ctx.starts, refWin = toplam.wins - ctx.wins;
  if (refStart < REF_MIN_KOSU || refWin < 0) return null;
  // Güven: Δ'nın örnekleme varyansı hem bağlamdan hem REFERANSTAN gelir → 1/(1 + k(1/n_ctx + 1/n_ref)). n_ref→∞ iken jokeydeki n/(n+k) ile aynıdır;
  // referans küçükse (örn. 72 koşu) Güven doğru biçimde düşer.
  const ctxK = ctx.wins / ctx.starts, refK = refWin / refStart, delta = ctxK - refK, g = 1 / (1 + K_BAGLAM[tur] * (1 / ctx.starts + 1 / refStart));
  const etkinPp = delta * g * 100;
  return { tur, ctxStart: ctx.starts, ctxWin: ctx.wins, ctxK, refStart, refWin, refK, delta, guven: g, etkinPp, durum: siniflandir(etkinPp, ESIK_BAGLAM[tur]) };
}

/** Yaş + ırk → TJK Aygır/Kısrak Babası GrupId (null = bu yaş/ırk için TJK'da grup yok, örn. 2 yaşlı Arap). */
export function tjkGrupId(irk: "INGILIZ" | "ARAP", yas: number): number | null {
  if (!Number.isFinite(yas) || yas < 2) return null;
  if (irk === "INGILIZ") return yas === 2 ? 1 : yas === 3 ? 3 : 5; // 2 yaşlı İng / 3 yaşlı İng / 4 ve yukarı İng
  if (yas === 2) return null; // Aygır listesinde "2 yaşlı Arap" yok
  return yas === 3 ? 6 : yas === 4 ? 8 : 10; // 3 yaşlı Arap / 4 yaşlı Arap / 5 ve yukarı Arap
}
/** Yarış yüzeyi → TJK PistId. */
export function tjkPistId(surface: string): number | null { return surface === "CIM" ? 1 : surface === "KUM" ? 2 : surface === "SENTETIK" ? 4 : null; }

/** "TOUGH GUY: 27 koşu, 11 birinci (%40.7) · Ref %38.1 · Δ +2.6 pp · Güven %13 · Etkin +0.34 · Nötr" — metin gösterimi. */
export function buildPedigriBaglamMetni(ad: string, etiket: string, b: PedigriBaglam): string {
  const f = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;
  return `${ad} ${etiket}: ${b.ctxWin}/${b.ctxStart} (%${(b.ctxK * 100).toFixed(1)}) · Ref %${(b.refK * 100).toFixed(1)} · Δ ${f(b.delta * 100)} pp · Güven %${Math.round(b.guven * 100)} · Etkin ${f(b.etkinPp)} · ${b.durum}`;
}

/** MESAFE BANTLARI (kullanıcı kararı 2026-11-15, hibrit kural): 1 = 1000–1300 (sprint), 2 = 1400–1600 (orta/mil), 3 = 1700–2000 (orta-uzun), 4 = 2100+ (stayer).
 *  "Eşdeğer geçmiş mesafe": aynı bant içindeyse ±200 m, bant atlıyorsa yalnız ±100 m tolere edilir. Geçmişinde bugünkü mesafeye eşdeğer hiç koşusu yoksa "ilk defa bu mesafede". */
export const MESAFE_TOLERANS_AYNI_BANT_M = 200;
export const MESAFE_TOLERANS_BANT_ATLAR_M = 100;
export function mesafeBandi(m: number): 1 | 2 | 3 | 4 { return m <= 1300 ? 1 : m <= 1600 ? 2 : m <= 2000 ? 3 : 4; }
/** Geçmiş koşu mesafesi (onc) bugünkü mesafeye (bugun) eşdeğer mi? (sınırlar DAHİL: 1400↔1600 aynı bantta 200 m → eşdeğer; 1600↔1800 bant atlar, 200 m > 100 → eşdeğer değil) */
export function mesafeEsdeger(onc: number, bugun: number): boolean {
  const tol = mesafeBandi(onc) === mesafeBandi(bugun) ? MESAFE_TOLERANS_AYNI_BANT_M : MESAFE_TOLERANS_BANT_ATLAR_M;
  return Math.abs(onc - bugun) <= tol;
}
