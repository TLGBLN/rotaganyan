import { z } from "zod";

export const pickSchema = z.object({
  rank: z.number().int().min(1).max(6),
  runnerId: z.string().cuid().optional(),
  runnerLabel: z.string().min(1).max(100),
  score: z.number().int().min(1).max(10).optional(),
  details: z.array(z.string().min(1).max(300)).min(1).max(10),
  pedigreeRating: z
    .enum(["ZAYIF", "DUSUK", "ORTA", "GUCLU", "YUKSEK", "COK_YUKSEK", "SORU", "BILINMIYOR"])
    .default("BILINMIYOR"),
  isTarget: z.boolean().default(false),
});

export const predictionSchema = z.object({
  raceId: z.string().cuid(),
  confidence: z.enum(["DUSUK", "ORTA", "YUKSEK"]).default("ORTA"),
  notes: z.string().min(10).max(5000),
  tempo: z.string().max(500).optional(),
  couponNarrow: z.string().max(50).optional(),
  couponNormal: z.string().max(100).optional(),
  couponWide: z.string().max(150).optional(),
  isBanko: z.boolean().default(false),
  bankoNote: z.string().max(300).optional(),
  picks: z.array(pickSchema).min(1).max(6),
});

export const publishChecklistSchema = z.object({
  checkDerece: z.boolean(),
  checkSicilKilo: z.boolean(),
  checkAgf: z.boolean(),
  checkTempo: z.boolean(),
  checkTumAtlar: z.boolean(),
  checkBanko: z.boolean(),
}).refine(
  (data) => Object.values(data).every(Boolean),
  { message: "Yayım öncesi tüm 6 kontrol onaylanmalıdır" }
);

export type PickInput = z.infer<typeof pickSchema>;
export type PredictionInput = z.infer<typeof predictionSchema>;
export type PublishChecklist = z.infer<typeof publishChecklistSchema>;
