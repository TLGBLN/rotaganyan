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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // "/api/og/" özellikle izinli: X/Twitter, Facebook gibi platformların link
        // paylaşımında kart görselini (Open Graph image) çekebilmesi için gerekli —
        // yoksa robots.txt'teki genel "/api/" yasağı crawler'ı engelliyor.
        userAgent: "*",
        allow: ["/", "/api/og/"],
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
