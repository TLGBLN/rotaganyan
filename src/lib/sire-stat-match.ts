/**
 * Race.breed/surface/distance ↔ SireStatOwn/DamStatOwn.irk/pist/mesafe eşlemesi ve
 * at-babası (sire) isim eşleştirmesi — hem analiz motoru (veri-toplama.ts) hem de
 * herkese açık/admin pedigri görünümleri (race.service.ts, admin.service.ts)
 * TARAFINDAN paylaşılır, tek yerden bakım için.
 */

const TR_FOLD: Record<string, string> = {
  İ: "I", I: "I", ı: "I", i: "I",
  Ş: "S", ş: "S", Ğ: "G", ğ: "G",
  Ü: "U", ü: "U", Ö: "O", ö: "O",
  Ç: "C", ç: "C",
};

/** Case/aksan farklarını (İ/I/ı/i, Ş/Ğ/Ü/Ö/Ç) yok sayarak karşılaştırılabilir hale getirir —
 *  TJK'dan gelen "sire"/"dam" alanı farklı kaynaklarda birebir aynı yazılmayabilir. */
export function normalizeSireName(s: string): string {
  return s
    .split("")
    .map((ch) => TR_FOLD[ch] ?? ch.toUpperCase())
    .join("")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Race.distance (metre) → SireStatOwn/DamStatOwn'ın kullandığı 3 mesafe aralığından biri. */
export function mesafeBucket(distance: number): string {
  if (distance <= 1400) return "800-1400";
  if (distance <= 2000) return "1500-2000";
  return "2100-3200";
}

export function surfaceToPist(surface: string): string {
  if (surface === "CIM") return "Çim";
  if (surface === "KUM") return "Kum";
  return "Sentetik";
}

export function breedToIrk(breed: string): string {
  return breed === "ARAP" ? "ARAP" : "İNGİLİZ";
}

// rotaganyan'ın KENDİ Runner/Result verisinden hesaplanan aygır/kısrak istatistiği (bkz.
// SireStatOwn/DamStatOwn şema yorumu ve pedigri-own-stat.service.ts). v6.32'den önce
// hipodromx.com'dan elle yapıştırılan SireStat/DamStat (AEI + geniş tarihsel taban)
// "base" satırı, own-data ise ona eklenen tamamlayıcı sinyaldi. Kullanıcı kararı
// (2026-08-01): kendi verimizin pist×mesafe kırılımı AEI'den daha değerli görüldü,
// hipodromx analiz motorundan tamamen çıkarıldı — own-data artık TEK kaynak. hipodromx
// admin sayfaları (SireStat/DamStat, Aygır/Kısrak İstatistik) kod tabanında duruyor ama
// analiz akışına artık girmiyor.

// 2026-08-02: kullanıcı kararı — sabit "n<3 ise gösterme" eşiği KALDIRILDI (§II.1/
// [[feedback_sert_kosul_yasak]] ile tutarlı: hiçbir kural sabit eşikle Claude'un elindeki
// veriyi analiz dışı bırakamaz — 1-2 startlık bir eşleşme bile NÖTR bir veri noktasıdır,
// yokluk değil). Artık her eşleşme (start≥1) formatlanıp Claude'a gidiyor, yalnız
// örneklem küçükse etiketle açıkça işaretleniyor — "veriyi gizleme, güvenilirliğini söyle."

// 2026-07-24: kullanıcı isteği — "5 yarışta %100 ile 200 yarışta %25 aynı değerlendirilmez."
// Her yüzdenin yanına örneklem büyüklüğüne göre bir güven etiketi ekleniyor. Eşikler
// pedigri istatistiği için kaba ama makul bir ayrım: <3 yarış tek-iki sonuca dayanır
// (tesadüf payı çok yüksek), <10 yine düşük güvenilir, ≥50 istikrarlı bir eğilim sayılır.
function ornekGuveniEtiketi(n: number): string {
  if (n < 3) return " [ÇOK DÜŞÜK ÖRNEKLEM]";
  if (n < 10) return " [DÜŞÜK ÖRNEKLEM]";
  if (n >= 50) return " [geniş örneklem]";
  return "";
}

export type SireStatOwnLite = { sireName: string; start: number; birinci: number; ikinci: number; ucuncu: number; kYuzde: number };
export type DamStatOwnLite = {
  damName: string; damSireName: string;
  start: number; birinci: number; ikinci: number; ucuncu: number; kYuzde: number;
  yavruSayisi: number; kazananYavruSayisi: number;
};

/** Claude'a ve UI'a gösterilecek okunabilir tek satır özet — örneklem küçük olsa bile (§II.1) gösterilir, yalnız etiketlenir. */
export function formatSireStatOzet(s: SireStatOwnLite, mesafe: string, pist: string): string {
  return `${s.sireName} (${pist} ${mesafe}) — kendi verimiz: ${s.start} start 1.${s.birinci}(K% ${s.kYuzde}${ornekGuveniEtiketi(s.start)}) 2.${s.ikinci} 3.${s.ucuncu}`;
}

/** Kısrak eşleştirmesi ANNE + ANNE BABASI birlikte — örneklem küçük olsa bile (§II.1) gösterilir, yalnız etiketlenir. */
export function formatDamStatOzet(s: DamStatOwnLite, mesafe: string, pist: string): string {
  const tayOrani = s.yavruSayisi > 0 ? Math.round((s.kazananYavruSayisi / s.yavruSayisi) * 100) : null;
  const tayStr = tayOrani != null ? ` · Kazanan tay oranı %${tayOrani} (${s.kazananYavruSayisi}/${s.yavruSayisi} yavru)` : "";
  return `${s.damName} / ${s.damSireName} (${pist} ${mesafe}) — kendi verimiz: ${s.start} start 1.${s.birinci}(K% ${s.kYuzde}${ornekGuveniEtiketi(s.start)}) 2.${s.ikinci} 3.${s.ucuncu}${tayStr}`;
}

export type DamSireStatOwnLite = {
  damSireName: string; start: number; birinci: number; ikinci: number; ucuncu: number; kYuzde: number;
  torunSayisi: number; kazananTorunSayisi: number;
};

// Damsire'nin (kısrağın babası) TEK BAŞINA etkisi — hipodromx bunu hiç vermiyor (dam+damsire
// hep birlikte), o yüzden yalnızca kendi verimiz varsa gösterilir, hiçbir "base" satırı yok
// (bkz. DamSireStatOwn şema yorumu, kullanıcı doktrini 2026-07-26).
export function formatDamSireStatOzet(s: DamSireStatOwnLite, mesafe: string, pist: string): string {
  const torunOrani = s.torunSayisi > 0 ? Math.round((s.kazananTorunSayisi / s.torunSayisi) * 100) : null;
  const torunStr = torunOrani != null ? ` · Kazanan torun oranı %${torunOrani} (${s.kazananTorunSayisi}/${s.torunSayisi} farklı torun)` : "";
  return `${s.damSireName} — kısrak babası olarak TÜM yavrularından (${pist} ${mesafe}), kendi verimiz: ${s.start} start, K% ${s.kYuzde}${ornekGuveniEtiketi(s.start)} (${s.birinci}/${s.start})${torunStr}`;
}
