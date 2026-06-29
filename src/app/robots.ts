import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

/** Analiz/tahmin verisi içeren yollar — AI/scraper botlarının toplu veri çekmesini engellemek için. */
const ANALYSIS_PATHS = ["/kosular/", "/analizler/", "/tahmin-onerileri/", "/istatistik/"];

/** Bilinen AI eğitim/scraping botları — robots.txt'e uyan tüm crawler'ları kapsar. */
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "Google-Extended",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Applebot-Extended",
  "Diffbot",
  "YouBot",
  "Omgilibot",
  "FacebookBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/panel/", "/api/"],
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        disallow: ANALYSIS_PATHS,
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
