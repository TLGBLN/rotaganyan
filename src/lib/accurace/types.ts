// Accurace özellik mimarisi — tipler. Saf modül: veri erişimi yok.

export type Surface = "CIM" | "KUM" | "SENTETIK";

export interface Checkpoint {
  checkpoint: number; // metre, başlangıçtan
  timeReal: number; // ms
  place: number; // o noktadaki sıra (1 = lider)
}

// Bir atın bir geçmiş yarışı. tjkAtId ile birleştirilir (Runner.id yarış girişine özgü, kullanılmaz).
export interface AccuraceRun {
  tjk: number;
  date: Date;
  length: number; // m
  surface: Surface | null;
  place: number; // finiş sırası
  fieldSize: number; // gerçek saha (split sayısı)
  finishMs: number;
  checkpoints: Checkpoint[];
  late800Ms: number | null; // son 800 m süresi (ms)
  lateScore: number | null; // yarış-içi (median − at)/(1.4826·MAD); pozitif = saha ortasından hızlı
}

// Tahmin edilen yarış (as-of): yalnız raceDate'ten önceki geçmiş kullanılır.
export interface TargetRace {
  date: Date;
  length: number;
  surface: Surface | null;
}

// Her özellik sözleşmesi
export interface Feature {
  raw: number | null;
  observed: boolean;
  reliability: number; // [0,1]
  nUsed: number;
  effectiveN: number;
  missingReason: "NO_PRIOR_RUN" | "NO_USABLE_CHECKPOINTS" | "NO_LATE800" | "NO_CONTEXT_BASELINE" | null;
}
