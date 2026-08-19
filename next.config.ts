import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

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

  // v6.109 — kullanıcı talebi 2026-08-11 ("uçtan uca dışarıdan gelebilecek tüm
  // saldırılara karşı koruyucu önlemler al"): hiçbir güvenlik header'ı yoktu.
  // Burada YALNIZ kırılma riski taşımayan, evrensel güvenli olanlar eklendi
  // (clickjacking/MIME-sniffing/referrer sızıntısı/tarayıcı izin suistimali).
  // Content-Security-Policy BİLEREK eklenmedi — Stripe Checkout, Supabase
  // görselleri, next-intl gibi entegrasyonları kırma riski var ve bu ortamda
  // gerçek tarayıcıda test edilemiyor; ayrı, dikkatli (report-only ile başlayan)
  // bir adım olarak ele alınmalı.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

// TR/EN dil desteği (Aşama 1, 2026-08-01) — URL'de [locale] segmenti YOK (çerez-bazlı,
// bkz. src/i18n/request.ts), bu yüzden next-intl'in routing/middleware katmanı değil
// yalnız request-config eklentisi kullanılıyor.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Sentry — 2026-08-19 kullanıcı talebi: "Bir Sorun Oluştu" hatası bazen mobil/web'de
// çıkıyordu ama hiçbir yere kaydedilmiyordu (error.tsx yalnız console.error yapıyordu,
// kullanıcının kendi tarayıcı konsolu dışında iz kalmıyordu). SENTRY_AUTH_TOKEN
// ayarlanmadıkça source map yüklemesi sessizce atlanır (build kırılmaz) — DSN de
// ayarlanmadıkça Sentry SDK'sı kendi kendine devre dışı kalır (bkz. instrumentation*.ts).
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableLogger: true,
});
