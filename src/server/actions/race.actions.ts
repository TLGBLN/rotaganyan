"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Surface, Breed } from "@prisma/client";

export async function syncTodayResults(): Promise<{ synced: number; failed: number; errors: string[] }> {
  await requireRole("EDITOR");
  const { turkeyDateString } = await import("@/lib/tz");
  const { syncResultsForDate } = await import("@/server/services/result-sync");
  const today = turkeyDateString();
  const synced = 0; let failed = 0; const errors: string[] = [];
  try {
    await syncResultsForDate(today);
    revalidatePath("/admin");
    revalidatePath("/admin/sonuclar");
    return { synced: 1, failed: 0, errors: [] };
  } catch (e) {
    failed++;
    errors.push(e instanceof Error ? e.message : String(e));
    return { synced: 0, failed, errors };
  }
}

export async function forceIngestDate(date: string): Promise<{ runners: number }> {
  await requireRole("ADMIN");
  const { toTjkDate, ingestDate } = await import("@/server/services/ingest/tjk-info.adapter");
  const tjkDate = toTjkDate(new Date(date + "T00:00:00Z"));
  const result = await ingestDate(tjkDate);
  const runners = result.cities.reduce((s, c) => s + c.runners, 0);
  revalidatePath("/admin/kosular");
  revalidatePath("/program");
  revalidatePath("/altili");
  return { runners };
}

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
