// ROTAGANYAN ANALİZ MOTORU v1.0 — SINIF ailesi: classType ayrıştırıcı.
//
// Kullanıcının paylaştığı gerçek TJK kural dokümanına (2026-10-17) dayanır — tek bir
// doğrusal merdiven DEĞİL, yapısal bir sınıflandırma. Kullanıcının istediği TAM alan
// şeması: classFamily, classLevel, handicapDivision, restrictions, rawClassType,
// parseStatus.
//
// KRİTİK BULGU #1: Handikap Puanı (HP) YARIŞIN değil ATIN özelliğidir (kullanıcı
// düzeltmesi, TJK tanımına dayanıyor) — classType string'inden ("Handikap 15") çıkan
// classLevel, YARIŞIN kabul aralığı kategorisidir; HP, her atın HorseRaceHistoryCache
// satırındaki AYRI `hp` alanından gelir ve İKİSİ TEK DEĞİŞKENE İNDİRGENMEZ. Gerçek
// veriyle doğrulandı (2026-10-17): aynı atın farklı satırlarındaki HP değerleri GERÇEKTEN
// farklı (ör. bir at 14-19 farklı HP değeri taşıyor, tek bir "güncel" değer tekrarı DEĞİL)
// — yani her satırın `hp`'si o YARIŞA ÖZGÜ, tarihsel olarak doğru bir değer (bkz. hiz.ts
// ve sinif.ts'teki kullanım — bugünkü HP asla geçmiş bir yarışa taşınmaz).
//
// KRİTİK BULGU #2 (gerçek 319 değere karşı test edilerek bulundu): `/i` regex bayrağı VE
// toLocaleUpperCase("tr-TR") AYRI AYRI Türkçe ı/I/İ/i dörtlüsünü güvenilir eşlemiyor —
// normalize() bu dördünü TEK kanonik harfe ('I') katlar, tüm regex'ler yalnız düz ASCII
// 'I' kullanır.

export type ClassFamily =
  | "MAIDEN_SARTLI1"
  | "SARTLI"
  | "SARTLI_OZEL"
  | "HANDIKAP"
  | "KV"
  | "GRUP_ACIK"
  | "SATIS"
  | "AMATOR"
  | "UNKNOWN";

export type ParseStatus = "PARSED" | "PARTIAL" | "UNKNOWN";

export interface ParsedClass {
  rawClassType: string;
  classFamily: ClassFamily;
  classLevel: number | null;
  handicapDivision: "H1" | "H2" | "H3" | null;
  isHandicapStyle: boolean;
  restrictions: string[]; // ör. ["DHÖW","Dişi"] — ham bayrak listesi, anlamları TAM doğrulanmadı
  parseStatus: ParseStatus;
}

const GRUP_RE = /^(G|A)\s*([1-3])\b/;
const HANDIKAP_RE = /HANDIKAP\s*(\d+)?/;
const SARTLI_RE = /ŞARTLI\s*(\d+)/;
const KV_RE = /KV-?(\d+)/;
const SATIS_RE = /SATIŞ\s*(\d+)?/; // Ş, Türkçe ı/I/İ/i dörtlüsünden AYRI bir harf — normalize() ona dokunmaz, pattern'de de Ş aynen kalır
const HANDIKAP_TIER_RE = /\/H([1-3])\b/;

// Doğrulanmış yazım varyantları (kullanıcı talimatı: "Sartli ve Satis gibi doğrulanmış
// yazım varyantları kontrollü eşanlamlılar listesine alınabilir") — YALNIZ bu TAM
// string'ler için, başka hiçbir serbest-metin eşlemesi YAPILMAZ.
const KNOWN_TYPOS: Record<string, string> = {
  SARTLI: "ŞARTLI 1", // tek başına "Sartli" (seviyesiz, diyakritiksiz) — Şartlı-1 ile AYNI giriş seviyesi varsayılır
  SATIS: "SATIŞ", // "Satis" (diyakritiksiz) — eksik Ş eklenir
};

function normalize(raw: string): string {
  return raw
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I");
}

/** Ham classType metnini yapısal bir sınıflandırmaya çevirir. Ayrıştırılamayan HER şey
 *  dürüstçe UNKNOWN olarak işaretlenir — tahmini bir kategoriye ZORLANMAZ. */
