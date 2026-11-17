// V7 SIFIRDAN MOTOR — ÖZELLİK KABUL PROTOKOLÜ (SAF, DB'siz, canlı koddan HİÇBİR ŞEY import etmez). 2026-11-17 kullanıcı kararı: eski sinyal/katsayı taşınmaz; her yeni özellik
// (1) gerçek YARIŞ ÖNCESİ (as-of) veriyle hesaplanmalı ve (2) geçmiş yarışlarda, YALNIZ geçmişten geleceğe kronolojik testte katkısını kanıtlamalı. Aksi halde motora GİRMEZ.
//
// KABUL KURALI (önceden sabit): aday X, mevcut kabul edilmiş S kümesine eklenirse, SEÇİM dönemindeki ileri test yarışlarında yarış-bazlı kazanç g = L(S) − L(S ∪ X) için
//   (a) ortalama g > 0 ve paired bootstrap %95 GA alt sınırı > 0,   (b) kat-ortalamalarının en az `minKat`'ı pozitif (kararlılık),   (c) as-of beyanı doğrulanmış (asOfKaniti = true).
// Seçim ile nihai değerlendirme AYRI dönemlerdedir; nihai dönem seçimde hiç kullanılmaz.
export type KabulGirdi = { kazanc: number[]; fold: number[]; asOfKaniti: boolean; minKat?: number; bootstrapB?: number; tohum?: number };
export type KabulSonuc = { kabul: boolean; ortalama: number; altGA: number; ustGA: number; pozitifKat: number; katSayisi: number; neden: string };

/** Deterministik (tohumlu) paired bootstrap; saf. */
export function bootstrapGA(deger: number[], B = 1000, tohum = 7): { m: number; lo: number; hi: number } {
  let sd = tohum; const rn = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const n = deger.length; const m = deger.reduce((p, q) => p + q, 0) / Math.max(1, n); if (n === 0) return { m: 0, lo: 0, hi: 0 };
  const bs: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += deger[Math.floor(rn() * n)]!; bs.push(s / n); } bs.sort((a, c) => a - c);
  return { m, lo: bs[Math.floor(0.025 * B)]!, hi: bs[Math.min(B - 1, Math.floor(0.975 * B))]! };
}

export function kabulKarari(g: KabulGirdi): KabulSonuc {
  const minKat = g.minKat ?? 2; const ci = bootstrapGA(g.kazanc, g.bootstrapB ?? 1000, g.tohum ?? 7);
  const katlar = [...new Set(g.fold)].sort((a, b) => a - b); const katOrt = katlar.map((k) => { const v = g.kazanc.filter((_, i) => g.fold[i] === k); return v.reduce((p, q) => p + q, 0) / Math.max(1, v.length); });
  const pozitifKat = katOrt.filter((v) => v > 0).length;
  const base = { ortalama: ci.m, altGA: ci.lo, ustGA: ci.hi, pozitifKat, katSayisi: katlar.length };
  if (!g.asOfKaniti) return { ...base, kabul: false, neden: "REDDEDİLDİ: yarış-öncesi (as-of) kanıtı yok" };
  if (g.kazanc.length === 0) return { ...base, kabul: false, neden: "REDDEDİLDİ: test yarışı yok" };
  if (!(ci.m > 0 && ci.lo > 0)) return { ...base, kabul: false, neden: "REDDEDİLDİ: kazanç anlamlı değil (GA alt sınırı ≤ 0)" };
  if (pozitifKat < minKat) return { ...base, kabul: false, neden: "REDDEDİLDİ: kat bazında kararsız (" + pozitifKat + "/" + katlar.length + " pozitif, gereken " + minKat + ")" };
  return { ...base, kabul: true, neden: "KABUL" };
}
