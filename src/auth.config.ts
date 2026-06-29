import type { NextAuthConfig } from "next-auth";
import type { Role, Plan } from "@prisma/client";

// Edge Runtime uyumlu — Prisma/pg import yok (sadece tip importu, runtime'a girmez).
// Yalnızca middleware tarafından kullanılır.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  providers: [],
  callbacks: {
    // JWT token'daki role/plan claim'lerini session.user'a kopyalar — bu olmadan
    // middleware'in authorized() kontrolü auth.user.role'u hep undefined görür ve
    // gerçek admin/editor kullanıcıları da /giris'e geri yönlendirir.
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.plan = token.plan as Plan;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminRoute = nextUrl.pathname.startsWith("/admin") ||
        nextUrl.pathname.startsWith("/api/admin");
      const isPanelRoute = nextUrl.pathname.startsWith("/panel");

      if (isAdminRoute) {
        if (!isLoggedIn) return false;
        const role = (auth?.user as { role?: string })?.role;
        return role === "EDITOR" || role === "ADMIN";
      }

      if (isPanelRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },
};
