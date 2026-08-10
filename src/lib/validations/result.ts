import { z } from "zod";

export const resultSchema = z.object({
  raceId: z.string().cuid(),
  actualOrder: z.array(z.string()).min(1).max(30),
  winnerNo: z.number().int().min(1).max(30).optional(),
  winnerNos: z.array(z.number().int().min(1).max(30)).min(1).optional(), // at başı/beraberlik — birden fazla kazanan
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

export type ResultInput = z.infer<typeof resultSchema>;
