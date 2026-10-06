// V5.46.1 feature sözleşmesi. Eksik değer 0 değildir; katkısı 0'dır.

export type MissingReason =
  | "NO_HISTORY"
  | "NO_PRE_RACE_HISTORY"
  | "INVALID_RAW_DATA"
  | "NO_BASELINE"
  | "SOURCE_MISSING"
  | "TIMESTAMP_UNKNOWN"
  | "POST_START"
  | null;

export interface FeatureValue {
  raw: number | null;
  observed: boolean;
  reliability: number; // 0..1
  sourceCount: number;
  missingReason: MissingReason;
}

export const MISSING: FeatureValue = {
  raw: null,
  observed: false,
  reliability: 0,
  sourceCount: 0,
  missingReason: "SOURCE_MISSING",
};

// Gözlemli değer: raw sonlu olmalı; reliability [0,1] aralığında.
export function observedValue(raw: number, reliability: number, sourceCount: number): FeatureValue {
  if (!Number.isFinite(raw)) return { ...MISSING, missingReason: "INVALID_RAW_DATA" };
  const r = Math.min(1, Math.max(0, reliability));
  return { raw, observed: true, reliability: r, sourceCount, missingReason: null };
}

// Sınıf ailesi (V5.46.1). Handikap dahil hiçbir aile feature'ı elle sıfırlanmaz.
export type RaceFamily = "HANDICAP" | "CONDITIONS" | "MAIDEN" | "KV_STAKES" | "GROUP" | "SALES" | "OTHER";

export function classFamilyFromKategori(kategori: string): RaceFamily {
  switch (kategori) {
    case "2": return "HANDICAP";
    case "1a": return "CONDITIONS";
    case "1b": return "MAIDEN";
    case "4": return "GROUP";
    case "5": return "SALES";
    case "3": return "CONDITIONS";
    default: return "OTHER";
  }
}
