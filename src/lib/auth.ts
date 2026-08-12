import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // v6.109 — kullanıcı talebi 2026-08-11 ("uçtan uca dışarıdan gelebilecek
        // tüm saldırılara karşı koruyucu önlemler al"): loginLimiter tanımlıydı
        // ama HİÇBİR yerde kullanılmıyordu — giriş formuna karşı kaba kuvvet
        // (brute-force) şifre denemesi tamamen sınırsızdı. IP başına dakikada 5
        // deneme (bkz. src/lib/ratelimit.ts).
        const ip = clientIpFromRequest(request);
        const { success } = await checkRateLimit(loginLimiter, ip);
        if (!success) return null;

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
