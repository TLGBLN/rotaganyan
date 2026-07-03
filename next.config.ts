import type { NextConfig } from "next";

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

export default nextConfig;
