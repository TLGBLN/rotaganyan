import { z } from "zod";

export const hippodromeSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

export const raceDaySchema = z.object({
  date: z.coerce.date(),
  hippodromeId: z.string().cuid(),
});

export const raceSchema = z.object({
  raceDayId: z.string().cuid(),
  raceNo: z.number().int().min(1).max(20),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  classType: z.string().min(1).max(100),
  breed: z.enum(["ARAP", "INGILIZ"]),
  surface: z.enum(["CIM", "KUM", "SENTETIK"]),
  distance: z.number().int().min(800).max(3200),
  conditions: z.string().max(500).optional(),
  ageWeight: z.string().max(100).optional(),
  trackRecord: z.string().max(100).optional(),
});

export const runnerSchema = z.object({
  raceId: z.string().cuid(),
  no: z.number().int().min(1).max(30),
  name: z.string().min(1).max(100),
  sire: z.string().max(100).optional(),
  dam: z.string().max(100).optional(),
  damSire: z.string().max(100).optional(),
  pedigreeNote: z.string().max(1000).optional(),
  pedigreeUrl: z.string().url().optional().or(z.literal("")),
  jockey: z.string().max(100).optional(),
  trainer: z.string().max(100).optional(),
  startNo: z.number().int().min(1).max(30).optional(),
  weight: z.number().min(40).max(80).optional(),
  weightChange: z.number().min(-10).max(10).optional(),
  equipment: z.string().max(50).optional(),
  equipmentAdded: z.string().max(50).optional(),
  equipmentRemoved: z.string().max(50).optional(),
  sameJockey: z.boolean().default(false),
  agf: z.number().min(0).max(100).optional(),
  raceStyle: z
    .object({
      kacak: z.number().min(0).max(100),
      onGrupArkasi: z.number().min(0).max(100),
      bekleme: z.number().min(0).max(100),
      enGeri: z.number().min(0).max(100),
    })
    .optional(),
});

export const gallopSchema = z.object({
  runnerId: z.string().cuid(),
  date: z.coerce.date(),
  track: z.string().max(50).optional(),
  surface: z.enum(["CIM", "KUM", "SENTETIK"]).optional(),
  jockey: z.string().max(100).optional(),
  form: z.enum(["R", "CR", "HC", "C", "Kenter"]).optional(),
  splits: z.record(z.string(), z.string()),
});

export type HippodromeInput = z.infer<typeof hippodromeSchema>;
export type RaceDayInput = z.infer<typeof raceDaySchema>;
export type RaceInput = z.infer<typeof raceSchema>;
export type RunnerInput = z.infer<typeof runnerSchema>;
export type GallopInput = z.infer<typeof gallopSchema>;
