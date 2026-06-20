import { z } from "zod";

export const resultSchema = z.object({
  raceId: z.string().cuid(),
  actualOrder: z.array(z.string()).min(1).max(30),
  winnerNo: z.number().int().min(1).max(30).optional(),
  hitTop1: z.boolean().default(false),
  hitInCoupon: z.boolean().default(false),
  hitRanks: z
    .object({
      g2: z.boolean().optional(),
      g3: z.boolean().optional(),
      g4: z.boolean().optional(),
      g5: z.boolean().optional(),
    })
    .optional(),
  errorTag: z.string().max(50).optional(),
  errorNote: z.string().max(1000).optional(),
  cikan: z.string().max(300).optional(),
});

export const postMortemLessonSchema = z.object({
  title: z.string().min(3).max(200),
  date: z.coerce.date(),
  category: z.enum([
    "DERECE", "SICIL_KILO", "AGF", "TEMPO", "TUM_ATLAR",
    "BANKO", "JOKEY", "GALOP", "TAKI", "GRUP", "GENEL",
  ]),
  rule: z.string().min(10).max(1000),
  raceRef: z.string().max(200).optional(),
  resultId: z.string().cuid().optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

export type ResultInput = z.infer<typeof resultSchema>;
export type PostMortemLessonInput = z.infer<typeof postMortemLessonSchema>;
