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
  weight?: number;
  weightChange?: number;
  equipment?: string;
  agf?: number;
  formaUrl?: string;
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

export type IngestRaceDay = {
  date: Date;
  hippodromeSlug: string;
  hippodromeName: string;
  races: IngestRace[];
};

export type IngestResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  errors: string[];
};
