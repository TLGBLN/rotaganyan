"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Surface, Breed } from "@prisma/client";

export async function upsertRaceDay(hippodromeId: string, date: string) {
  await requireRole("EDITOR");

  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  return db.raceDay.upsert({
    where: { date_hippodromeId: { date: d, hippodromeId } },
    create: { date: d, hippodromeId },
    update: {},
  });
}

type RaceInput = {
  raceDayId: string;
  raceNo: number;
  time?: string;
  classType: string;
  breed: Breed;
  surface: Surface;
  distance: number;
  conditions?: string;
  ageWeight?: string;
  trackRecord?: string;
};

export async function upsertRace(input: RaceInput) {
  await requireRole("EDITOR");

  const race = await db.race.upsert({
    where: { raceDayId_raceNo: { raceDayId: input.raceDayId, raceNo: input.raceNo } },
    create: input,
    update: input,
  });

  revalidatePath("/admin/kosular");
  revalidatePath("/kosular");
  return race;
}

type RunnerInput = {
  raceId: string;
  no: number;
  name: string;
  sire?: string;
  dam?: string;
  damSire?: string;
  jockey?: string;
  trainer?: string;
  weight?: number;
  weightChange?: number;
  equipment?: string;
  equipmentAdded?: string;
  equipmentRemoved?: string;
  sameJockey?: boolean;
  agf?: number;
  pedigreeUrl?: string;
};

export async function upsertRunner(input: RunnerInput) {
  await requireRole("EDITOR");

  const runner = await db.runner.upsert({
    where: { raceId_no: { raceId: input.raceId, no: input.no } },
    create: input,
    update: input,
  });

  revalidatePath("/admin/kosular");
  return runner;
}
