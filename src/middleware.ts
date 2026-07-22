import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { checkRateLimit, publicContentLimiter } from "@/lib/ratelimit";

const authMiddleware = NextAuth(authConfig).auth;

// API rotaları (/api/admin/*) kendi auth() + hasRole() kontrolünü yapıp temiz
// JSON 401 döndürüyor — middleware'in burada devreye girip giriş sayfasına
// yönlendirmesi istemci tarafındaki fetch().json() akışını bozar, o yüzden
// matcher'a dahil edilmedi.
//
// Halka açık analiz/tahmin sayfaları — yazılım/bot ile toplu veri çekmeyi (scraping)
// caydırmak için IP başına rate limit uygulanıyor (bkz. src/lib/ratelimit.ts). Bu
// yollarda kimlik doğrulama YOK, yalnız istek sıklığı sınırlanıyor.
const RATE_LIMITED_PREFIXES = [
  "/program",
  "/kosular",
  "/analizler",
  "/tahmin-onerileri",
  "/istatistik",
  "/rotaganyanpuantablosu",
  "/api/muhtemeller",
];

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (RATE_LIMITED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const { success } = await checkRateLimit(publicContentLimiter, clientIp(req));
    if (!success) {
      return NextResponse.json(
        { error: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin." },
        { status: 429 }
      );
    }
  }

  return (authMiddleware as unknown as (req: NextRequest) => Promise<Response>)(req);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/panel/:path*",
    "/program/:path*",
    "/kosular/:path*",
    "/analizler/:path*",
    "/tahmin-onerileri/:path*",
    "/istatistik/:path*",
    "/rotaganyanpuantablosu/:path*",
    "/api/muhtemeller/:path*",
  ],
};
