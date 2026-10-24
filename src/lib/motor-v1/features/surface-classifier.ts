// ROTAGANYAN ANALİZ MOTORU v1.0 — Zemin (surface) ayrıştırıcı.
//
// GERÇEK VERİ BULGUSU (2026-10-17, 300 at / 14.128 satırlık örneklemle doğrulandı):
// HorseRaceHistoryCache.rowsJson[].surface BASİT "Çim/Kum/Sentetik" DEĞİL — TJK'nın kendi
// kısaltma biçimi: "<harf>:<zemin durumu> [<going değeri>]":
//   K:Normal / K:Nemli / K:Islak / K:Sulu / K:            (Kum — going değeri YOK)
//   S:Normal / S:Nemli / S:Islak / S:Sulu / S:            (Sentetik — going değeri YOK)
//   Ç:Normal 3.3 / Ç:Yumuşak 3.5 / Ç:Ağır 4.6 / ...       (Çim — sayısal going değeri VAR)
// Bu harfler bugünkü Race.surface Prisma enum'ıyla (CIM/KUM/SENTETIK) AYNI aileyi temsil
// eder — çim/kum/sentetik OTOMATİK EŞDEĞER kabul EDİLMEZ (kullanıcı talimatı); yalnız AYNI
// harf AYNI zemin ailesi sayılır, zemin DURUMU (going) ayrı bir boyut olarak saklanır.

export type SurfaceFamily = "CIM" | "KUM" | "SENTETIK";
export type SurfaceParseStatus = "PARSED" | "UNKNOWN";

// PMZ düzeltme #5 (kullanıcı talimatı, 2026-10-17): zemin AİLESİNİN bilinmesi (parseStatus)
// ile zemin DURUMUNUN/going değerinin bilinmesi (condition/goingValue) AYRI boyutlardır.
// "K:" / "S:" gibi durum bilgisi BOŞ satırlar zemin ailesi açısından PARSED sayılır (K=Kum,
// S=Sentetik kesin biliniyor) ama condition=null KALIR — bu ASLA "Normal" ile DOLDURULMAZ
// (gerçek "Normal" yazan satırlardan AYIRT EDİLMELİ, bkz. surface-classifier.test.ts).

export type ParsedSurface = {
  rawSurface: string;
  surfaceFamily: SurfaceFamily | null;
  condition: string | null; // "Normal" | "Nemli" | "Islak" | "Sulu" | "Yumuşak" | "Ağır" | ...
  goingValue: number | null; // yalnız Çim'de gözlendi; Kum/Sentetik'te hep null
  parseStatus: SurfaceParseStatus;
};

const PREFIX_TO_FAMILY: Record<string, SurfaceFamily> = {
  Ç: "CIM",
  K: "KUM",
  S: "SENTETIK",
};

/** Prisma Surface enum'ına bire bir karşılık — zaten AYNI isimler, ayrı bir eşleme tablosu
 *  GEREKMEZ, yalnız tip-güvenli bir geçiş noktası olarak tutulur. */
export function surfaceFamilyToEnum(family: SurfaceFamily): "CIM" | "KUM" | "SENTETIK" {
  return family;
}

export function parseSurface(raw: string): ParsedSurface {
  const trimmed = (raw ?? "").trim();
  const m = /^([ÇKSçks]):\s*(.*)$/.exec(trimmed);
  if (!m) {
    return { rawSurface: raw, surfaceFamily: null, condition: null, goingValue: null, parseStatus: "UNKNOWN" };
  }
  const family = PREFIX_TO_FAMILY[m[1].toUpperCase()];
  const rest = m[2].trim();
  if (rest === "") {
    return { rawSurface: raw, surfaceFamily: family, condition: null, goingValue: null, parseStatus: "PARSED" };
  }
  const numMatch = /^(.*?)\s+(\d+(?:[.,]\d+)?)$/.exec(rest);
  if (numMatch) {
    const goingValue = Number(numMatch[2].replace(",", "."));
    return {
      rawSurface: raw,
      surfaceFamily: family,
      condition: numMatch[1].trim() || null,
      goingValue: Number.isFinite(goingValue) ? goingValue : null,
      parseStatus: "PARSED",
    };
  }
  return { rawSurface: raw, surfaceFamily: family, condition: rest, goingValue: null, parseStatus: "PARSED" };
}
