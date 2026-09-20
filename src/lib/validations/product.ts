import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).max(1_000_000),
  image: z.string().url().optional().or(z.literal("")),
  category: z.string().max(50).optional(),
  stock: z.number().int().min(0).max(1_000_000).default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
