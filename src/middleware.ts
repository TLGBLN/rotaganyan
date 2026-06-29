import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

// API rotaları (/api/admin/*) kendi auth() + hasRole() kontrolünü yapıp temiz
// JSON 401 döndürüyor — middleware'in burada devreye girip giriş sayfasına
// yönlendirmesi istemci tarafındaki fetch().json() akışını bozar, o yüzden
// matcher'a dahil edilmedi.
export const config = {
  matcher: ["/admin/:path*", "/panel/:path*"],
};
