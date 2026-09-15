import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { checkRateLimit, loginLimiter } from "@/lib/ratelimit";

import { authConfig } from "@/auth.config";

function clientIpFromRequest(request?: Request): string {
  if (!request) return "unknown";
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// 2026-09-15 kullanıcı talebi ("beni hatırla butonu olsun, kullanıcı tekrar tekrar
// giriş yapmasın") — Auth.js'in JWT stratejisinde çerezin gerçek Max-Age'i (tarayıcı
// kapansa da hayatta kalıp kalmayacağı) `session.maxAge`'e göre TEK SEFERDE, sabit
// belirlenir — sign-in başına DEĞİŞTİRİLEMEZ. Bu yüzden `session.maxAge` en UZUN
// olası süreye (REMEMBER_ME_MAX_AGE) sabitlenip, "Beni hatırla" İŞARETLENMEMİŞSE
// jwt() callback'inde token.exp'i daha KISA (DEFAULT_SESSION_MAX_AGE, Auth.js'in
// zaten var olan 30 günlük varsayılanıyla AYNI) ayarlanıyor — böylece kutucuğu hiç
// görmeyen/işaretlemeyen kullanıcının deneyimi ESKİSİYLE BİREBİR AYNI kalıyor,
// yalnız işaretleyenler daha uzun (90 gün) hatırlanıyor.
const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 90; // 90 gün
const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 gün — Auth.js'in halihazırdaki varsayılanı

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: REMEMBER_ME_MAX_AGE },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
        // v6.116 — kullanıcı bulgusu 2026-08-13: doğru şifreyle giriş yapan gerçek
        // bir kullanıcı "yanlış şifre" hatası aldı. Kök neden: /giris'in SUNUCU
        // taraflı signIn() çağrısında (Server Action → @/lib/auth) authorize()'a
        // gelen `request` nesnesi güvenilir x-forwarded-for taşımıyor, ip hep
        // "unknown" oluyordu — TÜM kullanıcıların rate-limit'i AYNI paylaşılan
        // "unknown" kovaya düşüyordu, biri birkaç kez yanlış şifre denese bile
        // başkasının doğru girişi bile reddedilebiliyordu. Artık IP, çağıran taraf
        // (giris/page.tsx, headers() ile — LoginLog'un kullandığı AYNI güvenilir
        // kaynak) tarafından açıkça gizli bir alan olarak gönderiliyor.
        ip: { type: "hidden" },
        rememberMe: { type: "hidden" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // v6.109/v6.116: IP önce credentials.ip'den (çağıranın headers() ile
        // güvenilir şekilde okuduğu değer), yoksa request'ten denenir. İkisi de
        // "unknown" ise rate-limit ATLANIR — bilinmeyen tek bir kovada TÜM
        // kullanıcıları toplamak, hiç sınırlamamaktan daha kötü (bkz. yukarıdaki not).
        const ip = (typeof credentials.ip === "string" && credentials.ip) || clientIpFromRequest(request);
        if (ip !== "unknown") {
          const { success } = await checkRateLimit(loginLimiter, ip);
          if (!success) return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            plan: true,
            image: true,
            emailVerified: true,
          },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        // Sahte hesapları engellemek için: e-postası doğrulanmamış hesap giriş yapamaz —
        // birincil kontrol giris/page.tsx'in kendi login() action'ında (kullanıcıyı
        // /kayit/dogrula'ya yönlendirir), bu ikinci bir savunma katmanı (ör. NextAuth
        // signIn'in başka bir yoldan doğrudan çağrılması ihtimaline karşı).
        if (!user.emailVerified) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          plan: user.plan,
          image: user.image ?? undefined,
          isEmailVerified: !!user.emailVerified,
          rememberMe: credentials.rememberMe === "true",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.plan = user.plan;
        token.isEmailVerified = user.isEmailVerified;
        // "Beni hatırla" işaretlenmemişse token'ı Auth.js'in zaten var olan 30 günlük
        // varsayılanına KISALT — bkz. yukarıdaki REMEMBER_ME_MAX_AGE notu. İşaretliyse
        // hiçbir şey yapma, session.maxAge'in (90 gün) tam süresi geçerli kalsın.
        if (!user.rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + DEFAULT_SESSION_MAX_AGE;
        }
      }
      // E-posta doğrulandıktan sonra client'ta useSession().update() çağrılınca
      // JWT'deki eski (doğrulanmamış) durumu DB'den taze okuyarak günceller —
      // aksi halde kullanıcı çıkış/giriş yapana kadar hâlâ "doğrulanmamış" görünür.
      if (trigger === "update" && token.sub) {
        const fresh = await db.user.findUnique({
          where: { id: token.sub },
          select: { emailVerified: true },
        });
        if (fresh) token.isEmailVerified = !!fresh.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.plan = token.plan as import("@prisma/client").Plan;
        session.user.isEmailVerified = token.isEmailVerified as boolean;
      }
      return session;
    },
  },
});

// ─── Role guards ─────────────────────────────────────────────────────────────

const ROLE_ORDER: Record<Role, number> = { USER: 0, EDITOR: 1, ADMIN: 2 };

export function hasRole(userRole: Role, minRole: Role): boolean {
  return ROLE_ORDER[userRole] >= ROLE_ORDER[minRole];
}

// 2026-08-24 kullanıcı bulgusu ("direk siteye aldı beni şifre sıfırlaya bastığımda
// şifre istemeden, telefonda"): bu kontrol eskiden (auth)/layout.tsx'te TÜM auth
// sayfaları (giriş/kayıt/şifre sıfırlama) için ortaktı — zaten oturumu açık bir
// kullanıcı /sifre-sifirla/[token]'a girdiğinde form hiç render edilmeden /panel'e
// atılıyordu. Oturumu açıkken şifre değiştirmek (ör. hesabın ele geçirildiğinden
// şüphelenmek) geçerli bir akış — bu kontrol artık yalnız giriş/kayıt sayfalarında
// (redirectIfLoggedIn çağıran) uygulanıyor, şifre sıfırlama sayfaları MUAF.
export async function redirectIfLoggedIn() {
  const session = await auth();
  if (session?.user) {
    if (hasRole(session.user.role, "EDITOR")) redirect("/admin");
    redirect("/panel");
  }
}

export async function requireRole(minRole: Role) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  if (!hasRole(session.user.role, minRole)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
