import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Silence Prisma/pg edge runtime warnings
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

// TR/EN dil desteği (Aşama 1, 2026-08-01) — URL'de [locale] segmenti YOK (çerez-bazlı,
// bkz. src/i18n/request.ts), bu yüzden next-intl'in routing/middleware katmanı değil
// yalnız request-config eklentisi kullanılıyor.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
