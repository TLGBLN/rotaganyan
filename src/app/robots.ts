import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

/** Analiz/tahmin verisi içeren yollar — AI/scraper botlarının toplu veri çekmesini engellemek için. */
const ANALYSIS_PATHS = ["/kosular/", "/analizler/", "/tahmin-onerileri/", "/istatistik/"];

/** Bilinen AI eğitim/scraping botları — robots.txt'e uyan tüm crawler'ları kapsar.
 *  "ChatGPT-User" hariç: bu, kullanıcının kendi ChatGPT sohbetinde bir linki
 *  okumasını istediğinde tetiklenen anlık istek — GPTBot gibi toplu eğitim
 *  taraması değil, bu yüzden analiz sayfalarından engellenmiyor. */
const AI_BOTS = [
  "GPTBot",
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

// Link paylaşımında önizleme kartı (Open Graph image) çekmek için siteyi ziyaret eden
// botlar — bunlar toplu tarama yapmaz, bir insan link paylaştığında tek seferlik istek
// atar. Genel "/api/" yasağının altında ezilmemeleri için ayrı, tam açık bir kural
// veriyoruz — "en spesifik yol kazanır" mantığına güvenmek yerine kesin çözüm.
const LINK_PREVIEW_BOTS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "WhatsApp",
  "Discordbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/panel/", "/api/"],
      },
      ...LINK_PREVIEW_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
      })),
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        disallow: ANALYSIS_PATHS,
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
