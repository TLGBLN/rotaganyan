import type { Role, Plan } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      plan: Plan;
      isEmailVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    plan: Plan;
    isEmailVerified: boolean;
    /** 2026-09-15 — "Beni Hatırla" kullanıcı talebi: yalnız ilk oturum açmada (jwt
     *  callback'te user dolu) okunup token.exp'e yansıtılır, session/JWT'de kalıcı
     *  taşınmaz. */
    rememberMe?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    plan: Plan;
    isEmailVerified: boolean;
  }
}