export function parseClassType(rawClassType: string): ParsedClass {
  let t = normalize(rawClassType);
  if (t in KNOWN_TYPOS) t = normalize(KNOWN_TYPOS[t]);

  const restrictions: string[] = [];
  if (/DHÖW|DHÖ\b/.test(t)) restrictions.push("DHÖW");
  if (/DIŞI/.test(t)) restrictions.push("Dişi");
  if (/ERKEK/.test(t)) restrictions.push("Erkek");
  if (/DHT\b/.test(t)) restrictions.push("DHT");
  if (/ULS/.test(t)) restrictions.push("ULS");

  let handicapDivision: "H1" | "H2" | "H3" | null = null;
  const tierMatch = HANDIKAP_TIER_RE.exec(t);
  if (tierMatch) handicapDivision = (`H${tierMatch[1]}`) as "H1" | "H2" | "H3";

  const base = { rawClassType, handicapDivision, restrictions };

  if (t === "" || t === "—" || t === "-") {
    return { ...base, classFamily: "UNKNOWN", classLevel: null, isHandicapStyle: false, parseStatus: "UNKNOWN" };
  }

  const grupMatch = GRUP_RE.exec(t);
  if (grupMatch) {
    return { ...base, classFamily: "GRUP_ACIK", classLevel: Number(grupMatch[2]), isHandicapStyle: false, parseStatus: "PARSED" };
  }

  const handikapMatch = HANDIKAP_RE.exec(t);
  if (handikapMatch) {
    const classLevel = handikapMatch[1] ? Number(handikapMatch[1]) : null;
    return {
      ...base,
      classFamily: "HANDIKAP",
      classLevel,
      isHandicapStyle: true,
      parseStatus: classLevel == null ? "PARTIAL" : "PARSED", // seviyesiz "Handikap" — kategori bilinir, seviye bilinmez
    };
  }

  const kvMatch = KV_RE.exec(t);
  if (kvMatch) {
    const classLevel = Number(kvMatch[1]);
    const isHandicapStyle = [21, 22, 24].includes(classLevel);
    return { ...base, classFamily: "KV", classLevel, isHandicapStyle, parseStatus: "PARSED" };
  }

  const sartliOzelMatch = /ŞARTLI\s*(19|27)\b/.exec(t);
  if (sartliOzelMatch) {
    return { ...base, classFamily: "SARTLI_OZEL", classLevel: Number(sartliOzelMatch[1]), isHandicapStyle: false, parseStatus: "PARSED" };
  }

  const sartliMatch = SARTLI_RE.exec(t);
  if (sartliMatch) {
    const classLevel = Number(sartliMatch[1]);
    if (classLevel === 1) return { ...base, classFamily: "MAIDEN_SARTLI1", classLevel: 1, isHandicapStyle: false, parseStatus: "PARSED" };
    return { ...base, classFamily: "SARTLI", classLevel, isHandicapStyle: false, parseStatus: "PARSED" };
  }

  if (/^MAIDEN/.test(t)) {
    return { ...base, classFamily: "MAIDEN_SARTLI1", classLevel: null, isHandicapStyle: false, parseStatus: "PARSED" };
  }

  if (SATIS_RE.test(t)) {
    const m = SATIS_RE.exec(t);
    return { ...base, classFamily: "SATIS", classLevel: m?.[1] ? Number(m[1]) : null, isHandicapStyle: false, parseStatus: m?.[1] ? "PARSED" : "PARTIAL" };
  }

  if (/AMATÖR/.test(t)) {
    return { ...base, classFamily: "AMATOR", classLevel: null, isHandicapStyle: false, parseStatus: "PARSED" };
  }

  return { ...base, classFamily: "UNKNOWN", classLevel: null, isHandicapStyle: false, parseStatus: "UNKNOWN" };
}

/** Kullanıcının dokümanındaki GERÇEK TJK HP bantları — yarışın (classLevel) kabul
 *  aralığı. HP'nin kendisi ATA ait (bkz. dosya başı notu), bu tablo yalnız REFERANS/
 *  çapraz-doğrulama amaçlıdır — bir atın HP'sini bu bantlara göre "düzeltmek" İÇİN
 *  KULLANILMAZ. */
export const HANDIKAP_HP_BANTLARI: Record<number, { min: number; max: number }> = {
  13: { min: 1, max: 50 },
  14: { min: 1, max: 65 },
  15: { min: 1, max: 75 },
  16: { min: 30, max: 85 },
  17: { min: 40, max: 100 },
  21: { min: 45, max: 120 },
  22: { min: 45, max: 120 },
  24: { min: 45, max: 120 },
};

/** Bir atın (yarışın DEĞİL) o geçmiş yarıştaki HP'si — tarihsel olarak doğru, bugünkü
 *  HP'den BAĞIMSIZ (gerçek veriyle doğrulandı, bkz. dosya başı notu). */
export function parseHp(hp: string): number | null {
  const n = parseInt(hp.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
