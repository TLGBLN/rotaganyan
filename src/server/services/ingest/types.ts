import type { Breed, Surface } from "@prisma/client";

export type IngestRunner = {
  no: number;
  name: string;
  sire?: string;
  dam?: string;
  damSire?: string;
  jockey?: string;
  trainer?: string;
  startNo?: number;
  // TJK program sayfasında "St" (start sayısı) sütununun yanında turuncu "DS" işareti —
  // at kendi tercihiyle dıştan başlayacak anlamına gelir, olumlu bir etken olabilir.
  disaridanStart?: boolean;
  weight?: number;
  weightChange?: number;
  equipment?: string;
  agf?: number;
  recentForm?: string;
  age?: string;
  owner?: string;
  hp?: number;
  bestTime?: string;
  recentFormSurfaces?: string;
  scratched?: boolean;
  ekuriGroup?: number;
  apprentice?: boolean;
  tjkAtId?: number;
};

export type IngestGallop = {
  runnerNo: number;
  date: Date;
  track?: string;
  form?: string;
  splits: Record<string, string>;
};

export type IngestRace = {
  raceNo: number;
  time?: string;
  classType: string;
  breed: Breed;
  surface: Surface;
  distance: number;
  conditions?: string;
  ageWeight?: string;
  trackRecord?: string;
  runners: IngestRunner[];
  gallops: IngestGallop[];
};

export type IngestSurfaceCondition = { label: string; detail: string };

export type IngestRaceDay = {
  date: Date;
  hippodromeSlug: string;
  hippodromeName: string;
  races: IngestRace[];
  surfaceConditions?: IngestSurfaceCondition[];
  weather?: string;
};

export type IngestResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  errors: string[];
};
