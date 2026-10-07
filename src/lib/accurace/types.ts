// Accurace özellik mimarisi — tipler. Saf modül: veri erişimi yok.

export type Surface = "CIM" | "KUM" | "SENTETIK";
export type Breed = "ARAP" | "INGILIZ";

export interface Checkpoint {
  checkpoint: number; // metre, başlangıçtan
  timeReal: number; // ms
  place: number; // o noktadaki sıra (1 = lider)
}

// Geç segment (LateSegment) kayıp nedenleri
export type LateReason = "NO_COMMON_CHECKPOINT" | "NO_LATE_SCALE";

// Bir atın bir geçmiş yarışı. tjkAtId ile birleştirilir (Runner.id yarış girişine özgü, kullanılmaz).
export interface AccuraceRun {
  tjk: number;
  date: Date;
  length: number; // m
  surface: Surface | null;
  breed: Breed | null; // Race.breed (yarış düzeyi)
  hippodrome: string | null; // AccuraceRace.hippodrome
  going: string | null; // TJK pist durumu (TjkDereceKaydi, at+tarih eşleşmesiyle; yarış düzeyinde çoğunluk)
  place: number; // finiş sırası
  fieldSize: number; // gerçek saha (split sayısı)
  finishMs: number;
  checkpoints: Checkpoint[];
  // LateSegment: yarışa ORTAK checkpoint üzerinden hesaplanır (tüm atlar aynı CP_r'yi kullanır)
  lateSegMs: number | null; // finishMs − timeAt(CP_r)
  lateSegScore: number | null; // (median − lateSegMs)/(1.4826·MAD), N≥5 ve MAD>eşik ise
  lateSegReason: LateReason | null;
  // Stil: yarışın ilk çeyreğindeki sıra kovası (0 kaçak … 5 geri); yoksa null
  earlyBin: number | null;
}

// Tahmin edilen yarış (as-of): yalnız raceDate'ten önceki geçmiş kullanılır.
export interface TargetRace {
  date: Date;
  length: number;
  surface: Surface | null;
}

// Skaler özellik sözleşmesi
export interface Feature {
  raw: number | null;
  observed: boolean;
  reliability: number; // [0,1]
  nUsed: number;
  effectiveN: number;
  missingReason: "NO_PRIOR_RUN" | "NO_USABLE_CHECKPOINTS" | "NO_LATE_SEG" | "NO_BASELINE" | "NO_CLOSING_BASELINE" | "NO_STYLE_HISTORY" | "NO_RIVAL_STYLE" | null;
}

// Stil vektörü sözleşmesi (6 kova olasılığı)
export interface StyleFeature {
  vec: number[] | null;
  observed: boolean;
  reliability: number;
  effectiveN: number;
  missingReason: Feature["missingReason"];
}
