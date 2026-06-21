import type { NextAuthConfig } from "next-auth";

// Edge Runtime uyumlu — Prisma/pg import yok.
// Yalnızca middleware tarafından kullanılır.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  providers: [],
  callbacks: {
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
