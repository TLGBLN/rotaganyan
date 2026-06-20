import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { format } from "date-fns";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, raceDays] = await Promise.all([
    db.article.findMany({
      where: { published: true },
      select: { slug: true, type: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.raceDay.findMany({
      include: { hippodrome: true },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1 },
    { url: `${BASE}/kosular`, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/analizler`, priority: 0.8, changeFrequency: "daily" },
    { url: `${BASE}/istatistik`, priority: 0.7, changeFrequency: "weekly" },
    { url: `${BASE}/rehber`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/magazin`, priority: 0.6, changeFrequency: "weekly" },
    { url: `${BASE}/hakkinda`, priority: 0.4 },
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/${a.type === "EDUCATIONAL" ? "rehber" : "magazin"}/${a.slug}`,
    lastModified: a.updatedAt,
    priority: 0.5,
  }));

  const raceDayPages: MetadataRoute.Sitemap = raceDays.map((rd) => ({
    url: `${BASE}/kosular/${format(rd.date, "yyyy-MM-dd")}/${rd.hippodrome.slug}`,
    lastModified: rd.date,
    priority: 0.6,
    changeFrequency: "daily" as const,
  }));

  return [...staticPages, ...articlePages, ...raceDayPages];
}
