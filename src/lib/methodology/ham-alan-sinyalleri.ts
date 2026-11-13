// 2026-11-13 — Runner program alanlarından türetilen 3 sinyal (fMean, kgsLog, sexE). Eğitim
// (arac-ham-alan-final.mts) ve canlı (v546-1-engine.ts gatherV461RawSinyaller) AYNI tanımı kullanır —
// train/serve tutarlılığı için tanım TEK yerde, saf fonksiyon olarak durur.
//
// Gerekçe (piyasa ne görüyor testi): kitle atın son 6 yarıştaki derecesini (recentForm, ör. "229810")
// fiyatlıyor; modelde bunun karşılığı yoktu (yalnız lastWon). KGS (koşmadığı gün) ve cins ayrıca
// kazanç getirdi. Alan seçimi yalnız DEV katlarında yapıldı, son 2 katta (CONFIRM) sınandı.

/** recentForm'un İLK 6 hanesindeki derecelerin ortalaması. '1'-'9' = o derece, '0' = 10. veya daha
 *  kötü (10 sayılır), diğer karakterler (D/-, vb.) atlanır. Hiç derece yoksa null (gözlemsiz). */
export function formOrtalamasi(recentForm: string | null | undefined): number | null {
  const rf = recentForm ?? "";
  const dereceler: number[] = [];
  for (let i = 0; i < Math.min(6, rf.length); i++) {
    const c = rf[i];
    if (c >= "1" && c <= "9") dereceler.push(Number(c));
    else if (c === "0") dereceler.push(10);
  }
  return dereceler.length ? dereceler.reduce((p, q) => p + q, 0) / dereceler.length : null;
}

/** log(1 + KGS) — KGS (koşmadığı gün sayısı) TJK program sütunu (Runner.tjkKgs). */
export function kgsLog(kgs: number | null | undefined): number | null {
  return kgs != null && Number.isFinite(kgs) && kgs >= 0 ? Math.log1p(kgs) : null;
}

/** Runner.age ("4y d a" biçimi: yaş, renk, cins) alanının 3. kelimesi 'e' ise 1, başka bir değerse 0;
 *  3. kelime yoksa null. */
export function cinsE(age: string | null | undefined): number | null {
  const tk = (age ?? "").trim().split(/\s+/);
  return tk[2] ? (tk[2] === "e" ? 1 : 0) : null;
}
