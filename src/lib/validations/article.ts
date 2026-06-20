import { z } from "zod";

export const articleSchema = z.object({
  type: z.enum(["EDUCATIONAL", "MAGAZINE"]),
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(500).optional(),
  body: z.string().min(1),
  coverImage: z.string().url().optional().or(z.literal("")),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  ogImage: z.string().url().optional().or(z.literal("")),
});

export type ArticleInput = z.infer<typeof articleSchema>;
